function formatUser(user) {
  const name = user.name.trim();
  return name || 'Anonymous';
}

module.exports = { formatUser };
