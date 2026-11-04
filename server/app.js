import path from 'node:path';
import express from 'express';
import { ensureAdmin } from './auth.js';
import { PROJECT_ROOT } from './config.js';
import { ensureSiteText } from './content.js';
import { openDatabase } from './db.js';
import { adminRouter } from './routes/admin.js';
import { errorHandler, notFoundHandler, publicRouter } from './routes/public.js';
import { seedOnce } from './seed.js';

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "img-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const FONT_PACKAGES = ['bevan', 'noto-serif-georgian', 'noto-sans-georgian'];

export async function createSite({ dataDir, seed = true, log = console.log, cookieSecure = false, trustProxy = false }) {
  const db = openDatabase(dataDir);
  ensureSiteText(db);
  const initialPassword = ensureAdmin(db);
  const uploadsDir = path.join(dataDir, 'uploads');
  if (seed) await seedOnce(db, uploadsDir);

  const app = express();
  app.disable('x-powered-by');
  // One hop: the host's proxy. It gives the real visitor address and https to the site.
  if (trustProxy) app.set('trust proxy', 1);
  app.set('view engine', 'ejs');
  app.set('views', path.join(PROJECT_ROOT, 'views'));

  app.use((req, res, next) => {
    res.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'same-origin');
    next();
  });

  app.use('/assets', express.static(path.join(PROJECT_ROOT, 'public')));
  app.use('/media', express.static(uploadsDir, { maxAge: '30d', immutable: true }));
  for (const name of FONT_PACKAGES) {
    app.use(
      `/fonts/${name}`,
      express.static(path.join(PROJECT_ROOT, 'node_modules', '@fontsource', name, 'files'), { maxAge: '30d', immutable: true }),
    );
  }

  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use('/admin', adminRouter({ db, uploadsDir, cookieSecure }));
  app.use('/en', publicRouter({ db, lang: 'en' }));
  app.use('/', publicRouter({ db, lang: 'ka' }));
  app.use(notFoundHandler({ db }));
  app.use(errorHandler({ db, log }));

  let closed = false;
  return {
    app,
    db,
    dataDir,
    initialPassword,
    close() {
      if (closed) return;
      closed = true;
      db.close();
    },
  };
}
