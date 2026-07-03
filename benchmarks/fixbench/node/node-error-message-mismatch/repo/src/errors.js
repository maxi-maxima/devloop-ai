function requireName(value) {
  if (!value) {
    throw new Error('bad input');
  }
  return value;
}

module.exports = { requireName };
