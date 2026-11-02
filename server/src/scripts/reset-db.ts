import { pool } from '../db';

/** Deletes every table this server uses. Development only: it removes ALL data in them. */
async function main(): Promise<void> {
  if (!process.argv.includes('--yes')) {
    console.log('This DELETES all estimator data in the database from DATABASE_URL.');
    console.log('To go ahead, run: pnpm db:reset --yes');
    process.exit(1);
  }
  await pool.query('drop table if exists estimate_items, estimates, projects, users cascade');
  console.log('Done. Start the server again and the tables will be recreated.');
  await pool.end();
}
void main();
