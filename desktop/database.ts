import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { type Database } from 'sql.js';
import { DEFAULT_SETTINGS } from '../src/settings/defaults';
import type { Settings } from '../src/platform/types';
import { validateSaveRecord, type SaveRecord } from '../src/storage/validate';

function wasmFile(): string {
  const unpacked = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  const dev = path.join(app.getAppPath(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  return fs.existsSync(unpacked) ? unpacked : dev;
}

export class AppDatabase {
  private db: Database | null = null;
  private file = '';

  async open(): Promise<void> {
    const SQL = await initSqlJs({ locateFile: () => wasmFile() });
    this.file = path.join(app.getPath('userData'), 'monopoly.sqlite');
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    this.db = fs.existsSync(this.file) ? new SQL.Database(fs.readFileSync(this.file)) : new SQL.Database();
    this.db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    this.db.run(`CREATE TABLE IF NOT EXISTS saves (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mode TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      payload TEXT NOT NULL
    )`);
    this.persist();
  }

  getSettings(): Settings {
    const row = this.query(`SELECT value FROM settings WHERE key = 'preferences'`);
    if (!row[0]) return { ...DEFAULT_SETTINGS };
    try {
      return { ...DEFAULT_SETTINGS, ...(JSON.parse(String(row[0].value)) as Partial<Settings>) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  setSettings(settings: Settings): Settings {
    const next = { ...DEFAULT_SETTINGS, ...settings, playerName: settings.playerName.slice(0, 16) || 'Player' };
    this.db?.run(`INSERT INTO settings (key, value) VALUES ('preferences', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`, [JSON.stringify(next)]);
    this.persist();
    return next;
  }

  listSaves(): Array<Omit<SaveRecord, 'state' | 'sessions'>> {
    return this.query(`SELECT id, name, mode, updated_at FROM saves ORDER BY updated_at DESC`).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      mode: row.mode === 'lan' ? 'lan' : 'solo',
      updatedAt: Number(row.updated_at),
    }));
  }

  saveGame(record: SaveRecord): { ok: boolean; error?: string } {
    const parsed = validateSaveRecord(record);
    if (!parsed.ok) return parsed;
    const payload = JSON.stringify({ state: parsed.save.state, sessions: parsed.save.sessions ?? {} });
    if (payload.length > 2_000_000) return { ok: false, error: 'That save is too large' };
    this.db?.run(
      `INSERT INTO saves (id, name, mode, updated_at, payload) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, mode = excluded.mode, updated_at = excluded.updated_at, payload = excluded.payload`,
      [parsed.save.id, parsed.save.name, parsed.save.mode, parsed.save.updatedAt, payload],
    );
    this.persist();
    return { ok: true };
  }

  loadGame(id: string): { ok: true; save: SaveRecord } | { ok: false; error: string } {
    const rows = this.query(`SELECT id, name, mode, updated_at, payload FROM saves WHERE id = ?`, [id]);
    if (!rows[0]) return { ok: false, error: 'Save not found' };
    try {
      const payload = JSON.parse(String(rows[0].payload)) as { state?: unknown; sessions?: Record<string, string> };
      return validateSaveRecord({
        id: String(rows[0].id),
        name: String(rows[0].name),
        mode: rows[0].mode,
        updatedAt: Number(rows[0].updated_at),
        state: payload.state,
        sessions: payload.sessions,
      });
    } catch {
      return { ok: false, error: 'Save could not be read' };
    }
  }

  deleteSave(id: string): void {
    this.db?.run(`DELETE FROM saves WHERE id = ?`, [id]);
    this.persist();
  }

  private query(sql: string, params: Array<string | number> = []): Array<Record<string, string | number | Uint8Array | null>> {
    if (!this.db) return [];
    const statement = this.db.prepare(sql);
    statement.bind(params);
    const rows: Array<Record<string, string | number | Uint8Array | null>> = [];
    while (statement.step()) rows.push(statement.getAsObject());
    statement.free();
    return rows;
  }

  private persist(): void {
    if (!this.db || !this.file) return;
    fs.writeFileSync(this.file, Buffer.from(this.db.export()));
  }
}
