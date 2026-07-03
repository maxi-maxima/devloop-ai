import { mkdir } from 'node:fs/promises';
import path from 'node:path';

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped' | 'unsafe';

export interface JobRecord {
  id: number;
  idempotencyKey: string;
  repository: string;
  installationId: number;
  eventType: string;
  triggerSha: string;
  branch?: string;
  status: JobStatus;
  startedAt?: string;
  completedAt?: string;
  diagnosisJson?: string;
  patchSummary?: string;
  prUrl?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateJobInput {
  idempotencyKey: string;
  repository: string;
  installationId: number;
  eventType: string;
  triggerSha: string;
  branch?: string;
  status: JobStatus;
  diagnosisJson?: string;
  patchSummary?: string;
  prUrl?: string;
  failureReason?: string;
}

export interface JobStore {
  initialize(): Promise<void>;
  close(): Promise<void>;
  recordDelivery(deliveryId: string, eventName: string): Promise<boolean>;
  hasDelivery(deliveryId: string): Promise<boolean>;
  createJobIfAbsent(input: CreateJobInput): Promise<{ job: JobRecord; created: boolean }>;
  getJob(id: number): Promise<JobRecord | undefined>;
  updateJob(id: number, changes: Partial<Omit<JobRecord, 'id' | 'idempotencyKey' | 'createdAt'>>): Promise<void>;
  appendJobLog(id: number, message: string): Promise<void>;
  listJobLogs(id: number): Promise<string[]>;
}

export class SqliteJobStore implements JobStore {
  private db?: SQLiteDatabase;

  constructor(private readonly dbPath: string) {}

