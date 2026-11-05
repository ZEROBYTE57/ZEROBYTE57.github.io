---
title: Fedora on an ASUS ROG Strix G16
date: 2026-11-05
tags: [linux, fedora, laptop, nvidia]
related: []
summary: Notes from three months of running Fedora 43 and 44 on an ROG Strix G16, covering audio, power, the CachyOS kernel, NVIDIA under Secure Boot, and the mistakes that broke things.
---

<!-- markdownlint-disable MD014 -- "$ " prompts drive the terminal styling in blog.js -->

From March to May 2026 I ran Fedora on my ASUS ROG Strix G16 as my main system: Fedora 43 first, then 44, with GNOME on Wayland, the RPM Fusion NVIDIA driver, Secure Boot on, and most of the time the CachyOS kernel. This post is the overview. The bigger topics have their own posts:

- [[cachyos-kernel-on-fedora]]: the CachyOS kernel with a signed NVIDIA driver.
- [[nvidia-secure-boot-fixes]]: the three times NVIDIA broke under Secure Boot, and the fix.
- [[nvidia-hybrid-graphics-fedora]]: getting games and apps onto the RTX 4060.
- [[schedulers-on-linux]]: BORE, EEVDF and the sched-ext schedulers I run on top.

## The machine

| Part | Details |
| --- | --- |
| Model | ASUS ROG Strix G16 (G614JV) |
| CPU | Intel i7-13650HX: 6 performance + 8 efficiency cores, 20 threads |
| RAM | 16 GB DDR5, one stick |
| GPU | NVIDIA RTX 4060 Laptop, 140 W max, plus the Intel iGPU |
| Display | 16" 1920x1200, 48–165 Hz |
| Audio | Intel HDA with a Realtek ALC294 codec |
| Drives | WD Black SN850X 1 TB (Fedora), Micron 2400 1 TB (Windows) |

Two things about this hardware matter for Linux. The CPU mixes performance and efficiency cores, which is where scheduler choice starts to matter. And the NVMe names `nvme0n1` and `nvme1n1` **swap between boots**, so I always identify drives by model or UUID, never by name.

## Audio (ALC294)

Audio worked out of the box, but crackled and cut out when idle. The fix was turning off codec power saving:

```bash
$ echo "options snd_hda_intel power_save=0 power_save_controller=N" | \
  sudo tee /etc/modprobe.d/audio_disable_powersave.conf
$ sudo dracut --force
$ sudo reboot
```

What not to do: I first added `options snd-hda-intel model=asus-zenbook` from a forum post. That quirk is wrong for the G614JV, and audio died completely after a reboot. Overwriting the file with only the power-save line brought it back.

PipeWire runs as a **user** service. `sudo systemctl enable` on it creates stray system links, and `systemctl --user disable` kills your audio. If you break it, turn it back on:

```bash
$ systemctl --user enable --now pipewire pipewire-pulse wireplumber
```

## First-day tidy-up

```bash
$ sudo systemctl disable NetworkManager-wait-online.service
$ sudo systemctl enable --now firewalld
$ sudo systemctl enable --now fstrim.timer
```

The first line speeds up boot. The last one trims the SSDs weekly.

DNF 5 changed some syntax. Adding a repo is now `dnf config-manager addrepo --from-repofile=<url>`. The old `--add-repo` fails on Fedora 43 and later. I also set `max_parallel_downloads=10` in `/etc/dnf/dnf.conf`.

GNOME 49 on Fedora 43 has **no Xorg session** anymore. `gnome-session-xsession` doesn't exist and `/usr/share/xsessions/` is empty, so Wayland it is.

## ASUS tools and power

`asusctl` and `supergfxctl` come from the `lukenukem/asus-linux` COPR (setup in [[nvidia-hybrid-graphics-fedora]]). asusctl 6.x changed its flags, so old guides using `asusctl profile -P` fail:

```bash
$ asusctl profile list
$ asusctl profile --profile-set Performance
```

On power:

- **Fedora 43** used `power-profiles-daemon`. Setting the profile with `powerprofilesctl set performance` worked well.
- **Fedora 44** ships `tuned` instead, and it works alongside `asusd`.
- **Don't add TLP.** It conflicts with both power-profiles-daemon and asusctl.
- **The `powersave` CPU governor is fine.** With `intel_pstate` it means "dynamic", not "slow". What matters is the energy preference (EPP), and `performance` profiles set that. `schedutil` isn't offered by `intel_pstate` at all.

