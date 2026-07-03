const assert = require('node:assert');
const { readPort } = require('./src/env');

assert.equal(readPort({ PORT: '' }), 3000);
assert.equal(readPort({ PORT: '8080' }), 8080);
