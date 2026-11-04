import assert from 'node:assert/strict';
import { test } from 'node:test';
import { anonymous, createToy, loggedIn, startSite, visibleText } from './helpers.js';

test('a Georgian name alone is enough to create a toy', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const id = await createToy(agent, { name_ka: 'კუბიკები', name_en: '' });
  const response = await agent.get(`/admin/toys/${id}`);
  assert.match(response.text, /კუბიკები/);
});

test('a missing Georgian name is rejected and the form keeps what was typed', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const response = await agent
    .post('/admin/toys')
    .type('form')
    .send({ name_ka: '  ', name_en: 'Blocks Typed Here', description_en: 'Kept description' });
  assert.equal(response.status, 422);
  assert.match(response.text, /ქართული სახელი/);
  assert.match(response.text, /Blocks Typed Here/);
  assert.match(response.text, /Kept description/);
});

test('an invalid price is rejected and the form keeps what was typed', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const response = await agent
    .post('/admin/toys')
    .type('form')
    .send({ name_ka: 'კუბიკები', price: 'abc' });
  assert.equal(response.status, 422);
  assert.match(response.text, /ფასი/);
  assert.match(response.text, /value="abc"/);
});

test('the admin list warns about a missing price, photo and English name', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  await createToy(agent, { name_en: '' });
  const response = await agent.get('/admin/toys');
  assert.match(response.text, /ფასი აკლია/);
  assert.match(response.text, /ფოტო აკლია/);
  assert.match(response.text, /ინგლისური სახელი აკლია/);
});

test('a published toy appears in both languages with its price', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  await createToy(agent, { price: '35.50' });

  const ka = await anonymous(site).get('/toys');
  assert.match(ka.text, /ხის ეტლი/);
  assert.match(visibleText(ka.text), /35\.50 ლარი/);

  const en = await anonymous(site).get('/en/toys');
  assert.match(en.text, /Wooden Pram/);
  assert.match(visibleText(en.text), /35\.50 GEL/);
});

test('a toy without a price shows no price tag', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  await createToy(agent);
  const response = await anonymous(site).get('/toys');
  assert.doesNotMatch(response.text, /toy__tag/);
});

test('English falls back to Georgian when the English field is empty', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  await createToy(agent, { name_en: '', description_ka: 'ქართული აღწერა', description_en: '' });
  const list = await anonymous(site).get('/en/toys');
  assert.match(list.text, /ხის ეტლი/);
  const detail = await anonymous(site).get('/en/toys/khis-etli');
  assert.match(detail.text, /ქართული აღწერა/);
});

test('the toy page shows name, price, description and age', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  await createToy(agent, {
    price: '29',
    description_ka: 'ქართული აღწერა',
    description_en: 'English description',
    age_ka: '1+ წელი',
    age_en: '1+ years',
  });
  const ka = await anonymous(site).get('/toys/wooden-pram');
  assert.equal(ka.status, 200);
  for (const expected of [/ხის ეტლი/, /29 ლარი/, /ქართული აღწერა/, /1\+ წელი/]) {
    assert.match(visibleText(ka.text), expected);
  }
  const en = await anonymous(site).get('/en/toys/wooden-pram');
  for (const expected of [/Wooden Pram/, /29 GEL/, /English description/, /1\+ years/]) {
    assert.match(visibleText(en.text), expected);
  }
});

test('the toy page leaves out empty fields', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  await createToy(agent);
  const response = await anonymous(site).get('/toys/wooden-pram');
  assert.doesNotMatch(response.text, /toy-page__age/);
  assert.doesNotMatch(response.text, /toy-page__description/);
  assert.doesNotMatch(response.text, /toy__tag/);
});

test('a hidden toy leaves the list and its page returns 404', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const id = await createToy(agent);
  assert.equal((await anonymous(site).get('/toys/wooden-pram')).status, 200);

  await agent.post(`/admin/toys/${id}/toggle`).type('form').send({ field: 'published' });

  const list = await anonymous(site).get('/toys');
  assert.doesNotMatch(list.text, /ხის ეტლი/);
  assert.equal((await anonymous(site).get('/toys/wooden-pram')).status, 404);
  assert.equal((await anonymous(site).get('/en/toys/wooden-pram')).status, 404);
});

