const assert = require('node:assert');
const { loadConfig } = require('./src/config');

assert.deepEqual(loadConfig({ telemetry: false }), { telemetry: false });
