import { parseSettings } from './index';

const settings = parseSettings('{"enabled":true}');
if (settings.enabled !== true) {
  throw new Error('expected enabled setting');
}

try {
  parseSettings('{"enabled":"yes"}');
  throw new Error('expected validation failure');
} catch (error) {
  if (!(error instanceof Error) || !/Invalid settings/.test(error.message)) {
    throw error;
  }
}
