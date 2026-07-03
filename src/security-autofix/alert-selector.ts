import { SecurityAlert } from './sarif-parser.js';

export interface AlertSelectionOptions {
  ruleId?: string;
  alertIndex?: number;
  severity?: string;
  maxAlerts?: number;
}

export function selectSarifAlerts(alerts: SecurityAlert[], options: AlertSelectionOptions): SecurityAlert[] {
  let selected = alerts;
  if (options.ruleId) {
    selected = selected.filter((alert) => alert.ruleId === options.ruleId);
  }
  if (options.severity) {
    selected = selected.filter((alert) => alert.severity === options.severity);
  }
  if (options.alertIndex !== undefined) {
    selected = selected[options.alertIndex] ? [selected[options.alertIndex]] : [];
  }
  return selected.slice(0, options.maxAlerts ?? selected.length);
}
