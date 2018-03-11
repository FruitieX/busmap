// https://github.com/mqttjs/MQTT.js/issues/573#issuecomment-362924345
import { Buffer } from 'buffer';
global.Buffer = Buffer;

import process from 'process';
global.process = process;
