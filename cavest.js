const { exec } = require('child_process');
const { writeFile } = require('fs');
const udp = require('dgram');

const merge = require('deepmerge');
const express = require('express');

const pixelhost = {
	hostname: '192.168.178.175',
	port: 8080
};

const slothhost = {
	hostname: 'localhost',
	port: 1236
};

const port = 1235;
const app = express();

let upd_socket = udp.createSocket('udp4');
const send_socket_message = (data, host = pixelhost) => {
	upd_socket.send(Buffer.from(data), host.port, host.hostname, err => {
		if (err) {
			console.error('Error sending socket message: ', err);
			try {
				upd_socket.close();
			} catch {
				console.error('Error closing socket: ', err);
			}
			upd_socket = udp.createSocket('udp4');	
		}
	});
};

const SOCKET_MSG_SLOTH = {
	start: 0,
	stop: 1,
	select: 2
};

const SOCKET_MSG_PIXEL = {
	fill: 0,
	clear: 1,
	brightness: 2,
	color: 3
};

const current_state = {
	visualization_enabled: false,
	pixels_enabled: false,
	brightness: 120,
	color: { r: 0, g: 0, b: 0, w: 255 }
};

const start_sloth_service = () => {
	current_state.pixels_enabled = false;
	send_socket_message([SOCKET_MSG_SLOTH.start], slothhost);
	current_state.visualization_enabled = true;
};

const stop_sloth_service = () => {
	current_state.pixels_enabled = false;
	send_socket_message([SOCKET_MSG_SLOTH.stop], slothhost);
	current_state.visualization_enabled = false;
};

const select_config = (config) => {
	send_socket_message([SOCKET_MSG_SLOTH.select, parseInt(config)], slothhost);
};


let interval_timer;
const timed_shutoff = () => {
	// console.log('Starting timer');
	clearInterval(interval_timer);
	if (current_state.pixels_enabled === false) {
		return;
	} else {
		let brightness = current_state.brightness;
		let step = brightness / (60 * 10.0);
		// console.log('Step: ', step);
		interval_timer = setInterval(() => {
			brightness -= step;
			// console.log('now: ', brightness);
			if (brightness <= 1) {
				current_state.pixels_enabled = false;
				send_socket_message([SOCKET_MSG_PIXEL.clear]);
				clearInterval(interval_timer);
				setTimeout(() => {
					binary_clock_enabled = true;
				}, 1000);
			} else {
				send_socket_message([SOCKET_MSG_PIXEL.brightness, Math.floor(brightness)]);
			}
		}, 100);
	}
};

let binary_clock_enabled = true;
const binary_clock = (function () {
	let black = [0, 0, 0, 0];
	let red = [1, 0, 0, 0];
	let white = [0, 0, 0, 1];
	let blue = [0, 0, 1, 0];

	const decimal_to_colors = (d, min, c) => {
		const out = [];
		do {
			v = d & 1;
			out.push([ c[0]*v, c[1]*v, c[2]*v, c[3]*v ]);
			d >>= 1;
		} while (d != 0);
		while (out.length < min) {
			out.push(black);
		}
		return out.reverse();
	};

	function flatDeep(arr, d = 1) {
		return d > 0 ? arr.reduce((acc, val) => acc.concat(Array.isArray(val) ? flatDeep(val, d - 1) : val), []) : arr.slice();
	};

	let last_blink = 0;
	const update = () => {
		const now = new Date();
		const out = [];

		last_blink = last_blink === 1 ? 0 : 1;

		out.push(decimal_to_colors(0, 120, black));
		out.push(decimal_to_colors(1, 1, blue));
		out.push(decimal_to_colors(now.getHours() % 12, 4,  white));
		out.push(decimal_to_colors(last_blink, 1, red));
		let minutes = now.getMinutes();
		out.push(decimal_to_colors(minutes >> 4, 2, white));
		out.push(decimal_to_colors(1, 1, blue));
		out.push(decimal_to_colors(minutes & 15, 4, white));
		out.push(decimal_to_colors(1, 1, blue));

		return new Uint8Array(flatDeep(out, 2));
	};

	const loop = () => {
		if (binary_clock_enabled) {
			const out_bytes = update();
			send_socket_message(out_bytes);
		}
	}
	setInterval(loop, 1000);
}());

const ensure_visualization_disabled = () => {
	if (current_state.visualization_enabled) {
		stop_sloth_service();
		current_state.visualization_enabled = false;
	}
};

const disable_special_functions = () => {
	clearInterval(interval_timer);
	binary_clock_enabled = false;
};

app.get('/pixels/fill', (req, res, next) => {
	ensure_visualization_disabled();
	disable_special_functions();
	send_socket_message([SOCKET_MSG_PIXEL.fill]);
	current_state.pixels_enabled = true;
	res.sendStatus(200);
});

app.get('/pixels/clear', (req, res, next) => {
	ensure_visualization_disabled();
	disable_special_functions();
	setTimeout(() => {
		send_socket_message([SOCKET_MSG_PIXEL.clear]);
	}, 100);
	current_state.pixels_enabled = false;
	res.sendStatus(200);
});

app.get('/pixels/timer', (req, res, next) => {
	ensure_visualization_disabled();
	disable_special_functions();
	timed_shutoff();
	res.sendStatus(200);
});

app.get('/pixels/clock', (req, res, next) => {
	ensure_visualization_disabled();
	disable_special_functions();
	send_socket_message([SOCKET_MSG_PIXEL.clear]);
	binary_clock_enabled = true;
	res.sendStatus(200);
});

app.get('/pixels/brightness/:v', (req, res, next) => {
	current_state.brightness = req.params.v;

	if (current_state.pixels_enabled) {
		disable_special_functions();
		send_socket_message([SOCKET_MSG_PIXEL.brightness, req.params.v]);
	}
	res.sendStatus(200);
});

app.get('/pixels/color/:r/:g/:b/:w', (req, res, next) => {
	let c = req.params;
	current_state.color = c;

	if (current_state.pixels_enabled) {
		disable_special_functions();
		send_socket_message([SOCKET_MSG_PIXEL.color, c.r, c.g, c.b, c.w]);
	}
	res.sendStatus(200);
});

app.get('/visualization/start', (req, res, next) => {
	start_sloth_service();
	res.sendStatus(200)
});

app.get('/visualization/stop', (req, res, next) => {
	stop_sloth_service();
	res.sendStatus(200);
});

app.get('/visualization/config/:config', (req, res, next) => {
	select_config(req.params.config);
	res.sendStatus(200)
});

// app.get('/cava/set/:section/:key/:value', (req, res, next) => {
// 	const changed_config = {};
// 	const changed_section = {};
// 	const int_value = parseInt(req.params.value);
// 	changed_section[req.params.key] = Number.isNaN(int_value) ? req.params.value : int_value;
// 	changed_config[req.params.section] = changed_section;

// 	select_config(merge(current_config, changed_config));
// 	res.sendStatus(200);
// });

app.get('/status', (req, res, next) => {
	res.json(current_state);
});

app.use(express.static('http_root'));
app.listen(port, () => {
	console.log(`Cavest listening on port ${port}.`);
});