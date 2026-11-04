import { parsePrice } from './price.js';
import { slugify, uniqueSlug } from './slug.js';

const TEXT_FIELDS = ['name_ka', 'name_en', 'description_ka', 'description_en', 'age_ka', 'age_en'];
const SWAPPABLE_DIRECTIONS = { up: -1, down: 1 };
const TOGGLES = new Set(['published', 'featured']);

export function readToyForm(body) {
  const values = {};
  for (const field of TEXT_FIELDS) values[field] = String(body[field] ?? '').trim();
  values.price = String(body.price ?? '').trim();
  values.published = body.published ? 1 : 0;
  values.featured = body.featured ? 1 : 0;
  return values;
}

export function validateToy(values) {
  const errors = [];
  if (!values.name_ka) errors.push('ჩაწერე სათამაშოს ქართული სახელი.');
  if (!parsePrice(values.price).ok) errors.push('ფასი რიცხვით ჩაწერე, მაგალითად 29 ან 35.50.');
  return errors;
}

function nextOrder(db, table, where = '', ...params) {
  const row = db.prepare(`SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM ${table} ${where}`).get(...params);
  return row.next;
}

export function createToy(db, values) {
  const slug = uniqueSlug(slugify(values.name_en || values.name_ka), (candidate) =>
    Boolean(db.prepare('SELECT 1 FROM toys WHERE slug = ?').get(candidate)),
  );
  const result = db
    .prepare(
      `INSERT INTO toys (slug, name_ka, name_en, description_ka, description_en, age_ka, age_en, price_tetri, published, featured, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      slug,
      values.name_ka,
      values.name_en,
      values.description_ka,
      values.description_en,
      values.age_ka,
      values.age_en,
      parsePrice(values.price).tetri,
      values.published,
      values.featured,
      nextOrder(db, 'toys'),
    );
  return Number(result.lastInsertRowid);
}

export function updateToy(db, id, values) {
  db.prepare(
    `UPDATE toys SET name_ka = ?, name_en = ?, description_ka = ?, description_en = ?, age_ka = ?, age_en = ?,
       price_tetri = ?, published = ?, featured = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(
    values.name_ka,
    values.name_en,
    values.description_ka,
    values.description_en,
    values.age_ka,
    values.age_en,
    parsePrice(values.price).tetri,
    values.published,
    values.featured,
    id,
  );
}

export function getToy(db, id) {
  return db.prepare('SELECT * FROM toys WHERE id = ?').get(id);
}

export function getPublishedToyBySlug(db, slug) {
  return db.prepare('SELECT * FROM toys WHERE slug = ? AND published = 1').get(slug);
}

export function listToys(db) {
  return db.prepare('SELECT * FROM toys ORDER BY sort_order').all();
}

export function listPublishedToys(db) {
  return db.prepare('SELECT * FROM toys WHERE published = 1 ORDER BY sort_order').all();
}

export function listHomeToys(db, limit) {
  const featured = db
    .prepare('SELECT * FROM toys WHERE published = 1 AND featured = 1 ORDER BY sort_order LIMIT ?')
    .all(limit);
  if (featured.length > 0) return featured;
  return db.prepare('SELECT * FROM toys WHERE published = 1 ORDER BY sort_order LIMIT ?').all(limit);
}

export function deleteToy(db, id) {
  db.prepare('DELETE FROM toys WHERE id = ?').run(id);
}

export function toggleToy(db, id, field) {
  if (!TOGGLES.has(field)) return;
  db.prepare(`UPDATE toys SET ${field} = 1 - ${field}, updated_at = datetime('now') WHERE id = ?`).run(id);
}

function swapWithNeighbour(db, table, rows, id, direction) {
  const step = SWAPPABLE_DIRECTIONS[direction];
  if (!step) return;
  const index = rows.findIndex((row) => row.id === id);
  const neighbour = rows[index + step];
  if (index === -1 || !neighbour) return;
  const update = db.prepare(`UPDATE ${table} SET sort_order = ? WHERE id = ?`);
  update.run(neighbour.sort_order, id);
  update.run(rows[index].sort_order, neighbour.id);
}

export function moveToy(db, id, direction) {
  swapWithNeighbour(db, 'toys', listToys(db), id, direction);
}

export function listImages(db, toyId) {
  return db.prepare('SELECT * FROM toy_images WHERE toy_id = ? ORDER BY sort_order').all(toyId);
}

export function getImage(db, toyId, imageId) {
  return db.prepare('SELECT * FROM toy_images WHERE id = ? AND toy_id = ?').get(imageId, toyId);
}

export function addImage(db, toyId, image) {
  db.prepare('INSERT INTO toy_images (toy_id, stem, widths, width, height, sort_order) VALUES (?, ?, ?, ?, ?, ?)').run(
    toyId,
    image.stem,
    image.widths,
    image.width,
    image.height,
    nextOrder(db, 'toy_images', 'WHERE toy_id = ?', toyId),
  );
}

export function deleteImage(db, imageId) {
  db.prepare('DELETE FROM toy_images WHERE id = ?').run(imageId);
}

export function moveImage(db, toyId, imageId, direction) {
  swapWithNeighbour(db, 'toy_images', listImages(db, toyId), imageId, direction);
}

export function makeCover(db, toyId, imageId) {
  const first = db.prepare('SELECT MIN(sort_order) AS lowest FROM toy_images WHERE toy_id = ?').get(toyId);
  db.prepare('UPDATE toy_images SET sort_order = ? WHERE id = ? AND toy_id = ?').run(first.lowest - 1, imageId, toyId);
}
