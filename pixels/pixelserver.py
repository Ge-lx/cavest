import socket
import time

import board
import neopixel

from threading import Thread
import re, functools, json
from socketserver import TCPServer
from http.server import SimpleHTTPRequestHandler as ReqHandler
import http.server

# ========== Setup Neopixel API ===========
pixel_pin = board.D18
num_pixels = 60
ORDER = neopixel.GRB

pixels = neopixel.NeoPixel(
    pixel_pin, num_pixels, brightness=1, auto_write=False, pixel_order=ORDER
)

# RGB (values ranging from 0 to 1) for the color
current_color = (1, 0, 0)
filled = False

def get_color (amp):
    return (int(current_color[0] * amp),
            int(current_color[1] * amp),
            int(current_color[2] * amp))

def on_pixel_data (data):
    global filled
    filled = False
    for i in range(60):
        pixels[i] = get_color(data[i])
    pixels.show()

def fill_pixels ():
    global filled
    filled = True
    pixels.fill(get_color(255))
    pixels.show()

def clear_pixels ():
    global filled
    filled = False
    pixels.fill((0, 0, 0))
    pixels.show()

def set_pixel_brightness (value):
    pixels.brightness = value
    pixels.show()

def set_pixel_color (value):
    global current_color
    current_color = value
    if filled:
        fill_pixels()

# ======== TCP Data Socket ================
def queue ():
    buffer = list()
    def on_data (data):
        nonlocal buffer

        buffer += data
        if len(buffer) > 60:
            complete = buffer[:60]
            buffer = buffer[60:]
            on_pixel_data(complete)
    return on_data

def handle_data_socket (client_socket, address):
    print(f'Connection established from {address}')

    with client_socket:
        q = queue()
        while True:
            data = client_socket.recv(512)
            if not data: break
            q(data)
    print('Connection lost.')

def data_server_listen ():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind(('0.0.0.0', 1234))
    server.listen()

    while True:
        client_socket, address = server.accept()
        handle_data_socket(client_socket, address)

# ========== REST Configuration =============

def on_request_GET (req):
    if (req.path.startswith('/brightness')):
        value = req.path[12:]
        try:
            value = float(value)
            if (value < 0 or value > 1):
                print(f'Brightness must be positive and <= 1. Got {value}')
            else:
                set_pixel_brightness(value)
                print(f'Changed brightness to {value}')
        except:
            print(f'Could not parse brightness: {value}')

    elif (req.path.startswith('/color')):
        color = req.path[7:]
        try:
            (r, g, b) = color.split('/')
            set_pixel_color((float(r), float(g), float(b)))
            print(f'Changed pixel color to RGB{current_color}')
        except:
            print(f'Could not parse pixel color: {color}')
    
    elif (req.path.startswith('/fill')):
        fill_pixels()

    elif (req.path.startswith('/clear')):
        clear_pixels()

    return req.do_HEAD()

class CustomReqHandler(ReqHandler):

    def log_message(self, format, *args):
        pass

    def _set_headers (self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        
    def do_HEAD (self):
        self._set_headers()

    def do_JSON (self, obj): 
        self._set_headers()
        self.wfile.write(json.dumps(obj).encode())

    def do_GET (self):
        try:
            return on_request_GET(self)
        except Exception as e:
            self.send_error(500)
            raise e

class TCPReuseServer (TCPServer):
    allow_reuse_address = True

# Start the Server
def web_server_listen ():
    my_server = TCPReuseServer(("", 80), CustomReqHandler)
    my_server.serve_forever()

#=============== MAIN ===================
def run_async (callback):
    thread = Thread(target=callback, daemon=False)
    thread.start()

run_async(data_server_listen)
run_async(web_server_listen)