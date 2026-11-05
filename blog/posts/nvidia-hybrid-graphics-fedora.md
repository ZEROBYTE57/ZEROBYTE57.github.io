---
title: NVIDIA hybrid graphics on a ROG laptop with Fedora
date: 2026-11-05
tags: [linux, fedora, nvidia, games]
related: []
summary: How I get games and apps onto the RTX 4060 instead of the Intel iGPU on Fedora, with supergfxctl, PRIME offload and per-app fixes for Steam, DaVinci Resolve, Kdenlive and VLC.
---

<!-- markdownlint-disable MD014 -- "$ " prompts drive the terminal styling in blog.js -->

My ROG Strix G16 has two GPUs: the Intel iGPU in the i7-13650HX and an RTX 4060 Laptop. In hybrid mode the desktop runs on Intel and the NVIDIA card sleeps until an app asks for it. That saves a lot of battery, but most of my app problems came from apps quietly running on the Intel GPU instead.

This post covers what fixed that. It assumes the NVIDIA driver is already installed and signed, as in [[cachyos-kernel-on-fedora]]. The rest of the laptop setup is in [[fedora-on-rog-strix-g16]].

## Hybrid or dedicated?

ASUS laptops switch GPU modes with `supergfxctl`, from the `lukenukem/asus-linux` COPR together with `asusctl`:

```bash
$ sudo dnf copr enable lukenukem/asus-linux
$ sudo dnf install asusctl supergfxctl
$ sudo systemctl enable --now supergfxd
$ supergfxctl --get
Hybrid
```

- **Hybrid:** the desktop runs on Intel. Apps use NVIDIA only when asked. Best for battery, and in my tests also best for DaVinci Resolve.
- **Dedicated (MUX):** the panel is wired straight to NVIDIA. Best for games.

`supergfxctl --mode Dedicated` failed for me with `Could not parse mode name`. Check `supergfxctl --supported` for the mode names your version accepts.

## PRIME offload: asking for the NVIDIA GPU

In hybrid mode, an app runs on NVIDIA when it starts with these three environment variables:

```bash
$ __NV_PRIME_RENDER_OFFLOAD=1 __GLX_VENDOR_LIBRARY_NAME=nvidia __VK_LAYER_NV_optimus=NVIDIA_only glxinfo | grep "OpenGL renderer"
OpenGL renderer string: NVIDIA GeForce RTX 4060 Laptop GPU/PCIe/SSE2
```

Without them, the same command shows `Mesa Intel Graphics (RPL-S)`. That's the quickest way to tell which GPU an app will get.

Ubuntu's `prime-run` comes from `nvidia-prime`, which doesn't exist on Fedora. A shell alias does the same job:

```bash
$ echo "alias prime-run='__NV_PRIME_RENDER_OFFLOAD=1 __GLX_VENDOR_LIBRARY_NAME=nvidia __VK_LAYER_NV_optimus=NVIDIA_only'" >> ~/.bashrc
$ source ~/.bashrc
$ prime-run glxinfo | grep "OpenGL renderer"
```

An alias only works for things you start from a terminal. Apps from the menu or Flatpaks need one of the fixes below.

GNOME also offers **Launch using Discrete Graphics Card** when you right-click an app in the overview, which is handy for one-off launches.

## Steam (Flatpak)

Counter-Strike 2 was running on the Intel GPU. Adding the three variables to the Steam Flatpak fixed it:

```bash
$ flatpak override --user \
  --env="__NV_PRIME_RENDER_OFFLOAD=1" \
  --env="__GLX_VENDOR_LIBRARY_NAME=nvidia" \
  --env="__VK_LAYER_NV_optimus=NVIDIA_only" \
  com.valvesoftware.Steam
```

Two lessons from getting there:

- An earlier, bigger set of overrides (Wayland socket, GL32 runtime and more) stopped Steam from launching at all. If that happens, reset and add one override at a time:

  ```bash
  $ flatpak override --user --reset com.valvesoftware.Steam
  ```

