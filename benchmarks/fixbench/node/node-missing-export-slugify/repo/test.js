const assert = require('node:assert');
const { slugify } = require('./src/text');

assert.equal(slugify('Hello DevLoop'), 'hello-devloop');
