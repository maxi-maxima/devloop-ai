const assert = require('node:assert');
const path = require('node:path');
const { ROOT, resolvePublicPath } = require('./src/files');

assert.equal(resolvePublicPath('images/logo.png'), path.join(ROOT, 'images/logo.png'));
assert.throws(() => resolvePublicPath('../private.txt'), /Invalid public path/);