- Flatpak Steam isn't on your `PATH`. Start it with `flatpak run com.valvesoftware.Steam`.

## Flatpak apps need matching NVIDIA runtimes

Flatpaks bring their own copy of the NVIDIA userspace libraries, and the version must **exactly** match your host driver. Check the driver version and install the matching runtimes (Kdenlive here):

```bash
$ modinfo -F version nvidia
595.71.05
$ flatpak install flathub org.freedesktop.Platform.GL.nvidia-595-71-05 \
  org.freedesktop.Platform.GL32.nvidia-595-71-05
$ flatpak override --user \
  --env="__NV_PRIME_RENDER_OFFLOAD=1" \
  --env="__GLX_VENDOR_LIBRARY_NAME=nvidia" \
  --env="__VK_LAYER_NV_optimus=NVIDIA_only" \
  org.kde.kdenlive
```

`flatpak update` normally pulls the matching runtime after a driver update, but check it if a Flatpak suddenly falls back to the Intel GPU.

## Menu apps (VLC)

For an RPM app started from the menu, copy its desktop file into your home folder and add the variables to the `Exec` line:

```bash
$ cp /usr/share/applications/vlc.desktop ~/.local/share/applications/
$ sed -i 's|^Exec=/usr/bin/vlc|Exec=env __NV_PRIME_RENDER_OFFLOAD=1 __GLX_VENDOR_LIBRARY_NAME=nvidia /usr/bin/vlc|' \
  ~/.local/share/applications/vlc.desktop
$ update-desktop-database ~/.local/share/applications
$ grep ^Exec ~/.local/share/applications/vlc.desktop
```

Your copy overrides the system one, but it doesn't change when the package updates. After my Fedora 44 upgrade, VLC showed black video and tried to open a literal `%U`, so check the `Exec` line again after big upgrades.

## DaVinci Resolve with CUDA

Resolve's `.run` installer needs a few compatibility packages on Fedora, and its bundled GLib libraries clash with Fedora's:

```bash
$ sudo dnf install mesa-libOpenCL apr apr-util zlib-ng-compat libxcrypt-compat
$ sudo SKIP_PACKAGE_CHECK=1 ./DaVinci_Resolve_*.run
$ cd /opt/resolve/libs
$ sudo mkdir disabled-libraries
$ sudo mv libglib* libgio* libgmodule* disabled-libraries
```

CUDA comes from `xorg-x11-drv-nvidia-cuda`. Give Resolve's desktop file the PRIME variables, as with VLC. Two things to know:

- The free version can't decode H.264 or H.265 on Linux. Convert footage to DNxHR with ffmpeg first.
- **Hybrid beat Dedicated** in the Blackmagic RAW speed test: 71 fps against 62 fps for 8K with CUDA.

## Driver settings I keep

```text
# file: /etc/modprobe.d/nvidia-sleep.conf
options nvidia NVreg_PreserveVideoMemoryAllocations=1
```

That option keeps video memory across suspend. It goes with NVIDIA's suspend services:

```bash
$ sudo systemctl enable nvidia-suspend nvidia-hibernate nvidia-resume
$ sudo dracut --force
```

I also had `options nvidia-drm modeset=1 fbdev=1` in `/etc/modprobe.d/nvidia-drm.conf`. Recent drivers turn modesetting on by default, so this is mostly a no-op now. `ls /dev/fb0` confirms the NVIDIA framebuffer is active.

## Things that look wrong but aren't

- **No PowerMizer page in nvidia-settings.** Normal in hybrid mode. The GPU is asleep in its P8 state at about 2 W.
- **`nvidia-smi -pl` says not supported.** Laptop power limits are set by firmware. Mine is 140 W, which is 100 W plus Dynamic Boost.
- **ReBAR.** It is already on. `sudo lspci -vvv -s 01:00.0 | grep -i bar` shows an 8 GB BAR 1, and there is no BIOS toggle.
- **`NVreg_EnableGpuFirmware=0` does nothing.** On this card the GSP firmware stays on anyway (`nvidia-smi -q | grep -i gsp`).
