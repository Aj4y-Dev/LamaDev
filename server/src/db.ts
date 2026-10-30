import { Pool, PoolClient, QueryResultRow } from 'pg';
import { config } from './config';

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: config.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
});

export type Db = Pool | PoolClient;

/** Safe to run on every start. Needs PostgreSQL 13 or newer (gen_random_uuid is built in). */
const SCHEMA = `
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email varchar(254) unique,
  phone varchar(32) unique,
  password_hash text,
  language varchar(2) not null default 'en',
  created_at timestamptz not null default now()
);
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title varchar(200) not null,
  client_name varchar(200),
  created_at timestamptz not null default now()
);
create index if not exists projects_user_idx on projects(user_id);
create table if not exists estimates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  status varchar(12) not null default 'draft',
  mode varchar(12) not null default 'decimal',
  rates jsonb,
  grand_total numeric(14,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists estimates_project_idx on estimates(project_id);
create table if not exists estimate_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references estimates(id) on delete cascade,
  category_key varchar(64) not null,
  label varchar(200) not null default '',
  length varchar(32),
  breadth varchar(32),
  count integer,
  unit varchar(2) not null default 'ft',
  photo_key text,
  qty numeric(14,3),
  rate_value numeric(14,4),
  rate_type varchar(8),
  amount numeric(14,2),
  sort_index integer not null default 0
);
alter table estimate_items add column if not exists uncertain boolean not null default false;
create index if not exists items_estimate_idx on estimate_items(estimate_id);
`;

export async function migrate(): Promise<void> {
  await pool.query(SCHEMA);
}

export async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function rows<T extends QueryResultRow>(db: Db, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}
export async function one<T extends QueryResultRow>(db: Db, sql: string, params: unknown[] = []): Promise<T | null> {
  return (await db.query<T>(sql, params)).rows[0] ?? null;
}
