import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { CreateGoalRequest, Goal } from '../../../contracts/goals.ts';

export function openGoalStore(filename: string) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  const database = new DatabaseSync(filename);
  try {
    database.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;');
    const version = database.prepare('PRAGMA user_version').get() as { user_version: number };
    if (version.user_version > 1) throw new Error('Database version is newer than this application.');
    if (version.user_version === 0) {
      database.exec(`
        BEGIN IMMEDIATE;
        CREATE TABLE goals (
          id TEXT PRIMARY KEY,
          service_id TEXT NOT NULL,
          goal TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status = 'received'),
          created_at TEXT NOT NULL
        ) STRICT;
        PRAGMA user_version = 1;
        COMMIT;
      `);
    }
  } catch (error) {
    database.close();
    throw error;
  }
  const insert = database.prepare('INSERT INTO goals (id, service_id, goal, status, created_at) VALUES (?, ?, ?, ?, ?)');
  const select = database.prepare('SELECT id, service_id AS serviceId, goal, status, created_at AS createdAt FROM goals WHERE id = ?');
  return {
    create(input: CreateGoalRequest): Goal {
      const record: Goal = { ...input, id: `goal_${randomUUID()}`, status: 'received', createdAt: new Date().toISOString() };
      insert.run(record.id, record.serviceId, record.goal, record.status, record.createdAt);
      return record;
    },
    get(id: string): Goal | undefined {
      const row = select.get(id);
      return row ? { ...row } as unknown as Goal : undefined;
    },
    close() { database.close(); }
  };
}

export type GoalStore = ReturnType<typeof openGoalStore>;
