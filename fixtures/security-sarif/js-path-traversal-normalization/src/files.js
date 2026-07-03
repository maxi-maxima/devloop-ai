const path = require('node:path');

const ROOT = path.join(__dirname, '..', 'public');

function resolvePublicPath(userPath) {
  return path.join(ROOT, userPath);
}

module.exports = { ROOT, resolvePublicPath };
