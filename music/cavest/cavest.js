const { exec } = require('child_process');
const { writeFile } = require('fs');
const udp = require('dgram');

const merge = require('deepmerge');
const express = require('express');

const config_path = '/home/pi/.config/cava/config';
const ps_host = '192.168.178.175';

const default_config = {
	general: {
		framerate: 50,
		autosens: 0,
		sensitivity: 12,
		bars: 60,
		lower_cutoff_freq: 40,
		higher_cutoff_freq: 20000
	},
	input: {
		method: 'alsa',
		source: 'hw:1,1'
	},
	output: {
		method: 'raw',
		channels: 'mono',
		raw_target: '/dev/stdout',
		data_format: 'binary',
		bit_format: '8bit'
	},
	smoothing: {
		integral: 50,
		gravity: 500
	}
};

let current_config = default_config;

const configs = {
	default: default_config,
	bright: merge(default_config, {
		general: {
			sensitivity: 60
		}
	}),
	dim: merge(default_config, {
		general: {
			sensitivity: 5
		}
	}),
	smooth: merge(default_config, {
		smoothing: {
			integral: 80,
			gravity: 500
		}
	}),
	hectic: merge(default_config, {
		smoothing: {
			integral: 10,
			gravity: 1000
		}
	})
};

const write_config = (config, cb) => {
	let str = '';
	for (let name in config) {
		str += `[${name}]\n`;
		const section = config[name];
		str += Object
			.keys(section)
			.map(key => `${key} = ${section[key]}`)
			.join('\n') + '\n\n';
	}

	writeFile(config_path, str, (err) => {
		current_config = config;
	    if (err) {
	    	// console.error(`Error writing configuration file: `, err)
	    }
    	console.log('Configuration updated.');
    	cb();
	});
};

const start_cava_service = () => {
	exec('systemctl --user start cava.service');
};

const stop_cava_service = () => {
	exec('systemctl --user stop cava.service');
};

const update_config = (config) => {
	write_config(config, () => {
		exec('bash -c "kill -SIGUSR1 $(pgrep cava)"');
	});
};

const port = 1235;
const app = express();

let upd_socket = udp.createSocket('udp4');
const send_socket_message = data => {
	upd_socket.send(Buffer.from(data), 8080, ps_host, err => {
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

const SOCKET_MSG = {
	fill: 0,
	clear: 1,
	brightness: 2,
	color: 3
};

const current_state = {
	enabled: false,
	brightness: 120,
	color: { r: 0, g: 0, b: 0, w: 255 }
};

let interval_timer;
const timed_shutoff = () => {
	// console.log('Starting timer');
	clearInterval(interval_timer);
	if (current_state.enabled === false) {
		return;
	} else {
		let brightness = current_state.brightness;
		let step = brightness / (60 * 10.0);
		// console.log('Step: ', step);
		interval_timer = setInterval(() => {
			brightness -= step;
			// console.log('now: ', brightness);
			if (brightness <= 1) {
				current_state.enabled = false;
				send_socket_message([SOCKET_MSG.clear]);
				clearInterval(interval_timer);
				setTimeout(() => {
					binary_clock_enabled = true;
				}, 1000);
			} else {
				send_socket_message([SOCKET_MSG.brightness, Math.floor(brightness)]);
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

const disable_special_functions = () => {
	clearInterval(interval_timer);
	binary_clock_enabled = false;
};

app.get('/pixels/fill', (req, res, next) => {
	// console.log('fill');
	disable_special_functions();
	current_state.enabled = true;
	send_socket_message([SOCKET_MSG.fill]);
	res.sendStatus(200);
});

app.get('/pixels/clear', (req, res, next) => {
	// console.log('clear');
	disable_special_functions();
	current_state.enabled = false;
	send_socket_message([SOCKET_MSG.clear]);
	res.sendStatus(200);
});

app.get('/pixels/timer', (req, res, next) => {
	// console.log('timer');
	disable_special_functions();
	timed_shutoff();
	res.sendStatus(200);
});

app.get('/pixels/clock', (req, res, next) => {
	disable_special_functions();
	send_socket_message([SOCKET_MSG.clear]);
	binary_clock_enabled = true;
	res.sendStatus(200);
});

app.get('/pixels/brightness/:v', (req, res, next) => {
	// console.log('brightness');
	disable_special_functions();
	current_state.brightness = req.params.v;
	send_socket_message([SOCKET_MSG.brightness, req.params.v]);
	res.sendStatus(200);
});

app.get('/pixels/color/:r/:g/:b/:w', (req, res, next) => {
	// console.log('color');
	disable_special_functions();
	let c = req.params;
	current_state.color = c;
	send_socket_message([SOCKET_MSG.color, c.r, c.g, c.b, c.w]);
	res.sendStatus(200);
});

app.get('/cava/start', (req, res, next) => {
	start_cava_service();
	res.sendStatus(200)
});

app.get('/cava/stop', (req, res, next) => {
	stop_cava_service();
	res.sendStatus(200);
});

app.get('/cava/config/:config', (req, res, next) => {
	const conf_key = req.params.config;

	if (configs.hasOwnProperty(conf_key)) {
		update_config(configs[conf_key]);
		res.sendStatus(200);
	} else {
		res.sendStatus(404);
	}
});

app.get('/cava/set/:section/:key/:value', (req, res, next) => {
	const changed_config = {};
	const changed_section = {};
	const int_value = parseInt(req.params.value);
	changed_section[req.params.key] = Number.isNaN(int_value) ? req.params.value : int_value;
	changed_config[req.params.section] = changed_section;

	update_config(merge(current_config, changed_config));
	res.sendStatus(200);
});

app.get('/status/pixels', (req, res, next) => {
	res.json(current_state);
});

app.get('/status/config', (req, res, next) => {
	res.json(current_config);
});

app.use(express.static('http_root'));
app.listen(port, () => {
	update_config(current_config);
	start_cava_service();
	console.log(`Cavest listening on port ${port}.`);
});