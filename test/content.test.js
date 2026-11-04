import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { CONTACT_TEXT_KEYS, SITE_TEXT } from '../server/content.js';
import { anonymous, createToy, loggedIn, pngBuffer, startSite, visibleText } from './helpers.js';

const PUBLIC_VIEWS = fileURLToPath(new URL('../views/public', import.meta.url));

function marker(key, lang) {
  return `MARK-${key}-${lang}`;
}

function contentForm(valueFor) {
  const form = {};
  for (const { key } of SITE_TEXT) {
    if (CONTACT_TEXT_KEYS.includes(key)) continue;
    form[`${key}__ka`] = valueFor(key, 'ka');
    form[`${key}__en`] = valueFor(key, 'en');
  }
  return form;
}

async function fetchPages(site, prefix, slug) {
  const urls = [prefix || '/', `${prefix}/toys`, `${prefix}/contact`];
  if (slug) urls.push(`${prefix}/toys/${slug}`);
  const pages = await Promise.all(urls.map((url) => anonymous(site).get(url)));
  return pages.map((page) => page.text);
}

test('every site text can be changed from the admin and shows in both languages', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);

  const saved = await agent.post('/admin/content').type('form').send(contentForm(marker));
  assert.equal(saved.status, 302);
  await agent.post('/admin/contact').type('form').send({
    phone: '+995 555 00 00 00',
    email: 'hello@example.com',
    whatsapp: '+995 555 00 00 00',
    instagram_url: 'https://www.instagram.com/geppetto.kids/',
    facebook_url: 'https://www.facebook.com/geppetto',
    contact_address__ka: marker('contact_address', 'ka'),
    contact_address__en: marker('contact_address', 'en'),
    contact_hours__ka: marker('contact_hours', 'ka'),
    contact_hours__en: marker('contact_hours', 'en'),
  });
  await agent.post('/admin/brand/hero').attach('image', await pngBuffer(), 'hero.png');
  const id = await createToy(agent, { age_ka: '1+', age_en: '1+', description_ka: 'აღწერა', description_en: 'Text' });

  for (const [lang, prefix] of [['ka', ''], ['en', '/en']]) {
    const withToy = await fetchPages(site, prefix, 'wooden-pram');
    await agent.post(`/admin/toys/${id}/toggle`).type('form').send({ field: 'published' });
    const withoutToy = await fetchPages(site, prefix);
    await agent.post(`/admin/toys/${id}/toggle`).type('form').send({ field: 'published' });

    const html = [...withToy, ...withoutToy].flatMap((page) => [page, visibleText(page)]).join('\n');
    for (const { key } of SITE_TEXT) {
      assert.ok(html.includes(marker(key, lang)), `${key} is missing in ${lang}`);
    }
  }
});

test('empty English text falls back to Georgian', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  await agent
    .post('/admin/content')
    .type('form')
    .send(contentForm((key, lang) => (key === 'hero_tagline' && lang === 'en' ? '' : marker(key, lang))));
  const home = await anonymous(site).get('/en');
  assert.match(home.text, /MARK-hero_tagline-ka/);
});

test('the about section stays hidden until it has text', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  await agent.post('/admin/content').type('form').send(contentForm((key, lang) => (key === 'about_text' ? '' : marker(key, lang))));
  assert.doesNotMatch((await anonymous(site).get('/')).text, /MARK-about_title/);

  await agent.post('/admin/content').type('form').send(contentForm(marker));
  assert.match((await anonymous(site).get('/')).text, /MARK-about_title-ka/);
});

test('public templates contain no Georgian text', () => {
  const files = readdirSync(PUBLIC_VIEWS, { recursive: true }).filter((file) => file.endsWith('.ejs'));
  assert.ok(files.length > 0);
  for (const file of files) {
    const source = readFileSync(path.join(PUBLIC_VIEWS, file), 'utf8');
    assert.doesNotMatch(source, /[Ⴀ-ჿᲐ-Ჿ]/, file);
  }
});

