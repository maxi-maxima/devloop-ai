export interface Settings {
  enabled: boolean;
}

export function parseSettings(text: string): Settings {
  return JSON.parse(text) as Settings;
}
