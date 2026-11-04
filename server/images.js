import { randomBytes } from 'node:crypto';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

export const MAX_UPLOAD_MB = 15;
export const TOY_WIDTHS = [400, 800, 1600];
export const LOGO_WIDTHS = [96, 192, 384, 768, 1024];
export const HERO_WIDTHS = [400, 800, 1200];

const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp']);
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);

export class ImageRejected extends Error {}

function isHeic(buffer) {
  if (buffer.length < 12 || buffer.toString('latin1', 4, 8) !== 'ftyp') return false;
  return HEIC_BRANDS.has(buffer.toString('latin1', 8, 12));
}

async function readImage(buffer) {
  if (isHeic(buffer)) {
    throw new ImageRejected('HEIC ფორმატი არ მიიღება. iPhone-ზე ფოტო JPEG-ად შეინახე და ხელახლა ატვირთე.');
  }
  let meta;
  try {
    meta = await sharp(buffer).metadata();
  } catch {
    throw new ImageRejected('ეს ფაილი ფოტო არ არის. ატვირთე JPEG, PNG ან WebP.');
  }
  if (!ACCEPTED_FORMATS.has(meta.format)) {
    throw new ImageRejected('ეს ფორმატი არ მიიღება. ატვირთე JPEG, PNG ან WebP.');
  }
  return meta;
}

function widthsFor(sourceWidth, presets) {
  const largest = presets[presets.length - 1];
  const smaller = presets.filter((width) => width < sourceWidth);
  return [...smaller, Math.min(sourceWidth, largest)];
}

export async function saveImage(buffer, dir, presets) {
  const meta = await readImage(buffer);
  const { width, height } = meta.autoOrient ?? meta;
  const widths = widthsFor(width, presets);
  const stem = randomBytes(12).toString('hex');

  mkdirSync(dir, { recursive: true });
  for (const target of widths) {
    await sharp(buffer)
      .autoOrient()
      .resize({ width: target, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(dir, `${stem}-${target}.webp`));
  }
  return { stem, widths: widths.join(','), width, height };
}

export function removeImageFiles(dir, image) {
  for (const width of String(image.widths).split(',')) {
    rmSync(path.join(dir, `${image.stem}-${width}.webp`), { force: true });
  }
}

export function imageView(baseUrl, image) {
  const widths = String(image.widths).split(',').map(Number);
  const url = (width) => `${baseUrl}/${image.stem}-${width}.webp`;
  const middle = widths.find((width) => width >= 800) ?? widths[widths.length - 1];
  return {
    src: url(middle),
    srcset: widths.map((width) => `${url(width)} ${width}w`).join(', '),
    smallest: url(widths[0]),
    width: image.width,
    height: image.height,
  };
}
