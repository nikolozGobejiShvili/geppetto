import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { anonymous, createToy, loggedIn, pngBuffer, startSite } from './helpers.js';

function toyFiles(site) {
  const dir = path.join(site.dataDir, 'uploads', 'toys');
  return existsSync(dir) ? readdirSync(dir) : [];
}

// Reads through a buffer: sharp keeps files it opened by path locked on Windows.
function savedMetadata(site, file) {
  return sharp(readFileSync(path.join(site.dataDir, 'uploads', 'toys', file))).metadata();
}

function upload(agent, id, buffer, filename = 'photo.png') {
  return agent.post(`/admin/toys/${id}/images`).attach('images', buffer, filename);
}

function imageIds(html, id) {
  return [...html.matchAll(new RegExp(`/admin/toys/${id}/images/(\\d+)/delete`, 'g'))].map((match) => Number(match[1]));
}

test('a large photo becomes WebP files of 400, 800 and 1600 pixels', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const id = await createToy(agent);
  const response = await upload(agent, id, await pngBuffer({ width: 2000, height: 1500 }));
  assert.equal(response.status, 302);

  const files = toyFiles(site);
  assert.equal(files.length, 3);
  const widths = await Promise.all(
    files.map(async (file) => {
      const meta = await savedMetadata(site, file);
      assert.equal(meta.format, 'webp');
      return meta.width;
    }),
  );
  assert.deepEqual(widths.sort((a, b) => a - b), [400, 800, 1600]);
});

test('a small photo is not enlarged', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const id = await createToy(agent);
  await upload(agent, id, await pngBuffer({ width: 195, height: 220 }));
  const files = toyFiles(site);
  assert.equal(files.length, 1);
  const meta = await savedMetadata(site, files[0]);
  assert.equal(meta.width, 195);
});

test('photo metadata such as EXIF is removed and rotation is applied', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const id = await createToy(agent);
  const withExif = await sharp({ create: { width: 300, height: 200, channels: 3, background: '#2F5478' } })
    .withMetadata({ orientation: 6, exif: { IFD0: { Copyright: 'secret' } } })
    .jpeg()
    .toBuffer();
  await upload(agent, id, withExif, 'phone.jpg');
  const files = toyFiles(site);
  const meta = await savedMetadata(site, files[0]);
  assert.equal(meta.exif, undefined);
  assert.equal(meta.width, 200);
  assert.equal(meta.height, 300);
});

test('the toy list shows uploaded photos with srcset and lazy loading, leaving the name to the text beside them', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const id = await createToy(agent);
  await upload(agent, id, await pngBuffer({ width: 1000, height: 800 }));

  const ka = await anonymous(site).get('/toys');
  assert.match(ka.text, /srcset="[^"]*400w[^"]*800w[^"]*1000w/);
  assert.match(ka.text, /loading="lazy"/);
  assert.match(ka.text, /<img[^>]*src="\/media\/toys\/[^>]*alt=""/);
  assert.match(ka.text, /class="toy__name">ხის ეტლი</);

  const href = /href="(\/toys\/[^"]+)"/.exec(ka.text)[1];
  assert.match((await anonymous(site).get(href)).text, /id="toy-main-photo"[^>]*alt="ხის ეტლი"/);
  assert.match((await anonymous(site).get(`/en${href}`)).text, /id="toy-main-photo"[^>]*alt="Wooden Pram"/);

  const src = /src="(\/media\/toys\/[^"]+\.webp)"/.exec(ka.text)[1];
  const media = await anonymous(site).get(src);
  assert.equal(media.status, 200);
  assert.match(media.headers['content-type'], /image\/webp/);
});

test('the admin list keeps one link per toy for keyboards and screen readers', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const id = await createToy(agent);
  await upload(agent, id, await pngBuffer());
  const list = await agent.get('/admin/toys');
  assert.match(list.text, new RegExp(`<a class="toy-row__photo" href="/admin/toys/${id}" tabindex="-1" aria-hidden="true">`));
  assert.match(list.text, new RegExp(`<a class="toy-row__name" href="/admin/toys/${id}">ხის ეტლი</a>`));
});

test('photos can be sent while creating a toy', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const response = await agent
    .post('/admin/toys')
    .field('name_ka', 'კუბიკები')
    .field('published', 'on')
    .attach('images', await pngBuffer(), 'one.png')
    .attach('images', await pngBuffer({ color: '#2F5478' }), 'two.png');
  assert.equal(response.status, 302);
  const id = Number(response.headers.location.split('/').pop().split('?')[0]);
  const edit = await agent.get(`/admin/toys/${id}`);
  assert.equal(imageIds(edit.text, id).length, 2);
});

