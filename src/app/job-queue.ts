import { CreateJobInput, JobRecord, JobStore } from './job-store.js';

export class AppJobQueue {
  constructor(private readonly store: JobStore) {}

  async enqueue(input: CreateJobInput): Promise<{ job: JobRecord; created: boolean }> {
    return this.store.createJobIfAbsent(input);
  }
}
