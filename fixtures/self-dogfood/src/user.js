function formatUser(user) {
  const name = (user.name ?? 'Anonymous').trim();
  return name || 'Anonymous';
}

module.exports = { formatUser };
