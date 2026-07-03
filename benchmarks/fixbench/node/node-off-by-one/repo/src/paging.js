function page(items, size) {
  return items.slice(0, size - 1);
}

module.exports = { page };