test('empty contact fields are not shown', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  await agent.post('/admin/contact').type('form').send({ phone: '+995 555 12 34 56' });
  let page = await anonymous(site).get('/contact');
  assert.match(page.text, /\+995 555 12 34 56/);
  assert.match(page.text, /href="tel:\+995555123456"/);
  assert.doesNotMatch(page.text, /mailto:/);

  await agent.post('/admin/contact').type('form').send({ phone: '' });
  page = await anonymous(site).get('/contact');
  assert.doesNotMatch(page.text, /555 12 34 56/);
});

test('with no contact details the sign and footer heading are hidden', async (t) => {
  const site = await startSite(t);
  const page = await anonymous(site).get('/contact');
  assert.doesNotMatch(page.text, /class="sign"/);
  assert.doesNotMatch(page.text, /site-footer__contact/);
});

test('an empty brand word leaves no empty heading on the home page', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  await agent.post('/admin/content').type('form').send(contentForm((key, lang) => (key === 'hero_brand' ? '' : marker(key, lang))));
  const page = await anonymous(site).get('/');
  assert.equal(page.status, 200);
  assert.doesNotMatch(page.text, /class="wordmark"/);
});

test('contact details appear in the footer of every page', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  await agent.post('/admin/contact').type('form').send({ phone: '+995 555 12 34 56', email: 'hello@example.com' });
  for (const url of ['/', '/toys', '/en', '/en/toys']) {
    const page = await anonymous(site).get(url);
    assert.match(page.text, /hello@example\.com/, url);
  }
});

test('contact address and hours differ per language', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  await agent.post('/admin/contact').type('form').send({
    contact_address__ka: 'თბილისი',
    contact_address__en: 'Tbilisi',
  });
  assert.match((await anonymous(site).get('/contact')).text, /თბილისი/);
  assert.match((await anonymous(site).get('/en/contact')).text, /Tbilisi/);
});

test('unsafe contact links are rejected and the form keeps its values', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const response = await agent.post('/admin/contact').type('form').send({
    phone: '+995 555 12 34 56',
    instagram_url: 'javascript:alert(1)',
  });
  assert.equal(response.status, 422);
  assert.match(response.text, /Instagram/);
  assert.match(response.text, /555 12 34 56/);
  assert.doesNotMatch((await anonymous(site).get('/contact')).text, /javascript:/);
});

test('an invalid email is rejected', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const response = await agent.post('/admin/contact').type('form').send({ email: 'not-an-email' });
  assert.equal(response.status, 422);
  assert.match(response.text, /ელფოსტა/);
});

test('the logo can be replaced from the admin', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const response = await agent.post('/admin/brand/logo').attach('image', await pngBuffer({ width: 300, height: 300 }), 'logo.png');
  assert.equal(response.status, 302);

  const first = /class="site-logo"[^>]*src="([^"]+)"|src="([^"]+)"[^>]*class="site-logo"/.exec((await anonymous(site).get('/toys')).text);
  assert.ok(first, 'logo image is missing');

  await agent.post('/admin/brand/logo').attach('image', await pngBuffer({ width: 300, height: 300, color: '#2F5478' }), 'logo2.png');
  const second = /class="site-logo"[^>]*src="([^"]+)"|src="([^"]+)"[^>]*class="site-logo"/.exec((await anonymous(site).get('/toys')).text);
  assert.notEqual(first[0], second[0]);
});

test('a logo keeps its transparent corners and gets sizes large enough for the home page', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const transparent = await sharp({ create: { width: 1200, height: 1200, channels: 4, background: { r: 188, g: 24, b: 5, alpha: 0 } } }).png().toBuffer();
  await agent.post('/admin/brand/logo').attach('image', transparent, 'logo.png');

  const dir = path.join(site.dataDir, 'uploads', 'brand');
  const widths = [];
  for (const file of readdirSync(dir)) {
    const meta = await sharp(readFileSync(path.join(dir, file))).metadata();
    assert.equal(meta.hasAlpha, true, file);
    widths.push(meta.width);
  }
  assert.deepEqual(widths.sort((a, b) => a - b), [96, 192, 384, 768, 1024]);
});

