const assert = require('node:assert');
const { page } = require('./src/paging');

assert.deepEqual(page(['a', 'b', 'c'], 3), ['a', 'b', 'c']);
