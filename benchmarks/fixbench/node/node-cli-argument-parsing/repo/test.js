const assert = require('node:assert');
const { parseArgs } = require('./src/args');

assert.deepEqual(parseArgs(['--name', 'Ada']), { name: 'Ada' });
