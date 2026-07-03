const assert = require('node:assert/strict');
const { formatUser } = require('../src/user');

assert.equal(formatUser({ name: '  Ada Lovelace  ' }), 'Ada Lovelace');
assert.equal(formatUser({}), 'Anonymous');

console.log('fixture tests passed');
