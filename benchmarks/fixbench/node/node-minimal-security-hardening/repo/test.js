const assert = require('node:assert');
const { isSafeRedirect } = require('./src/redirect');

assert.equal(isSafeRedirect('/dashboard'), true);
assert.equal(isSafeRedirect('//example.com/login'), false);
assert.equal(isSafeRedirect('https://example.com/login'), false);
