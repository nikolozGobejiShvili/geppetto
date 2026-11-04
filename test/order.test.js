import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildOrderMessage, instagramLink, messengerLink, normalizeWhatsapp, whatsappLink } from '../server/order.js';
import { anonymous, createToy, loggedIn, startSite } from './helpers.js';

const CHANNELS = {
  whatsapp: '+995 555 12 34 56',
  instagram_url: 'https://www.instagram.com/geppetto.kids/',
  facebook_url: 'https://www.facebook.com/geppetto',
};

function hrefOf(html, channel) {
  const match = new RegExp(`data-channel="${channel}"[^>]*href="([^"]+)"|href="([^"]+)"[^>]*data-channel="${channel}"`).exec(html);
  return match ? (match[1] ?? match[2]).replaceAll('&#43;', '+').replaceAll('&amp;', '&') : null;
}

function originOf(html) {
  return /hreflang="ka" href="(https?:\/\/[^/"]+)/.exec(html)[1];
}

test('buildOrderMessage fills in the toy name and link', () => {
  assert.equal(
    buildOrderMessage('მინდა შევუკვეთო: {name}\n{link}', { name: 'ხის ეტლი', link: 'https://site/toys/pram' }),
    'მინდა შევუკვეთო: ხის ეტლი\nhttps://site/toys/pram',
  );
});

test('buildOrderMessage always keeps the link, even if the template drops it', () => {
  assert.equal(
    buildOrderMessage('გამარჯობა', { name: 'ხის ეტლი', link: 'https://site/toys/pram' }),
    'გამარჯობა\nhttps://site/toys/pram',
  );
});

test('normalizeWhatsapp keeps digits and adds the Georgian code to a local mobile number', () => {
  assert.deepEqual(normalizeWhatsapp('+995 555 12 34 56'), { ok: true, digits: '995555123456' });
  assert.deepEqual(normalizeWhatsapp('555-12-34-56'), { ok: true, digits: '995555123456' });
  assert.deepEqual(normalizeWhatsapp('+1 202 555 0147'), { ok: true, digits: '12025550147' });
});

test('normalizeWhatsapp treats an empty value as no number', () => {
  assert.deepEqual(normalizeWhatsapp('  '), { ok: true, digits: '' });
});

test('normalizeWhatsapp rejects values that cannot be a phone number', () => {
  for (const value of ['abc', '12345', '12345678901234567890']) {
    assert.equal(normalizeWhatsapp(value).ok, false, value);
  }
});

test('whatsappLink writes the encoded message into the chat', () => {
  assert.equal(
    whatsappLink('995555123456', 'ეტლი\nhttps://site/a?b=1'),
    `https://wa.me/995555123456?text=${encodeURIComponent('ეტლი\nhttps://site/a?b=1')}`,
  );
});

test('messengerLink opens the chat of a Facebook page', () => {
  assert.equal(messengerLink('https://www.facebook.com/geppetto/', 'hi there'), 'https://m.me/geppetto?text=hi%20there');
  assert.equal(messengerLink('https://www.facebook.com/profile.php?id=1000123', 'hi'), 'https://m.me/1000123?text=hi');
  assert.equal(messengerLink('https://www.facebook.com/people/Geppetto/61550000000000/', 'hi'), 'https://m.me/61550000000000?text=hi');
});

test('messengerLink falls back to the page itself when no name can be found', () => {
  assert.equal(messengerLink('https://www.facebook.com/', 'hi'), 'https://www.facebook.com/');
});

test('instagramLink opens the direct chat of an account', () => {
  assert.equal(instagramLink('https://www.instagram.com/geppetto.kids/'), 'https://ig.me/m/geppetto.kids');
  assert.equal(instagramLink('https://instagram.com/geppetto.kids?igsh=abc'), 'https://ig.me/m/geppetto.kids');
});

test('instagramLink falls back to the given link when no account can be found', () => {
  assert.equal(instagramLink('https://www.instagram.com/'), 'https://www.instagram.com/');
});

