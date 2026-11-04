import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { getSetting } from '../server/db.js';
import { anonymous, loggedIn, startSite, visibleText } from './helpers.js';

const start = (t) => startSite(t, { seed: true });

test('first start fills the site with the demo toys', async (t) => {
  const site = await start(t);
  const list = await anonymous(site).get('/toys');
  assert.equal((list.text.match(/class="shelf__item"/g) ?? []).length, 10);
  assert.match(list.text, /ხის ანბანის თავსატეხი/);

  const en = visibleText((await anonymous(site).get('/en/toys')).text);
  assert.match(en, /Wooden Alphabet Puzzle/);
  assert.match(en, /29 GEL/);
  assert.match(en, /144 GEL/);
  assert.equal((en.match(/\d+ GEL/g) ?? []).length, 2);
});

test('demo toys have a photo and no invented description or age', async (t) => {
  const site = await start(t);
  const row = site.db.prepare('SELECT COUNT(*) AS n FROM toys WHERE description_ka <> \'\' OR age_ka <> \'\' OR description_en <> \'\' OR age_en <> \'\'').get();
  assert.equal(row.n, 0);
  const withoutPhoto = site.db.prepare('SELECT COUNT(*) AS n FROM toys WHERE id NOT IN (SELECT toy_id FROM toy_images)').get();
  assert.equal(withoutPhoto.n, 0);
});

test('the home page uses the brand text from Instagram and six featured toys', async (t) => {
  const site = await start(t);
  const ka = await anonymous(site).get('/');
  const text = visibleText(ka.text);
  assert.match(text, /ყველა მშობელი ცოტათი ჯეპეტოა/);
  assert.match(text, /ხის განმავითარებელი სათამაშოები/);
  assert.match(text, /ევროპული სტანდარტი - EN 71/);
  assert.match(text, /Geppetto/);
  assert.equal((ka.text.match(/class="shelf__item"/g) ?? []).length, 6);

  const en = visibleText((await anonymous(site).get('/en')).text);
  assert.match(en, /Every parent is a little bit Geppetto/);
  assert.match(en, /European standard - EN 71/);
});

test('only the Instagram link is filled in the contact details', async (t) => {
  const site = await start(t);
  const contact = await anonymous(site).get('/contact');
  assert.match(contact.text, /https:\/\/www\.instagram\.com\/geppetto\.kids\//);
  assert.doesNotMatch(contact.text, /tel:|mailto:|facebook\.com/);
});

test('the logo and hero photo are in place after seeding', async (t) => {
  const site = await start(t);
  const home = await anonymous(site).get('/');
  assert.match(home.text, /class="hero__logo"/);
  assert.match(home.text, /class="hero__photo"/);
  assert.match((await anonymous(site).get('/toys')).text, /class="site-logo"/);
});

test('the seeded logo is the owner\'s large logo with transparent corners', async (t) => {
  const site = await start(t);
  const { stem, widths } = JSON.parse(getSetting(site.db, 'logo'));
  assert.ok(widths.split(',').map(Number).includes(768), widths);
  const dir = path.join(site.dataDir, 'uploads', 'brand');
  const { data, info } = await sharp(readFileSync(path.join(dir, `${stem}-768.webp`))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(data[3], 0, 'top-left corner should be transparent');
  assert.equal(data[(info.width * (info.height >> 1) + (info.width >> 1)) * info.channels + 3], 255, 'centre should be solid');
});

test('restarting does not bring deleted demo toys back', async (t) => {
  const first = await start(t);
  const agent = await loggedIn(first);
  const ids = first.db.prepare('SELECT id FROM toys').all().map((row) => row.id);
  for (const id of ids) {
    await agent.post(`/admin/toys/${id}/delete`).type('form').send({});
  }
  first.close();

  const second = await start(t);
  assert.equal(second.db.prepare('SELECT COUNT(*) AS n FROM toys').get().n, 0);
});

test('changes survive a restart', async (t) => {
  const first = await start(t);
  const agent = await loggedIn(first);
  await agent.post('/admin/toys').type('form').send({ name_ka: 'დარჩენილი', name_en: 'Kept', price: '12', published: 'on' });
  await agent.post('/admin/contact').type('form').send({ phone: '+995 555 98 76 54' });
  first.close();

  const second = await start(t);
  assert.match((await anonymous(second).get('/en/toys')).text, /Kept/);
  assert.match((await anonymous(second).get('/contact')).text, /555 98 76 54/);
});
