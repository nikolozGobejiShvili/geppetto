import { FIXED } from './i18n.js';

const AMOUNT = /^(\d{1,7})(?:[.,](\d{1,2}))?$/;

export function parsePrice(value) {
  const text = String(value ?? '').trim();
  if (text === '') return { ok: true, tetri: null };
  const match = AMOUNT.exec(text);
  if (!match) return { ok: false };
  const [, lari, tetri = ''] = match;
  return { ok: true, tetri: Number(lari) * 100 + Number(tetri.padEnd(2, '0')) };
}

export function priceToInput(tetri) {
  if (tetri === null || tetri === undefined) return '';
  return amount(tetri);
}

export function formatPrice(tetri, lang) {
  if (tetri === null || tetri === undefined) return '';
  return `${amount(tetri)} ${FIXED[lang].currency}`;
}

function amount(tetri) {
  const lari = Math.floor(tetri / 100);
  const rest = tetri % 100;
  return rest === 0 ? String(lari) : `${lari}.${String(rest).padStart(2, '0')}`;
}