test('the toy page offers all three apps with the toy link in the message', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  await agent.post('/admin/contact').type('form').send(CHANNELS);
  await createToy(agent);

  const page = await anonymous(site).get('/toys/wooden-pram');
  const toyUrl = `${originOf(page.text)}/toys/wooden-pram`;
  const message = `გამარჯობა! მინდა შევუკვეთო ეს სათამაშო: ხის ეტლი\n${toyUrl}`;

  assert.match(page.text, /class="[^"]*order__toggle[^"]*"[^>]*>შეკვეთა</);
  assert.match(page.text, /შესაკვეთად მოგვწერეთ/);
  assert.equal(hrefOf(page.text, 'whatsapp'), `https://wa.me/995555123456?text=${encodeURIComponent(message)}`);
  assert.equal(hrefOf(page.text, 'facebook'), `https://m.me/geppetto?text=${encodeURIComponent(message)}`);
  assert.equal(hrefOf(page.text, 'instagram'), 'https://ig.me/m/geppetto.kids');
  assert.ok((page.text.match(/#logo-(whatsapp|instagram|facebook)/g) ?? []).length === 3);
});

test('the English toy page sends an English message with the English link', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  await agent.post('/admin/contact').type('form').send(CHANNELS);
  await createToy(agent);

  const page = await anonymous(site).get('/en/toys/wooden-pram');
  const href = decodeURIComponent(hrefOf(page.text, 'whatsapp'));
  assert.match(page.text, /order__toggle[^"]*"[^>]*>Order</);
  assert.match(href, /I would like to order this toy: Wooden Pram/);
  assert.match(href, /\/en\/toys\/wooden-pram$/);
});

test('the message for pasting is on the page for the copy step', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  await agent.post('/admin/contact').type('form').send(CHANNELS);
  await createToy(agent);
  const page = await anonymous(site).get('/toys/wooden-pram');
  assert.match(page.text, /data-order-message="გამარჯობა! მინდა შევუკვეთო ეს სათამაშო: ხის ეტლი[^"]*\/toys\/wooden-pram"/);
});

test('apps open in a new tab', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  await agent.post('/admin/contact').type('form').send(CHANNELS);
  await createToy(agent);
  const page = await anonymous(site).get('/toys/wooden-pram');
  const links = page.text.match(/<a [^>]*data-channel="[^>]*>/g);
  assert.equal(links.length, 3);
  for (const link of links) {
    assert.match(link, /target="_blank"/);
    assert.match(link, /rel="noopener"/);
  }
});

test('only the apps filled in the admin appear', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  await agent.post('/admin/contact').type('form').send({ instagram_url: CHANNELS.instagram_url });
  await createToy(agent);
  const page = await anonymous(site).get('/toys/wooden-pram');
  assert.ok(hrefOf(page.text, 'instagram'));
  assert.equal(hrefOf(page.text, 'whatsapp'), null);
  assert.equal(hrefOf(page.text, 'facebook'), null);
  assert.doesNotMatch(page.text, /#logo-whatsapp/);
});

test('without any app the order button is hidden', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  await createToy(agent);
  const page = await anonymous(site).get('/toys/wooden-pram');
  assert.doesNotMatch(page.text, /order__toggle/);
});

test('the order button is only on the toy page', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  await agent.post('/admin/contact').type('form').send(CHANNELS);
  await createToy(agent);
  for (const url of ['/', '/toys', '/contact']) {
    assert.doesNotMatch((await anonymous(site).get(url)).text, /order__toggle/, url);
  }
});

test('a toy name with special characters stays intact in the link', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  await agent.post('/admin/contact').type('form').send(CHANNELS);
  await createToy(agent, { name_ka: 'ეტლი & "ბურთი" <1>', name_en: 'Pram' });
  const page = await anonymous(site).get('/toys/pram');
  assert.ok(decodeURIComponent(hrefOf(page.text, 'whatsapp')).includes('ეტლი & "ბურთი" <1>'));
  assert.doesNotMatch(page.text, /<1>/);
});

test('the admin saves a WhatsApp number and the site shows it', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const saved = await agent.post('/admin/contact').type('form').send({ whatsapp: '555 12 34 56' });
  assert.equal(saved.status, 302);
  const form = await agent.get('/admin/contact');
  assert.match(form.text, /name="whatsapp"[^>]*value="995555123456"/);
  const contact = await anonymous(site).get('/contact');
  assert.match(contact.text, /href="https:\/\/wa\.me\/995555123456"/);
  assert.match(contact.text, /\+995555123456/);
});

test('an invalid WhatsApp number is rejected and the form keeps its values', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const response = await agent.post('/admin/contact').type('form').send({ whatsapp: 'abc', phone: '+995 555 12 34 56' });
  assert.equal(response.status, 422);
  assert.match(response.text, /WhatsApp/);
  assert.match(response.text, /value="abc"/);
  assert.match(response.text, /555 12 34 56/);
});

test('order wording can be changed from the admin', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const form = await agent.get('/admin/content');
  assert.match(form.text, /name="order_button__ka"/);
  assert.match(form.text, /name="order_message__en"/);
});

test('a site saved before this feature gets the new wording on restart', async (t) => {
  const first = await startSite(t);
  first.db.prepare("DELETE FROM site_text WHERE key LIKE 'order_%'").run();
  first.close();
  const second = await startSite(t);
  const row = second.db.prepare("SELECT value_ka FROM site_text WHERE key = 'order_button'").get();
  assert.equal(row.value_ka, 'შეკვეთა');
});
