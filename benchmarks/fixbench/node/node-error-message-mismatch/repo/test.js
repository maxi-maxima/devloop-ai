const assert = require('node:assert');
const { requireName } = require('./src/errors');

assert.throws(() => requireName(''), /Name is required/);
