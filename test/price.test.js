import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatPrice, parsePrice } from '../server/price.js';

test('parsePrice reads whole and decimal lari as tetri', () => {
  assert.deepEqual(parsePrice('29'), { ok: true, tetri: 2900 });
  assert.deepEqual(parsePrice('29.5'), { ok: true, tetri: 2950 });
  assert.deepEqual(parsePrice('35.50'), { ok: true, tetri: 3550 });
});

test('parsePrice accepts a decimal comma', () => {
  assert.deepEqual(parsePrice('29,50'), { ok: true, tetri: 2950 });
});

test('parsePrice treats an empty value as no price', () => {
  assert.deepEqual(parsePrice(''), { ok: true, tetri: null });
  assert.deepEqual(parsePrice('   '), { ok: true, tetri: null });
  assert.deepEqual(parsePrice(undefined), { ok: true, tetri: null });
});

test('parsePrice does not lose tetri to floating point', () => {
  assert.deepEqual(parsePrice('19.99'), { ok: true, tetri: 1999 });
  assert.deepEqual(parsePrice('1.10'), { ok: true, tetri: 110 });
});

test('parsePrice rejects anything that is not a positive amount', () => {
  for (const value of ['abc', '-5', '1.234', '1,2,3', '12ლარი', '0x10', '1e3']) {
    assert.equal(parsePrice(value).ok, false, value);
  }
});

test('parsePrice rejects amounts too large to be a real price', () => {
  assert.equal(parsePrice('99999999').ok, false);
  assert.equal(parsePrice('999999999999999999999999').ok, false);
  assert.equal(parsePrice('9999999').ok, true);
});

test('formatPrice hides decimals on round amounts', () => {
  assert.equal(formatPrice(2900, 'ka'), '29 ლარი');
  assert.equal(formatPrice(2900, 'en'), '29 GEL');
});

test('formatPrice shows two decimals otherwise', () => {
  assert.equal(formatPrice(3550, 'ka'), '35.50 ლარი');
  assert.equal(formatPrice(3550, 'en'), '35.50 GEL');
  assert.equal(formatPrice(1905, 'en'), '19.05 GEL');
});

test('formatPrice returns an empty string when there is no price', () => {
  assert.equal(formatPrice(null, 'ka'), '');
});
