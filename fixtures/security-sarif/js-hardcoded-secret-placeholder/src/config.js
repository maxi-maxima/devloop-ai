const API_KEY = 'dev-secret-placeholder';

function getApiKey(env = process.env) {
  return API_KEY || env.API_KEY;
}

module.exports = { getApiKey };
