import { DatabaseSync, type SqliteDatabase } from './sqlite.js';

export function openDatabase(dbPath: string): SqliteDatabase {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const row = db.prepare(`SELECT value FROM meta WHERE key = 'schema_version'`).get() as
    | { value: string }
    | undefined;
  if (!row) {
    db.close();
    throw new Error(`${dbPath} is not a lennys-wisdom database (missing meta table)`);
  }
  return db;
}
