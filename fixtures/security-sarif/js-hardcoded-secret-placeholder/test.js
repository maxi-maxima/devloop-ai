const assert = require('node:assert');
const { getApiKey } = require('./src/config');

assert.equal(getApiKey({ API_KEY: 'from-env' }), 'from-env');
assert.equal(getApiKey({}), '');
