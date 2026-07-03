const values = new Map();

async function getCached(key, loader) {
  if (values.has(key)) {
    return values.get(key);
  }
  const value = loader;
  values.set(key, value);
  return value;
}

module.exports = { getCached };
