# Spotify Music Server with CAVA Visualization

## `ALSA` - [some docs](https://www.alsa-project.org/alsa-doc/alsa-lib/pcm_plugins.html)

This was by far the most difficult thing to set up. We basically have to fake a loopback/monitor device for the ALSA output. This can be done by loading the `snd-aloop` module. To load this on system boot, add `snd-aloop` to `/etc/modules`. This will create a loopback device (typically `hw:1`).

We then need to configure some "multi plugs" and use software mixing to make this all work. I'm not going to pretend like I know why everything has to be exactly as it is, but this works for me on a Raspberry Pi 4B (4GB early 2020).
The configuration resides in `/home/pi/.asoundrc`.


## `librespot` - [github](https://github.com/librespot-org/librespot)

librespot is an open source client library for Spotify. It enables applications to use Spotify's service to control and play music via various backends, and to act as a Spotify Connect receiver

### System service
To automatically start `librespot` when the Pi boots, place `librespot.service` in `/etc/systemd/user/` and enable it using `systemctl --user enable librespot.service`


## `cava` - [github](https://github.com/karlstav/cava)

Console-based Audio Visualizer for ALSA

### System service

The `cava.service` contains some magic. It assumes, that cava is configured (default config path `~/.config/cava/config`) to pipe its output to `stdout`. The service then pipes this output to the pixel server via `netcat`. The script also makes sure that `systemd` watches the right PID (`netcat` in this case).

## `cavest` - homemade

Simple REST server used for generating the `cava` configuration file (`/home/pi/.config/cava/config`) and controlling the systemd service for cava. It also offers a unified REST interface by passing some pixel settings through to the pixel server.

### Installation

Copy the `cavest` directory to `/home/pi/`, then:

```bash
$ cd cavest
$ yarn install
```

A simple systemd unit is provided: `cavest.service`