After my Fedora 44 upgrade, `asusd` failed with `Could not create "/etc/asusd/" Permission denied`. Creating the folder by hand didn't help, but it came back on its own after the next reboot.

## Kernel and sysctl tuning

I run the CachyOS kernel ([[cachyos-kernel-on-fedora]]) with `cachyos-settings`, which already sets sensible defaults in `/usr/lib/sysctl.d/70-cachyos-settings.conf`. My own sysctl files only add what it doesn't cover:

```ini
# file: /etc/sysctl.d/99-performance.conf
# Only settings not covered by CachyOS defaults
kernel.sched_autogroup_enabled = 1
fs.inotify.max_user_watches = 524288
vm.nr_hugepages = 128
```

Two lessons:

- **Old CFS tuning doesn't apply.** `sched_min_granularity_ns`, `sched_wakeup_granularity_ns` and `sched_migration_cost_ns` don't exist on EEVDF or BORE kernels. Guides still list them, and sysctl just prints `cannot stat` errors.
- **Keep each setting in one file.** I ended up with `vm.swappiness` in three places, set to different values. Use `sysctl -a | grep swappiness` to see which one actually won.

## Network

Wi-Fi power saving caused lag spikes, so I turned it off:

```ini
# file: /etc/NetworkManager/conf.d/wifi-powersave.conf
[connection]
wifi.powersave = 2
```

```bash
$ sudo systemctl restart NetworkManager
```

On 2.4 GHz I saw about 42% retransmits. On 5 GHz the connection was clean.

## Dual boot and GRUB

Fedora and Windows live on separate drives, and GRUB (through shim, for Secure Boot) boots both. I added a ROG GRUB theme:

```bash
$ sudo sed -i 's|^GRUB_THEME=.*|GRUB_THEME="/boot/grub2/themes/asus-rog/theme.txt"|' /etc/default/grub
$ sudo sed -i 's|^GRUB_GFXMODE=.*|GRUB_GFXMODE="1920x1200x32"|' /etc/default/grub
$ sudo grub2-mkconfig -o /boot/grub2/grub.cfg
```

GRUB still looks lower-resolution than the panel. That's a limit of the laptop's UEFI graphics, not something Linux can fix.

I also found a leftover standalone CachyOS install from an earlier experiment, with its own EFI entry. Removing that entry cleaned up the boot menu:

```bash
$ sudo efibootmgr
$ sudo efibootmgr -b 0000 -B
$ sudo rm -rf /boot/efi/EFI/cachyos
$ sudo grub2-mkconfig -o /boot/grub2/grub.cfg
```

Check the number with plain `efibootmgr` first. `0000` was the CachyOS entry on my machine. Yours will be different.

On Windows, turn off **Fast Startup**. It caused touchpad-gesture trouble for me, and it is risky with shared drives.

## Mistakes worth avoiding

Most of my breakages came from a handful of repeat causes:

| What went wrong | Why | Do this instead |
| --- | --- | --- |
| Pasting a whole chat answer into the terminal | The explanation text ran as commands, and once wrote text into a config file | Copy only the code, then `cat` the file to check it |
| Audio died after a `model=` quirk | Wrong quirk for this codec | Change one thing at a time, and keep a revert line ready |
| Fedora wouldn't boot after GPU passthrough setup | Binding the only dGPU to `vfio-pci` at boot took it from the host | Press `E` in GRUB, delete the `vfio-pci.ids=` option and boot. Avoid boot-time passthrough on a laptop. |
| NVIDIA dead with Secure Boot off | `lockdown` stayed on, and the MOK key wasn't loaded | Keep Secure Boot on ([[nvidia-secure-boot-fixes]]) |
| Corrupt `.ko.xz` / `.ko.zst` modules | Signing compressed modules by hand | Let akmods or DKMS sign |
| Steam stopped launching | Too many Flatpak overrides at once | Reset, then add one at a time |
| Commands that didn't exist | Package names that were guessed, not checked | `dnf search` or check the COPR page first |
| Lost data while installing Linux | The installer formatted the whole wrong disk, and SSD TRIM wiped the blocks | Pick the disk by model, and back up first |

That last one hurt. On an NVMe drive, TRIM clears deleted blocks almost at once, so recovery tools (TestDisk, PhotoRec, DMDE) only found fragments. Backups are the only real protection.

## Where it ended up

By May 2026 the laptop ran Fedora 44 on CachyOS kernel 7.0.5, with NVIDIA 595.71.05 signed under Secure Boot, hybrid graphics through supergfxctl, and `scx_bpfland` in gaming mode. It was stable, and when something broke, the cause was almost always one of the mistakes above.
