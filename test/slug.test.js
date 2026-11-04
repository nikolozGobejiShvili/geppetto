import assert from 'node:assert/strict';
import { test } from 'node:test';
import { slugify, uniqueSlug } from '../server/slug.js';

test('slugify lowercases Latin names and joins words with hyphens', () => {
  assert.equal(slugify('Activity Walker'), 'activity-walker');
  assert.equal(slugify('  Set of 4 Toys! '), 'set-of-4-toys');
});

test('slugify transliterates Georgian names', () => {
  assert.equal(slugify('ხის ეტლი'), 'khis-etli');
  assert.equal(slugify('ჯეპეტო'), 'jepeto');
});

test('slugify falls back when nothing usable remains', () => {
  assert.equal(slugify('!!!'), 'toy');
  assert.equal(slugify(''), 'toy');
});

test('uniqueSlug appends a number to a taken slug', () => {
  const taken = new Set(['walker', 'walker-2']);
  assert.equal(uniqueSlug('walker', (slug) => taken.has(slug)), 'walker-3');
  assert.equal(uniqueSlug('blocks', (slug) => taken.has(slug)), 'blocks');
});
