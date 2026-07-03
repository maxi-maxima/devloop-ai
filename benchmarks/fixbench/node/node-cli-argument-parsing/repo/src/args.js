function parseArgs(args) {
  const parsed = {};
  for (const arg of args) {
    if (arg.startsWith('--')) {
      parsed[arg.slice(2)] = true;
    }
  }
  return parsed;
}

module.exports = { parseArgs };