test('a failed new-toy form says the photos must be chosen again', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const response = await agent
    .post('/admin/toys')
    .field('name_ka', '')
    .field('name_en', 'Kept Name')
    .attach('images', await pngBuffer(), 'one.png');
  assert.equal(response.status, 422);
  assert.match(response.text, /ფოტოები ხელახლა აირჩიე/);
  assert.match(response.text, /Kept Name/);
  assert.equal(toyFiles(site).length, 0);
});

test('a file that is not an image is rejected with a Georgian message', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const id = await createToy(agent);
  const response = await upload(agent, id, Buffer.from('this is not an image'), 'fake.jpg');
  assert.equal(response.status, 422);
  assert.match(response.text, /ფოტო/);
  assert.match(response.text, /fake\.jpg/);
  assert.equal(toyFiles(site).length, 0);
});

test('SVG uploads are rejected', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const id = await createToy(agent);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>');
  const response = await upload(agent, id, svg, 'logo.svg');
  assert.equal(response.status, 422);
  assert.equal(toyFiles(site).length, 0);
});

test('HEIC photos get a clear explanation', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const id = await createToy(agent);
  const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.alloc(32)]);
  const response = await upload(agent, id, heic, 'iphone.heic');
  assert.equal(response.status, 422);
  assert.match(response.text, /HEIC/);
});

test('a file above 15 MB is rejected', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const id = await createToy(agent);
  const response = await upload(agent, id, Buffer.alloc(15 * 1024 * 1024 + 1), 'huge.jpg');
  assert.equal(response.status, 422);
  assert.match(response.text, /15 MB/);
  assert.equal(toyFiles(site).length, 0);
});

test('a bad file does not block the good files sent with it', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const id = await createToy(agent);
  const response = await agent
    .post(`/admin/toys/${id}/images`)
    .attach('images', await pngBuffer(), 'good.png')
    .attach('images', Buffer.from('nope'), 'bad.png');
  assert.equal(response.status, 422);
  assert.match(response.text, /bad\.png/);
  assert.equal(imageIds(response.text, id).length, 1);
});

test('the first photo is the cover and any photo can become the cover', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const id = await createToy(agent);
  await upload(agent, id, await pngBuffer());
  await upload(agent, id, await pngBuffer({ color: '#2F5478' }));

  const edit = await agent.get(`/admin/toys/${id}`);
  const [first, second] = imageIds(edit.text, id);

  const coverBefore = /src="(\/media\/toys\/[^"]+)"/.exec((await anonymous(site).get('/toys')).text)[1];
  await agent.post(`/admin/toys/${id}/images/${second}/cover`).type('form').send({});
  const coverAfter = /src="(\/media\/toys\/[^"]+)"/.exec((await anonymous(site).get('/toys')).text)[1];
  assert.notEqual(coverBefore, coverAfter);

  const reordered = await agent.get(`/admin/toys/${id}`);
  assert.deepEqual(imageIds(reordered.text, id), [second, first]);
});

test('photos can be moved', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const id = await createToy(agent);
  await upload(agent, id, await pngBuffer());
  await upload(agent, id, await pngBuffer({ color: '#2F5478' }));
  const [first, second] = imageIds((await agent.get(`/admin/toys/${id}`)).text, id);

  await agent.post(`/admin/toys/${id}/images/${first}/move`).type('form').send({ direction: 'down' });
  assert.deepEqual(imageIds((await agent.get(`/admin/toys/${id}`)).text, id), [second, first]);
});

test('deleting a photo removes its files from disk', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const id = await createToy(agent);
  await upload(agent, id, await pngBuffer({ width: 1000, height: 800 }));
  assert.equal(toyFiles(site).length, 3);
  const [imageId] = imageIds((await agent.get(`/admin/toys/${id}`)).text, id);
  await agent.post(`/admin/toys/${id}/images/${imageId}/delete`).type('form').send({});
  assert.equal(toyFiles(site).length, 0);
});

test('deleting a toy removes its photo files from disk', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const id = await createToy(agent);
  await upload(agent, id, await pngBuffer());
  assert.ok(toyFiles(site).length > 0);
  await agent.post(`/admin/toys/${id}/delete`).type('form').send({});
  assert.equal(toyFiles(site).length, 0);
});
