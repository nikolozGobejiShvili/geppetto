import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { createSite } from '../server/app.js';

// One temp folder per test. Windows refuses to delete it while a site still has the
// database open, so every site started on it is closed first.
const foldersByTest = new WeakMap();

function folderFor(t) {
  if (!foldersByTest.has(t)) {
    const folder = { dataDir: mkdtempSync(path.join(os.tmpdir(), 'geppetto-test-')), sites: [] };
    foldersByTest.set(t, folder);
    t.after(() => {
      for (const site of folder.sites) site.close();
      rmSync(folder.dataDir, { recursive: true, force: true });
    });
  }
  return foldersByTest.get(t);
}

export async function startSite(t, options = {}) {
  const folder = folderFor(t);
  const site = await createSite({ dataDir: folder.dataDir, seed: false, log: () => {}, ...options });
  folder.sites.push(site);
  return site;
}

export function anonymous(site) {
  return request.agent(site.app);
}

export async function loggedIn(site) {
  const agent = request.agent(site.app);
  const response = await agent.post('/admin/login').type('form').send({ password: site.initialPassword });
  if (response.status !== 302) throw new Error(`Login failed with status ${response.status}`);
  return agent;
}

export async function createToy(agent, fields = {}) {
  const response = await agent
    .post('/admin/toys')
    .type('form')
    .send({ name_ka: 'ხის ეტლი', name_en: 'Wooden Pram', published: 'on', ...fields });
  if (response.status !== 302) throw new Error(`Create failed with status ${response.status}: ${response.text}`);
  return Number(response.headers.location.split('/').pop().split('?')[0]);
}

export function pngBuffer({ width = 500, height = 400, color = '#CA7939' } = {}) {
  return sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer();
}

export function visibleText(html) {
  return html.replace(/<[^>]+>/g, '');
}
