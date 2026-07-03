const users = [{ id: 1, name: 'Ada' }];

function findUser(id) {
  const user = users.find((candidate) => candidate.id === id);
  return user ? user.id : undefined;
}

module.exports = { findUser };
