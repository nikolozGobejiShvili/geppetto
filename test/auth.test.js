import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resetPassword } from '../server/auth.js';
import { anonymous, loggedIn, startSite } from './helpers.js';

test('first start generates a password', async (t) => {
  const site = await startSite(t);
  assert.ok(site.initialPassword.length >= 12);
});

test('a later start with the same data keeps the password and prints nothing new', async (t) => {
  const first = await startSite(t);
  first.close();
  const second = await startSite(t);
  assert.equal(second.initialPassword, null);
});

test('admin pages redirect to login without a session', async (t) => {
  const site = await startSite(t);
  for (const url of ['/admin', '/admin/toys', '/admin/toys/new', '/admin/content', '/admin/contact', '/admin/brand', '/admin/password']) {
    const response = await anonymous(site).get(url);
    assert.equal(response.status, 302, url);
    assert.equal(response.headers.location, '/admin/login', url);
  }
});

test('admin changes are rejected without a session', async (t) => {
  const site = await startSite(t);
  for (const url of ['/admin/toys', '/admin/toys/1/delete', '/admin/content', '/admin/contact', '/admin/brand/logo', '/admin/password', '/admin/logout']) {
    const response = await anonymous(site).post(url).type('form').send({ name_ka: 'x' });
    assert.equal(response.status, 401, url);
  }
});

test('a wrong password is rejected with a Georgian message', async (t) => {
  const site = await startSite(t);
  const response = await anonymous(site).post('/admin/login').type('form').send({ password: 'wrong-password' });
  assert.equal(response.status, 401);
  assert.match(response.text, /პაროლი არასწორია/);
});

test('the right password opens the admin area', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const response = await agent.get('/admin/toys');
  assert.equal(response.status, 200);
});

test('the session cookie is HttpOnly and SameSite=Strict', async (t) => {
  const site = await startSite(t);
  const response = await anonymous(site).post('/admin/login').type('form').send({ password: site.initialPassword });
  const cookie = response.headers['set-cookie'][0];
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
});

test('logout ends the session', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  await agent.post('/admin/logout').type('form').send({});
  const response = await agent.get('/admin/toys');
  assert.equal(response.status, 302);
});

test('login is blocked after five wrong attempts', async (t) => {
  const site = await startSite(t);
  const agent = anonymous(site);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await agent.post('/admin/login').type('form').send({ password: 'wrong-password' });
  }
  const response = await agent.post('/admin/login').type('form').send({ password: site.initialPassword });
  assert.equal(response.status, 429);
  assert.match(response.text, /მცდელობა/);
});

test('admin changes from another origin are rejected', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const response = await agent
    .post('/admin/toys')
    .set('Origin', 'https://evil.example')
    .type('form')
    .send({ name_ka: 'x' });
  assert.equal(response.status, 403);
});

test('admin pages tell search engines not to index them', async (t) => {
  const site = await startSite(t);
  const response = await anonymous(site).get('/admin/login');
  assert.equal(response.headers['x-robots-tag'], 'noindex');
});

test('changing the password replaces the old one', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const response = await agent.post('/admin/password').type('form').send({
    current_password: site.initialPassword,
    new_password: 'a-new-long-password',
    confirm_password: 'a-new-long-password',
  });
  assert.equal(response.status, 302);

  const oldLogin = await anonymous(site).post('/admin/login').type('form').send({ password: site.initialPassword });
  assert.equal(oldLogin.status, 401);
  const newLogin = await anonymous(site).post('/admin/login').type('form').send({ password: 'a-new-long-password' });
  assert.equal(newLogin.status, 302);
});

test('changing the password checks the current password and the confirmation', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);

  const wrongCurrent = await agent.post('/admin/password').type('form').send({
    current_password: 'not-it',
    new_password: 'a-new-long-password',
    confirm_password: 'a-new-long-password',
  });
  assert.equal(wrongCurrent.status, 422);
  assert.match(wrongCurrent.text, /მიმდინარე პაროლი/);

  const mismatch = await agent.post('/admin/password').type('form').send({
    current_password: site.initialPassword,
    new_password: 'a-new-long-password',
    confirm_password: 'different-password',
  });
  assert.equal(mismatch.status, 422);

  const tooShort = await agent.post('/admin/password').type('form').send({
    current_password: site.initialPassword,
    new_password: 'short',
    confirm_password: 'short',
  });
  assert.equal(tooShort.status, 422);
});

test('resetPassword issues a working password and ends existing sessions', async (t) => {
  const site = await startSite(t);
  const agent = await loggedIn(site);
  const fresh = resetPassword(site.db);

  const stale = await agent.get('/admin/toys');
  assert.equal(stale.status, 302);
  const login = await anonymous(site).post('/admin/login').type('form').send({ password: fresh });
  assert.equal(login.status, 302);
});
