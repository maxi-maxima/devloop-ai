const assert = require('node:assert');
const { parseConfig } = require('./src/json');

assert.deepEqual(parseConfig('\uFEFF{"enabled":true}'), { enabled: true });
