function isEmail(value) {
  return /^[^@]+@[^@]+$/.test(value);
}

module.exports = { isEmail };