test('the home page shows the logo as its large heading, and other pages show it small', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  await agent.post('/admin/brand/logo').attach('image', await pngBuffer({ width: 900, height: 900 }), 'logo.png');

  const home = await anonymous(site).get('/');
  assert.match(home.text, /<h1 class="hero__logo"><img[^>]*alt="Geppetto"/);
  assert.doesNotMatch(home.text, /class="site-logo"/);
  assert.doesNotMatch(home.text, /class="wordmark"/);

  const list = await anonymous(site).get('/en/toys');
  assert.match(list.text, /class="site-logo"/);
  assert.doesNotMatch(list.text, /hero__logo/);
});

test('without a logo the home page falls back to the brand word', async (t) => {
  const site = await startSite(t);
  const home = await anonymous(site).get('/');
  assert.match(home.text, /<h1 class="wordmark">Geppetto<\/h1>/);
});

test('a logo with an empty brand word leaves no empty heading', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  await agent.post('/admin/brand/logo').attach('image', await pngBuffer({ width: 900, height: 900 }), 'logo.png');
  await agent.post('/admin/content').type('form').send(contentForm((key, lang) => (key === 'hero_brand' ? '' : marker(key, lang))));
  const home = await anonymous(site).get('/');
  assert.match(home.text, /class="hero__logo"/);
  assert.doesNotMatch(home.text, /<h1/);
});

test('every public page offers a way to skip to its main content', async (t) => {
  const site = await startSite(t);
  const pages = [
    ['/', /მთავარ შინაარსზე გადასვლა/],
    ['/toys', /მთავარ შინაარსზე გადასვლა/],
    ['/contact', /მთავარ შინაარსზე გადასვლა/],
    ['/en', /Skip to main content/],
    ['/no-such-page', /მთავარ შინაარსზე გადასვლა/],
  ];
  for (const [url, label] of pages) {
    const page = await anonymous(site).get(url);
    assert.match(page.text, /<a class="skip-link" href="#main">/, url);
    assert.match(page.text, label, url);
    assert.match(page.text, /<main[^>]*id="main"/, url);
  }
});

test('the contact page does not repeat the contact details in its footer', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  await agent.post('/admin/contact').type('form').send({ email: 'hello@example.com' });
  for (const url of ['/contact', '/en/contact']) {
    const page = await anonymous(site).get(url);
    assert.match(page.text, /class="sign"/, url);
    assert.doesNotMatch(page.text, /site-footer__contact/, url);
  }
  assert.match((await anonymous(site).get('/toys')).text, /site-footer__contact/);
});

test('the hero photo can be replaced and a bad file is rejected', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const good = await agent.post('/admin/brand/hero').attach('image', await pngBuffer({ width: 900, height: 900 }), 'hero.png');
  assert.equal(good.status, 302);
  assert.match((await anonymous(site).get('/')).text, /\/media\/brand\/[^"]+\.webp/);

  const bad = await agent.post('/admin/brand/hero').attach('image', Buffer.from('nope'), 'hero.png');
  assert.equal(bad.status, 422);
  assert.match(bad.text, /ფოტო/);
});

test('pages declare their language and link to the other language', async (t) => {
  const site = await startSite(t);
  const ka = await anonymous(site).get('/toys');
  assert.match(ka.text, /<html lang="ka"/);
  assert.match(ka.text, /hreflang="en"[^>]*href="[^"]*\/en\/toys"|href="[^"]*\/en\/toys"[^>]*hreflang="en"/);
  assert.match(ka.text, /href="\/en\/toys"/);

  const en = await anonymous(site).get('/en/toys');
  assert.match(en.text, /<html lang="en"/);
  assert.match(en.text, /hreflang="ka"[^>]*href="[^"]*\/toys"|href="[^"]*\/toys"[^>]*hreflang="ka"/);
  assert.match(en.text, /href="\/toys"/);
});

test('unknown pages return 404 in the right language', async (t) => {
  const site = await startSite(t);
  const ka = await anonymous(site).get('/no-such-page');
  assert.equal(ka.status, 404);
  assert.match(ka.text, /ეს გვერდი არ არსებობს/);

  const en = await anonymous(site).get('/en/no-such-page');
  assert.equal(en.status, 404);
  assert.match(en.text, /This page does not exist/);
});

test('the 404 page does not mark any menu link as the current page', async (t) => {
  const site = await startSite(t);
  const page = await anonymous(site).get('/no-such-page');
  assert.doesNotMatch(page.text, /aria-current="page"/);
});
