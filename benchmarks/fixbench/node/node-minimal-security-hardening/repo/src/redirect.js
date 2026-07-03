function isSafeRedirect(target) {
  return target.startsWith('/');
}

module.exports = { isSafeRedirect };
