# Cavest + Spotify + Neopixels + 2 RPi

This is a fun litte project which uses a bunch of UNIX magic to blink an LED Strip in sync with your music. It consists of two Raspberry Pis which serve different functions in the process:


```
	           +--------------------------------------------------------------------------+
	           |                         Server Raspberry Pi 4                            |
	           |                         ======================  +----------------------+ |
	           |                                                 |         CAVA         | |
	           | +------------+    +---------------+             |                      | |
	           | | librespot  |    | ALSA Loopback +-------------> - console based      | |
	           | |            |    +---------^-----+             |   analog visualizer  | |
	   +-------> | - Spotify- |              |                   | - ALSA backend       | |
	   |       | |   connect  |              |                   | - Raw binary output  | |
	   |       | |   client   +--------------+                   |                      | |
	   |       | |            |              |                   +---+------------------+ |
	   |       | | + ALSA     |              |                       |                    |
	   |       | |            |              |                       |       +--------+   |
	   |       | +------------+    +---------v-----+                 +-------> netcat |   |
	   |       |                   | Analog Output |                         +----+---+   |
	   |       |                   | (3"5 or HDMI) |                              |       |
	   |       +-------------------+---+-----------+--------------------------------------+
	   |                               |                                          |
	   |                               |                                          |
	   +                               |                                          |
	 Spotify Client                    v                                          |
	+--------------+               Speakers                      +----------------v--------+
	                              +--------+                     |                         |
	                                                             |   Client Raspberry Pi   |
	                                                             |   ===================   |
	                                                             |                         |
	                                                             |  - Model B+ (512MB)     |
	                                                             |  - Python               |
	                                          +------------------+      - TCP I/O          |
	                                          |                  |      - Neopixel LED     |
	                                          v                  |                         |
	                                    Neopixel LEDS            +-------------------------+
	                                   +-------------+

```

## Server Raspberry Pi - `music`

### System.d services
 * `librespot.service` - Spotify connect client
 * `cava.service` - Cava visualizer
 * `cavest.service` - Cavest (see below)

### REST Interface - "Cavest"
Node.js REST interface for controlling cava and some led params.
WIP, planned to serve responsive control WebApp.

### Other configuration
 * `~/.asoundrc` ALSA audio routing configuration
 * add `snd_aloop` to `/etc/modules` for ALSA loopback device
 * `yarn install` for cavest


## Client Raspberry Pi - `pixelserver`

### System.d services
 * `pixel.service` starts python server

### Other configuration
 * install pip and setup Neopixel libraries
 * wiring for LED strip