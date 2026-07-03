const assert = require('node:assert');
const { getCached } = require('./src/cache');

(async () => {
  let calls = 0;
  const value = await getCached('answer', async () => {
    calls += 1;
    return 42;
  });
  assert.equal(value, 42);
  assert.equal(calls, 1);
})();
