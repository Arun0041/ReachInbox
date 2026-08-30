import { getDb, closeDb } from '../config/db';
import { applySchema } from './schema';

async function main(): Promise<void> {
  const db = getDb();
  await applySchema(db);
  console.log('[db] schema applied');
  await closeDb();
}

main().catch((err) => {
  console.error('[db] migration failed:', err);
  process.exit(1);
});