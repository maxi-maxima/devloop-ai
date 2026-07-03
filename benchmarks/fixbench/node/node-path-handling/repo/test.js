const assert = require('node:assert');
const path = require('node:path');
const { buildPath } = require('./src/paths');

assert.equal(buildPath('tmp', 'file.txt'), path.join('tmp', 'file.txt'));
