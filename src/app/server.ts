import http from 'node:http';
import { loadAppConfigFromEnv } from './config.js';
import { SqliteJobStore, JobStore } from './job-store.js';
import { handleGitHubWebhookRequest } from './routes.js';

export interface StartAppServerOptions {
  port?: number;
  databasePath?: string;
  webhookSecret?: string;
  store?: JobStore;
}

export async function startAppServer(options: StartAppServerOptions = {}): Promise<http.Server> {
  const config = loadAppConfigFromEnv();
  const store = options.store ?? new SqliteJobStore(options.databasePath ?? config.databasePath);
  await store.initialize();
  const webhookSecret = options.webhookSecret ?? config.webhookSecret;

  const server = http.createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/healthz') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    if (request.method === 'POST' && request.url === '/webhooks/github') {
      const body = await readRequestBody(request);
      const result = await handleGitHubWebhookRequest({
        body,
        headers: request.headers,
        webhookSecret,
        store
      });
      response.writeHead(result.status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(result.result));
      return;
    }

    response.writeHead(404, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'not found' }));
  });

  await new Promise<void>((resolve) => server.listen(options.port ?? config.port, resolve));
  server.on('close', () => {
    void store.close();
  });
  return server;
}

async function readRequestBody(request: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