test('editing changes the toy but keeps its address', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const id = await createToy(agent);
  const response = await agent
    .post(`/admin/toys/${id}`)
    .type('form')
    .send({ name_ka: 'ახალი სახელი', name_en: 'New Name', price: '10', published: 'on' });
  assert.equal(response.status, 302);

  const page = await anonymous(site).get('/toys/wooden-pram');
  assert.equal(page.status, 200);
  assert.match(page.text, /ახალი სახელი/);
  assert.match(visibleText(page.text), /10 ლარი/);
});

test('clearing the price removes it from the site', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const id = await createToy(agent, { price: '10' });
  await agent.post(`/admin/toys/${id}`).type('form').send({ name_ka: 'ხის ეტლი', name_en: 'Wooden Pram', price: '', published: 'on' });
  const list = await anonymous(site).get('/toys');
  assert.doesNotMatch(list.text, /toy__tag/);
});

test('two toys with the same name get different addresses', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  await createToy(agent);
  await createToy(agent);
  assert.equal((await anonymous(site).get('/toys/wooden-pram')).status, 200);
  assert.equal((await anonymous(site).get('/toys/wooden-pram-2')).status, 200);
});

test('move up and down changes the public order', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  await createToy(agent, { name_ka: 'პირველი', name_en: 'First' });
  const second = await createToy(agent, { name_ka: 'მეორე', name_en: 'Second' });

  const before = (await anonymous(site).get('/en/toys')).text;
  assert.ok(before.indexOf('First') < before.indexOf('Second'));

  await agent.post(`/admin/toys/${second}/move`).type('form').send({ direction: 'up' });
  const after = (await anonymous(site).get('/en/toys')).text;
  assert.ok(after.indexOf('Second') < after.indexOf('First'));

  await agent.post(`/admin/toys/${second}/move`).type('form').send({ direction: 'down' });
  const restored = (await anonymous(site).get('/en/toys')).text;
  assert.ok(restored.indexOf('First') < restored.indexOf('Second'));
});

test('deleting a toy removes it from the site and the admin', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const id = await createToy(agent);
  const response = await agent.post(`/admin/toys/${id}/delete`).type('form').send({});
  assert.equal(response.status, 302);
  assert.equal((await anonymous(site).get('/toys/wooden-pram')).status, 404);
  assert.equal((await agent.get(`/admin/toys/${id}`)).status, 404);
});

test('the home page shows featured toys, at most six', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  for (let index = 1; index <= 8; index += 1) {
    await createToy(agent, { name_ka: `რჩეული ${index}`, name_en: `Featured ${index}`, featured: 'on' });
  }
  await createToy(agent, { name_ka: 'ჩვეულებრივი', name_en: 'Plain' });

  const home = await anonymous(site).get('/en');
  assert.match(home.text, /Featured 6/);
  assert.doesNotMatch(home.text, /Featured 7/);
  assert.doesNotMatch(home.text, /Plain/);
});

test('the home page falls back to the first six toys when none is featured', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  for (let index = 1; index <= 7; index += 1) {
    await createToy(agent, { name_ka: `სათამაშო ${index}`, name_en: `Toy ${index}` });
  }
  const home = await anonymous(site).get('/en');
  assert.match(home.text, /Toy 6/);
  assert.doesNotMatch(home.text, /Toy 7/);
});

test('the public site has no cart or online payment', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  await createToy(agent, { price: '29' });
  for (const url of ['/', '/toys', '/toys/wooden-pram', '/contact', '/en', '/en/toys', '/en/toys/wooden-pram', '/en/contact']) {
    const text = visibleText((await anonymous(site).get(url)).text).toLowerCase();
    assert.doesNotMatch(text, /კალათ|ყიდვა|იყიდე|გადახდ|\bcart\b|checkout|\bbuy\b|\bpay\b/, url);
  }
});

test('toy text is escaped on the public site', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  await createToy(agent, { name_ka: '<script>alert(1)</script>' });
  const response = await anonymous(site).get('/toys');
  assert.doesNotMatch(response.text, /<script>alert/);
});