  async initialize(): Promise<void> {
    await mkdir(path.dirname(this.dbPath), { recursive: true });
    const { DatabaseSync } = await import('node:sqlite');
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS deliveries (
        delivery_id TEXT PRIMARY KEY,
        event_name TEXT NOT NULL,
        received_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS app_installations (
        installation_id INTEGER PRIMARY KEY,
        repository TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        idempotency_key TEXT NOT NULL UNIQUE,
        repository TEXT NOT NULL,
        installation_id INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        trigger_sha TEXT NOT NULL,
        branch TEXT,
        status TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        diagnosis_json TEXT,
        patch_summary TEXT,
        pr_url TEXT,
        failure_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS job_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  async close(): Promise<void> {
    this.db?.close();
    this.db = undefined;
  }

  async recordDelivery(deliveryId: string, eventName: string): Promise<boolean> {
    const db = this.requireDb();
    const now = new Date().toISOString();
    try {
      db.prepare('INSERT INTO deliveries (delivery_id, event_name, received_at) VALUES (?, ?, ?)').run(
        deliveryId,
        eventName,
        now
      );
      return true;
    } catch (error) {
      if (error instanceof Error && /constraint/i.test(error.message)) {
        return false;
      }
      throw error;
    }
  }

  async hasDelivery(deliveryId: string): Promise<boolean> {
    const row = this.requireDb().prepare('SELECT delivery_id FROM deliveries WHERE delivery_id = ?').get(deliveryId);
    return Boolean(row);
  }

  async createJobIfAbsent(input: CreateJobInput): Promise<{ job: JobRecord; created: boolean }> {
    const db = this.requireDb();
    const existing = db.prepare('SELECT * FROM jobs WHERE idempotency_key = ?').get(input.idempotencyKey);
    if (existing) {
      return { job: rowToJob(existing as JobRow), created: false };
    }

    const now = new Date().toISOString();
    const result = db
      .prepare(
        `INSERT INTO jobs (
          idempotency_key, repository, installation_id, event_type, trigger_sha, branch, status,
          diagnosis_json, patch_summary, pr_url, failure_reason, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.idempotencyKey,
        input.repository,
        input.installationId,
        input.eventType,
        input.triggerSha,
        input.branch ?? null,
        input.status,
        input.diagnosisJson ?? null,
        input.patchSummary ?? null,
        input.prUrl ?? null,
        input.failureReason ?? null,
        now,
        now
      );
    const job = await this.getJob(Number(result.lastInsertRowid));
    if (!job) {
      throw new Error('Failed to read queued DevLoop job after insert.');
    }
    return { job, created: true };
  }

  async getJob(id: number): Promise<JobRecord | undefined> {
    const row = this.requireDb().prepare('SELECT * FROM jobs WHERE id = ?').get(id);
    return row ? rowToJob(row as JobRow) : undefined;
  }

  async updateJob(id: number, changes: Partial<Omit<JobRecord, 'id' | 'idempotencyKey' | 'createdAt'>>): Promise<void> {
    const db = this.requireDb();
    const existing = await this.getJob(id);
    if (!existing) {
      throw new Error(`Job not found: ${id}`);
    }

    const updated = { ...existing, ...changes, updatedAt: new Date().toISOString() };
    db.prepare(
      `UPDATE jobs SET
        repository = ?, installation_id = ?, event_type = ?, trigger_sha = ?, branch = ?, status = ?,
        started_at = ?, completed_at = ?, diagnosis_json = ?, patch_summary = ?, pr_url = ?,
        failure_reason = ?, updated_at = ?
      WHERE id = ?`
    ).run(
      updated.repository,
      updated.installationId,
      updated.eventType,
      updated.triggerSha,
      updated.branch ?? null,
      updated.status,
      updated.startedAt ?? null,
      updated.completedAt ?? null,
      updated.diagnosisJson ?? null,
      updated.patchSummary ?? null,
      updated.prUrl ?? null,
      updated.failureReason ?? null,
      updated.updatedAt,
      id
    );
  }

  async appendJobLog(id: number, message: string): Promise<void> {
    this.requireDb()
      .prepare('INSERT INTO job_logs (job_id, message, created_at) VALUES (?, ?, ?)')
      .run(id, message, new Date().toISOString());
  }

  async listJobLogs(id: number): Promise<string[]> {
    return this.requireDb()
      .prepare('SELECT message FROM job_logs WHERE job_id = ? ORDER BY id ASC')
      .all(id)
      .map((row) => String((row as { message: string }).message));
  }

  private requireDb(): SQLiteDatabase {
    if (!this.db) {
      throw new Error('Job store has not been initialized.');
    }
    return this.db;
  }
}

interface SQLiteDatabase {
  exec(sql: string): unknown;
  close(): void;
  prepare(sql: string): SQLiteStatement;
}

interface SQLiteStatement {
  run(...params: unknown[]): { lastInsertRowid: number | bigint };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export function createMemoryJobStore(): JobStore {
  const deliveries = new Map<string, string>();
  const jobs = new Map<number, JobRecord>();
  const idempotency = new Map<string, number>();
  const logs = new Map<number, string[]>();
  let nextId = 1;

  return {
    async initialize() {},
    async close() {},
    async recordDelivery(deliveryId, eventName) {
      if (deliveries.has(deliveryId)) {
        return false;
      }
      deliveries.set(deliveryId, eventName);
      return true;
    },
    async hasDelivery(deliveryId) {
      return deliveries.has(deliveryId);
    },
    async createJobIfAbsent(input) {
      const existingId = idempotency.get(input.idempotencyKey);
      if (existingId) {
        return { job: jobs.get(existingId)!, created: false };
      }
      const now = new Date().toISOString();
      const job: JobRecord = {
        id: nextId++,
        idempotencyKey: input.idempotencyKey,
        repository: input.repository,
        installationId: input.installationId,
        eventType: input.eventType,
        triggerSha: input.triggerSha,
        branch: input.branch,
        status: input.status,
        diagnosisJson: input.diagnosisJson,
        patchSummary: input.patchSummary,
        prUrl: input.prUrl,
        failureReason: input.failureReason,
        createdAt: now,
        updatedAt: now
      };
      jobs.set(job.id, job);
      idempotency.set(job.idempotencyKey, job.id);
      return { job, created: true };
    },
    async getJob(id) {
      return jobs.get(id);
    },
    async updateJob(id, changes) {
      const job = jobs.get(id);
      if (!job) {
        throw new Error(`Job not found: ${id}`);
      }
      jobs.set(id, { ...job, ...changes, updatedAt: new Date().toISOString() });
    },
    async appendJobLog(id, message) {
      logs.set(id, [...(logs.get(id) ?? []), message]);
    },
    async listJobLogs(id) {
      return logs.get(id) ?? [];
    }
  };
}

interface JobRow {
  id: number;
  idempotency_key: string;
  repository: string;
  installation_id: number;
  event_type: string;
  trigger_sha: string;
  branch?: string | null;
  status: JobStatus;
  started_at?: string | null;
  completed_at?: string | null;
  diagnosis_json?: string | null;
  patch_summary?: string | null;
  pr_url?: string | null;
  failure_reason?: string | null;
  created_at: string;
  updated_at: string;
}

function rowToJob(row: JobRow): JobRecord {
  return {
    id: Number(row.id),
    idempotencyKey: row.idempotency_key,
    repository: row.repository,
    installationId: Number(row.installation_id),
    eventType: row.event_type,
    triggerSha: row.trigger_sha,
    branch: row.branch ?? undefined,
    status: row.status,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    diagnosisJson: row.diagnosis_json ?? undefined,
    patchSummary: row.patch_summary ?? undefined,
    prUrl: row.pr_url ?? undefined,
    failureReason: row.failure_reason ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
