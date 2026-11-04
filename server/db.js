import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS toys (
    id INTEGER PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name_ka TEXT NOT NULL,
    name_en TEXT NOT NULL DEFAULT '',
    description_ka TEXT NOT NULL DEFAULT '',
    description_en TEXT NOT NULL DEFAULT '',
    age_ka TEXT NOT NULL DEFAULT '',
    age_en TEXT NOT NULL DEFAULT '',
    price_tetri INTEGER,
    published INTEGER NOT NULL DEFAULT 1,
    featured INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS toy_images (
    id INTEGER PRIMARY KEY,
    toy_id INTEGER NOT NULL REFERENCES toys(id) ON DELETE CASCADE,
    stem TEXT NOT NULL,
    widths TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    sort_order INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS site_text (
    key TEXT PRIMARY KEY,
    value_ka TEXT NOT NULL DEFAULT '',
    value_en TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    password_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL
  );
`;

export function openDatabase(dataDir) {
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, 'geppetto.sqlite'));
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}

export function getSetting(db, key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? '';
}

export function setSetting(db, key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}
