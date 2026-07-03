const assert = require('node:assert');
const { readItems } = require('./src/adapter');

assert.deepEqual(readItems({ json: { items: ['a'] } }), ['a']);
