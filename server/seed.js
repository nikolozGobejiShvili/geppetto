import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT } from './config.js';
import { getSetting, setSetting } from './db.js';
import { HERO_WIDTHS, LOGO_WIDTHS, saveImage, TOY_WIDTHS } from './images.js';
import { addImage, createToy } from './toys.js';

const SEED_IMAGES = path.join(PROJECT_ROOT, 'seed', 'images');

// Demo toys from the Instagram screenshots. Names are placeholders, and only the
// prices visible in the posts are filled in.
const DEMO_TOYS = [
  { file: 'toy-01.jpg', name_ka: 'აქტივობების ხის სასეირნო', name_en: 'Activity Walker', featured: 1 },
  { file: 'toy-02.jpg', name_ka: 'ფერადი ხის კუბიკები', name_en: 'Colorful Wooden Blocks' },
  { file: 'toy-03.jpg', name_ka: 'ხის სამზარეულო-სასეირნო', name_en: 'Wooden Kitchen Walker', featured: 1 },
  { file: 'toy-04.jpg', name_ka: 'ვარდისფერი ხის ეტლი', name_en: 'Pink Wooden Doll Pram', featured: 1 },
  { file: 'toy-05.jpg', name_ka: '4 სათამაშოს ნაკრები', name_en: 'Set of 4 Toys', price: '144', featured: 1 },
  { file: 'toy-06.jpg', name_ka: 'ხის ანბანის თავსატეხი', name_en: 'Wooden Alphabet Puzzle', price: '29', featured: 1 },
  { file: 'toy-07.jpg', name_ka: 'წითელი ხის ეტლი', name_en: 'Red Wooden Doll Pram' },
  { file: 'toy-08.jpg', name_ka: 'გეომეტრიული ფიგურების თავსატეხი', name_en: 'Geometric Shapes Puzzle', featured: 1 },
  { file: 'toy-09.jpg', name_ka: 'ხის დაფა და სასწავლო ნაკრები', name_en: 'Wooden Chalkboard Learning Set' },
  { file: 'toy-10.jpg', name_ka: 'სიტყვების ასაწყობი ბლოკები და ბარათები', name_en: 'Word-Building Blocks and Cards' },
];

export async function seedOnce(db, uploadsDir) {
  if (getSetting(db, 'seeded')) return;

  for (const toy of DEMO_TOYS) {
    const id = createToy(db, {
      name_ka: toy.name_ka,
      name_en: toy.name_en,
      description_ka: '',
      description_en: '',
      age_ka: '',
      age_en: '',
      price: toy.price ?? '',
      published: 1,
      featured: toy.featured ?? 0,
    });
    const buffer = readFileSync(path.join(SEED_IMAGES, toy.file));
    addImage(db, id, await saveImage(buffer, path.join(uploadsDir, 'toys'), TOY_WIDTHS));
  }

  const brandDir = path.join(uploadsDir, 'brand');
  const logo = await saveImage(readFileSync(path.join(SEED_IMAGES, 'logo.png')), brandDir, LOGO_WIDTHS);
  const hero = await saveImage(readFileSync(path.join(SEED_IMAGES, 'hero.jpg')), brandDir, HERO_WIDTHS);
  setSetting(db, 'logo', JSON.stringify(logo));
  setSetting(db, 'hero', JSON.stringify(hero));
  setSetting(db, 'instagram_url', 'https://www.instagram.com/geppetto.kids/');
  setSetting(db, 'seeded', '1');
}
