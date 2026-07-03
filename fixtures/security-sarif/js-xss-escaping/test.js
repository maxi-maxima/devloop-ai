const assert = require('node:assert');
const { renderGreeting } = require('./src/render');

assert.equal(renderGreeting('<Ada>'), '<h1>Hello &lt;Ada&gt;</h1>');
assert.equal(renderGreeting('Ada'), '<h1>Hello Ada</h1>');
