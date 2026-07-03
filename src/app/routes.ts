import { JobStore } from './job-store.js';
import { routeGitHubEvent, EventRouteResult } from './event-router.js';
import { verifyGitHubSignature } from './signature.js';

export interface WebhookRouteInput {
  body: Buffer;
  headers: Record<string, string | string[] | undefined>;
  webhookSecret: string;
  store: JobStore;
}

export interface WebhookRouteResponse {
  status: number;
  result: EventRouteResult | { action: 'duplicate-delivery' } | { action: 'error'; message: string };
}

export async function handleGitHubWebhookRequest(input: WebhookRouteInput): Promise<WebhookRouteResponse> {
  const eventName = header(input.headers, 'x-github-event');
  const deliveryId = header(input.headers, 'x-github-delivery');
  const signature = header(input.headers, 'x-hub-signature-256');

  if (!eventName || !deliveryId) {
    return { status: 400, result: { action: 'error', message: 'Missing GitHub event or delivery headers.' } };
  }
  if (!verifyGitHubSignature({ secret: input.webhookSecret, payload: input.body, signatureHeader: signature })) {
    return { status: 401, result: { action: 'error', message: 'Invalid GitHub webhook signature.' } };
  }

  const recorded = await input.store.recordDelivery(deliveryId, eventName);
  if (!recorded) {
    return { status: 202, result: { action: 'duplicate-delivery' } };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(input.body.toString('utf8'));
  } catch {
    return { status: 400, result: { action: 'error', message: 'Webhook payload is not valid JSON.' } };
  }

  try {
    const result = await routeGitHubEvent({ eventName, deliveryId, payload, store: input.store });
    return { status: 202, result };
  } catch (error) {
    return {
      status: 400,
      result: { action: 'error', message: error instanceof Error ? error.message : String(error) }
    };
  }
}

function header(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}
