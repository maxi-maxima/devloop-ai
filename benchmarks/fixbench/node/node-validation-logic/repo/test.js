const assert = require('node:assert');
const { isEmail } = require('./src/validate');

assert.equal(isEmail('ada@example'), false);
assert.equal(isEmail('ada@example.com'), true);
