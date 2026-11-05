---
title: Schedulers on Linux
date: 2026-11-05
tags: [linux, fedora, kernel, schedulers]
related: []
summary: An overview of Linux CPU schedulers (EEVDF, BORE, BMQ and sched-ext), which one suits which workload, and how to run sched-ext schedulers on Fedora with scxctl.
---

<!-- markdownlint-disable MD014 -- "$ " prompts drive the terminal styling in blog.js -->

The CPU scheduler decides which task runs on which core, and for how long. You rarely notice it, until a game stutters while a compile runs in the background, or a laptop battery drains faster than it should. This post is my overview of the schedulers you can run on Linux today, what each one is good at, and how I switch between them on Fedora with `scxctl`.

Most of the details come from the [CachyOS wiki](https://wiki.cachyos.org/configuration/sched-ext/), which has the best write-up of these schedulers I have found. This is part of the Linux notes I mentioned in [[welcome]].

## Two kinds of scheduler

There are two layers to think about:

1. **The kernel scheduler.** It is built into the kernel you boot. To change it, you install a different kernel.
2. **sched-ext schedulers.** Since kernel 6.12, Linux can load a scheduler written in BPF while the system is running. When one is loaded, it takes over from the built-in scheduler. When you stop it (or it crashes), the kernel falls back to the built-in one.

> sched-ext turns the scheduler into something you can swap like a program, not something you have to recompile.

## Kernel schedulers

| Scheduler | What it is | Good for |
| --- | --- | --- |
| **EEVDF** | The default in mainline Linux since 6.6. It replaced CFS. Tasks get a fair share of CPU, and tasks with short deadlines run sooner. | Everything. A safe, well-tested default. |
| **BORE** | "Burst-Oriented Response Enhancer", a patch on top of EEVDF. It favours tasks that run in short bursts (like UI and game threads) over tasks that use the CPU for long stretches (like compilers). | Desktops and gaming. It feels snappier under load. |
| **BMQ** | "BitMap Queue", part of Project C. It is a separate, simpler scheduler design. | Experimenting. It does **not** support sched-ext. |

CachyOS ships kernels with each of these. The default `linux-cachyos` kernel uses BORE, and there are variants such as `linux-cachyos-eevdf`, `linux-cachyos-bmq`, `linux-cachyos-server` (stock EEVDF, 300 Hz, no preemption) and `linux-cachyos-rt-bore` (real-time). The hardened and BMQ variants do not support sched-ext.

On Fedora, the stock kernel uses EEVDF, and it already has sched-ext turned on. That is enough to try every scheduler in the next section.

## sched-ext schedulers

These live in the [sched-ext/scx](https://github.com/sched-ext/scx) project. Each one is a small program that you start and stop. Most have **modes**, which are preset flags for a kind of workload: `auto`, `gaming`, `lowlatency`, `powersave` and `server`.

### The ones worth trying first

- **scx_bpfland.** Prioritises interactive tasks and knows which cores share a cache. It works well for gaming, desktop use, audio, power saving and servers. A good first pick.
- **scx_lavd.** Built for latency-critical work, originally for gaming on the Steam Deck. Its "core compaction" puts work on fewer cores when the CPU is under 50% busy, which saves power. Good for gaming and laptops.
- **scx_cosmos.** A general-purpose scheduler that keeps tasks on the same CPU when the system is not saturated. A good all-rounder and the default in the sample scx_loader config.
- **scx_flash.** Deadline-based (EDF), with a latency weight per task. Good for gaming, audio and multimedia, and for keeping the desktop usable when the system is overloaded.

### The rest

- **scx_rusty.** Very tunable, and production-ready if you tune it. Good for desktop, gaming, audio and power saving.
- **scx_p2dq.** General-purpose, balances load across cache domains with a "pick two" strategy. Production-ready if tuned. Has all five modes.
- **scx_beerland.** Focuses on cache locality and scaling to many CPUs. Good for cache-heavy work and servers, and surprisingly fine in some games.
- **scx_rustland.** Makes all its decisions in user space, in Rust. It is easier to read and extend, at a small cost in throughput. Good for gaming, video calls, streaming and desktop.
- **scx_tickless.** For servers, cloud, virtualisation and HPC. It needs `nohz_full` on the kernel command line and is experimental.
- **Experimental:** scx_cake (gaming), scx_flow, scx_pandemonium and scx_forge. Fun to try, but not ones I would leave running.

### Which one should I pick?

| You mostly… | Try |
| --- | --- |
| Play games | `scx_lavd` (gaming), `scx_bpfland` or `scx_flash` |
| Use a desktop and compile code | `scx_bpfland` or `scx_cosmos` |
| Do audio or video work | `scx_flash` (lowlatency) or `scx_bpfland` |
| Want longer battery life | `scx_lavd` (powersave) or `scx_bpfland` (powersave) |
| Run a server or VMs | `scx_cosmos` (server), `scx_p2dq` (server) or EEVDF |
| Are not sure | Stay on EEVDF, or try `scx_bpfland` in auto mode |

These are starting points. The right answer depends on your hardware and games, so test a few and keep the one that feels best.

## Setting it up on Fedora

### 1. Check your kernel

sched-ext needs kernel 6.12 or newer with `CONFIG_SCHED_CLASS_EXT` turned on.

```bash
$ uname -r
6.17.5-300.fc43.x86_64
$ grep CONFIG_SCHED_CLASS_EXT /boot/config-$(uname -r)
CONFIG_SCHED_CLASS_EXT=y
```

If you see `=y`, you are ready.

### 2. Install the schedulers

The CachyOS community maintains a Fedora COPR with the schedulers and tools.

```bash
$ sudo dnf copr enable bieszczaders/kernel-cachyos-addons
$ sudo dnf install scx-scheds scx-tools
```

`scx-scheds` has the schedulers. `scx-tools` has `scx_loader` (a background service) and `scxctl` (the command you use to talk to it). If `dnf` cannot find `scx-tools`, check which package provides it:

```bash
$ dnf provides scxctl
```

### 3. Start the loader service

```bash
$ sudo systemctl enable --now scx_loader.service
$ systemctl status scx_loader.service
● scx_loader.service - DBUS on-demand loader of sched-ext schedulers
     Loaded: loaded (/usr/lib/systemd/system/scx_loader.service; enabled)
     Active: active (running)
```

Older guides use `scx.service` with a config in `/etc/default/scx`. Don't run both. If you have the old one, switch over:

```bash
$ sudo systemctl disable --now scx.service
$ sudo systemctl enable --now scx_loader.service
```

### 4. Pick a scheduler with scxctl

`scxctl` talks to `scx_loader`, so you can start, switch and stop schedulers without rebooting.

```bash
# What is running right now?
$ scxctl get
no scx scheduler running

# Which schedulers are installed?
$ scxctl list

# Start bpfland in gaming mode
$ scxctl start --sched bpfland --mode gaming

# Switch to lavd in power-save mode (short flags work too)
$ scxctl switch -s lavd -m powersave

# Show the modes lavd supports, and the flags behind them
$ scxctl modes -s lavd --show-args

# Stop it and go back to the kernel scheduler
$ scxctl stop
```

You can also pass your own flags with `--args`. Separate them with commas:

```bash
$ scxctl start --sched cosmos --args="-c,75,-m,0-15"
$ scxctl switch --sched flash --args="-s,20000"
```

Valid modes are `auto`, `gaming`, `lowlatency`, `powersave` and `server`. If you don't give one, `start` uses `auto`. You may get a password prompt, since changing the scheduler needs admin rights.

### 5. Check that it worked

The kernel reports the active scheduler in `/sys`:

```bash
$ cat /sys/kernel/sched_ext/state /sys/kernel/sched_ext/root/ops
enabled
bpfland
```

With no sched-ext scheduler loaded, `state` says `disabled`. Most schedulers can also show live stats:

```bash
$ sudo scx_bpfland --monitor 0.5
```

### 6. Make it stick after a reboot

`scxctl` changes last until you reboot. To load a scheduler at boot, copy the default config and edit it:

```bash
$ sudo mkdir -p /etc/scx_loader
$ sudo cp /usr/share/scx_loader/config.toml /etc/scx_loader/config.toml
$ sudoedit /etc/scx_loader/config.toml
```

Set the default scheduler and mode at the top. You can also change the flags behind each mode:

```toml
# file: /etc/scx_loader/config.toml
default_sched = "scx_bpfland"
default_mode = "Gaming"     # Auto, Gaming, LowLatency, PowerSave or Server

[scheds.scx_bpfland]
auto_mode       = ["-m", "auto"]
gaming_mode     = ["-m", "all"]
lowlatency_mode = ["-m", "performance", "-w"]
powersave_mode  = ["-s", "20000", "-m", "powersave", "-I", "100", "-t", "100"]
server_mode     = ["-s", "20000", "-S"]

[scheds.scx_lavd]
gaming_mode    = ["--performance"]
powersave_mode = ["--powersave"]
```

Note that modes in this file are capitalised (`Gaming`), while `scxctl` uses lowercase (`gaming`). If `default_sched` is empty, nothing loads at boot. Restart the service to apply the file:

```bash
$ sudo systemctl restart scx_loader.service
$ scxctl get
running bpfland in gaming mode
```

### When something goes wrong

The logs are the first place to look:

```bash
$ journalctl -u scx_loader.service -b 0
```

sched-ext is built to fail safely. If a scheduler misbehaves, a watchdog unloads it and the kernel goes back to EEVDF. You can also unload it by hand with `scxctl stop`, or with the `SysRq + S` key combination if the desktop freezes.

## Optional: the CachyOS kernel on Fedora

If you want BORE and the other CachyOS kernel patches, the same team has a Fedora COPR for the kernel itself. sched-ext schedulers work on top of it too, and when you stop one, BORE takes over instead of plain EEVDF.

Installing it is only a few commands. Doing it with Secure Boot on and an NVIDIA GPU takes more care, because the NVIDIA driver has to be signed with your own key. I wrote that up step by step in [[cachyos-kernel-on-fedora|CachyOS kernel on Fedora with signed NVIDIA drivers]].

You can confirm you are on it from the boot log:

```bash
$ sudo dmesg | grep -i bore
```

On my laptop this showed BORE 6.6.1, and the same log showed the CachyOS kernel's ADIOS I/O scheduler.

## Don't tune it like CFS

Many older tuning guides set `kernel.sched_min_granularity_ns`, `sched_wakeup_granularity_ns` and `sched_migration_cost_ns`. Those belonged to CFS. On EEVDF and BORE kernels they don't exist, and sysctl just prints `cannot stat` errors. I had all three in my sysctl files before I noticed. If you want to change scheduling behaviour on a modern kernel, pick a different scheduler or mode instead.

## What I use

My laptop is an ROG Strix G16 with an i7-13650HX, which mixes 6 performance cores with 8 efficiency cores ([[fedora-on-rog-strix-g16]]). It runs the CachyOS kernel with `scx_bpfland` in gaming mode, set in the scx_loader config so it starts at boot:

```toml
# file: /etc/scx_loader/config.toml
default_sched = "scx_bpfland"
default_mode = "Gaming"
```

bpfland knows which cores share a cache, which helps on a hybrid CPU like this one. `scx_lavd` is the next one I want to test properly on the P/E core split. Switching takes one command, and if I don't like the result, `scxctl stop` puts everything back.
