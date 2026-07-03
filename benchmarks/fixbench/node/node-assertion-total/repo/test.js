const assert = require('node:assert');
const { total } = require('./src/cart');

assert.equal(total([{ price: 5, quantity: 2 }, { price: 3, quantity: 1 }]), 13);
