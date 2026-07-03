const assert = require('node:assert/strict');
const { formatUser } = require('../src/user');

assert.equal(formatUser({ name: ' Ada ' }), 'Ada');
assert.equal(formatUser({ name: '' }), 'Anonymous');
assert.equal(formatUser({}), 'Anonymous');

console.log('self-dogfood fixture tests passed');
