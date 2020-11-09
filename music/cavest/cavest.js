const { exec } = require('child_process');
const { writeFile } = require('fs');
const { get: httpGET } = require('http');

const merge = require('deepmerge');
const express = require('express');

const config_path = '/home/pi/.config/cava/config';
const ps_host = 'http://192.168.178.90';

const default_config = {
	general: {
		framerate: 60,
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
	    	console.error(`Error writing configuration file: `, err)
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

app.get('/pixels/brightness/:v', (req, res, next) => {
	httpGET(`${ps_host}/brightness/${req.params.v}`, () => {
		res.sendStatus(200);
	});
});

app.get('/pixels/color/:r/:g/:b', (req, res, next) => {
	let c = req.params;
	httpGET(`${ps_host}/color/${c.r}/${c.g}/${c.b}`, () => {
		res.sendStatus(200);
	});
});

app.get('/pixels/fill', (req, res, next) => {
	httpGET(`${ps_host}/fill`);
	res.sendStatus(200);
});

app.get('/pixels/clear', (req, res, next) => {
	httpGET(`${ps_host}/clear`);
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

app.get('/status/config', (req, res, next) => {
	res.json(current_config);
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
 
app.listen(port, () => {
	update_config(current_config);
	start_cava_service();
	console.log(`Cavest listening on port ${port}.`);
});