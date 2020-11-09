# Neopixel TCP Pixel Server

This python script allows control of pixel brightness over a TCP socket. Make sure that controlling the LED strip works as described [here](https://learn.adafruit.com/neopixels-on-raspberry-pi/python-usage).

## Pixelserver

This is a simple python file. Place it as `/home/pi/pixelserver.py` and install `pixel.service` as a system service:

```bash
sudo systemctl enable pixel.service
sudo systemctl start pixel.service
```