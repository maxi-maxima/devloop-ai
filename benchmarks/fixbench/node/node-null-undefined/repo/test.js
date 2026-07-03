const assert = require('node:assert');
const { displayName } = require('./src/user');

assert.equal(displayName({}), 'Anonymous');
