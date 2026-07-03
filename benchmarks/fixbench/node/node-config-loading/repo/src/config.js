function loadConfig(userConfig) {
  return {
    telemetry: userConfig.telemetry || true
  };
}

module.exports = { loadConfig };
