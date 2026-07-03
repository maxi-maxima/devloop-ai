function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function slugify(value) {
  return value.toLowerCase().replace(/\s+/g, '-');
}

module.exports = { capitalize };
