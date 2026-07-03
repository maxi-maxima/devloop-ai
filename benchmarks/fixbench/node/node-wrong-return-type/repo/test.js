const assert = require('node:assert');
const { findUser } = require('./src/users');

assert.deepEqual(findUser(1), { id: 1, name: 'Ada' });
