const assert = require('node:assert');
const { applyDiscount } = require('./src/discount');

assert.equal(applyDiscount(100, 10), 90);
assert.equal(applyDiscount(50, 20), 40);
