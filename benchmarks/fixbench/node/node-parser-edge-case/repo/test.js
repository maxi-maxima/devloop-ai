const assert = require('node:assert');
const { parseLine } = require('./src/csv');

assert.deepEqual(parseLine('Ada,"Lovelace, Countess",math'), ['Ada', 'Lovelace, Countess', 'math']);
