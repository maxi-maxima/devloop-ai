const assert = require('node:assert');
const { formatDate } = require('./src/date');

assert.equal(formatDate(new Date('2026-07-03T23:30:00.000Z')), '2026-07-03');
