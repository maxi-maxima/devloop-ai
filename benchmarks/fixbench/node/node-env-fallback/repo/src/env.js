function readPort(env) {
  return Number(env.PORT ?? 3000);
}

module.exports = { readPort };
