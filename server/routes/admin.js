import path from 'node:path';
import express from 'express';
import multer from 'multer';
import {
  createLoginLimiter,
  createSession,
  endOtherSessions,
  endSession,
  hasSession,
  readCookie,
  sameOriginOnly,
  SESSION_COOKIE,
  sessionCookieOptions,
  setPassword,
  verifyPassword,
} from '../auth.js';
import { CONTACT_TEXT_KEYS, EDITABLE_TEXT, readSiteText, saveSiteText, SITE_TEXT } from '../content.js';
import { getSetting, setSetting } from '../db.js';
import { HERO_WIDTHS, ImageRejected, imageView, LOGO_WIDTHS, MAX_UPLOAD_MB, removeImageFiles, saveImage, TOY_WIDTHS } from '../images.js';
import { normalizeWhatsapp } from '../order.js';
import { formatPrice, priceToInput } from '../price.js';
import {
  addImage,
  createToy,
  deleteImage,
  deleteToy,
  getImage,
  getToy,
  listImages,
  listToys,
  makeCover,
  moveImage,
  moveToy,
  readToyForm,
  toggleToy,
  updateToy,
  validateToy,
} from '../toys.js';

const MAX_FILES_PER_UPLOAD = 12;
const MIN_PASSWORD_LENGTH = 8;
const EMPTY_TOY = {
  name_ka: '',
  name_en: '',
  description_ka: '',
  description_en: '',
  age_ka: '',
  age_en: '',
  price: '',
  published: 1,
  featured: 0,
};
const BRAND_IMAGES = {
  logo: { widths: LOGO_WIDTHS },
  hero: { widths: HERO_WIDTHS },
};

function uploadProblem(error) {
  if (error.code === 'LIMIT_FILE_SIZE') return `ფაილი ${MAX_UPLOAD_MB} MB-ზე დიდია. შეამცირე ზომა და ხელახლა ატვირთე.`;
  if (error.code === 'LIMIT_FILE_COUNT') return `ერთად მაქსიმუმ ${MAX_FILES_PER_UPLOAD} ფოტოს ატვირთვა შეიძლება.`;
  return 'ფაილი ვერ მივიღე. სცადე ხელახლა.';
}

function isHttpUrl(value) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function adminRouter({ db, uploadsDir, cookieSecure }) {
  const router = express.Router();
  const limiter = createLoginLimiter();
  const toysDir = path.join(uploadsDir, 'toys');
  const brandDir = path.join(uploadsDir, 'brand');
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: MAX_FILES_PER_UPLOAD },
    defParamCharset: 'utf8',
  });

  // Keeps multer's size and count errors on the page instead of the error handler.
  const receive = (handler) => (req, res, next) => {
    handler(req, res, (error) => {
      if (error instanceof multer.MulterError) {
        req.uploadProblem = uploadProblem(error);
        next();
        return;
      }
      next(error);
    });
  };
  const receivePhotos = receive(upload.array('images', MAX_FILES_PER_UPLOAD));
  const receiveOne = receive(upload.single('image'));

  async function savePhotos(toyId, files = []) {
    const problems = [];
    for (const file of files) {
      try {
        addImage(db, toyId, await saveImage(file.buffer, toysDir, TOY_WIDTHS));
      } catch (error) {
        if (!(error instanceof ImageRejected)) throw error;
        problems.push(`${file.originalname}: ${error.message}`);
      }
    }
    return problems;
  }

  function renderToyForm(res, status, { toy, values, errors = [], saved = false }) {
    const images = toy
      ? listImages(db, toy.id).map((image) => ({ ...image, view: imageView('/media/toys', image) }))
      : [];
    res.status(status).render('admin/toy-form', { section: 'toys', toy, values, errors, saved, images, maxUploadMb: MAX_UPLOAD_MB });
  }

  function toyValues(toy) {
    return { ...toy, price: priceToInput(toy.price_tetri) };
  }

  function loadToy(req, res) {
    const toy = getToy(db, Number(req.params.id));
    if (!toy) res.status(404).render('admin/not-found', { section: null });
    return toy;
  }

  function loadImage(req, res, toy) {
    const image = getImage(db, toy.id, Number(req.params.imageId));
    if (!image) res.status(404).render('admin/not-found', { section: null });
    return image;
  }

  function isLoggedIn(req) {
    return hasSession(db, readCookie(req, SESSION_COOKIE));
  }

  router.use((req, res, next) => {
    res.set('X-Robots-Tag', 'noindex');
    req.body ??= {};
    next();
  });
  router.use(sameOriginOnly);

  router.get('/login', (req, res) => {
    if (isLoggedIn(req)) {
      res.redirect('/admin/toys');
      return;
    }
    res.render('admin/login', { error: null });
  });

  router.post('/login', (req, res) => {
    if (limiter.isBlocked(req.ip)) {
      res.status(429).render('admin/login', { error: 'ძალიან ბევრი მცდელობა. სცადე 15 წუთში.' });
      return;
    }
    if (!verifyPassword(db, req.body.password)) {
      limiter.recordFailure(req.ip);
      res.status(401).render('admin/login', { error: 'პაროლი არასწორია.' });
      return;
    }
    limiter.clear(req.ip);
    res.cookie(SESSION_COOKIE, createSession(db), sessionCookieOptions(cookieSecure));
    res.redirect('/admin/toys');
  });

  router.use((req, res, next) => {
    if (isLoggedIn(req)) {
      next();
      return;
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      res.redirect('/admin/login');
      return;
    }
    res.status(401).type('text/plain').send('ჯერ შედი ადმინპანელში.');
  });

  router.post('/logout', (req, res) => {
    endSession(db, readCookie(req, SESSION_COOKIE));
    res.clearCookie(SESSION_COOKIE, { path: '/admin' });
    res.redirect('/admin/login');
  });

  router.get('/', (req, res) => res.redirect('/admin/toys'));

  router.get('/toys', (req, res) => {
    const toys = listToys(db).map((toy) => {
      const [cover] = listImages(db, toy.id);
      return { ...toy, cover: cover ? imageView('/media/toys', cover) : null, priceText: formatPrice(toy.price_tetri, 'ka') };
    });
    res.render('admin/toys', { section: 'toys', toys, saved: req.query.saved === '1' });
  });

  router.get('/toys/new', (req, res) => {
    renderToyForm(res, 200, { toy: null, values: EMPTY_TOY });
  });

  router.post('/toys', receivePhotos, async (req, res) => {
    const values = readToyForm(req.body);
    const errors = validateToy(values);
    if (req.uploadProblem) errors.push(req.uploadProblem);
    if (errors.length > 0) {
      if (req.files?.length > 0 || req.uploadProblem) errors.push('ფოტოები ხელახლა აირჩიე.');
      renderToyForm(res, 422, { toy: null, values, errors });
      return;
    }
    const id = createToy(db, values);
    const problems = await savePhotos(id, req.files);
    if (problems.length > 0) {
      const toy = getToy(db, id);
      renderToyForm(res, 422, { toy, values: toyValues(toy), errors: problems });
      return;
    }
    res.redirect(`/admin/toys/${id}?saved=1`);
  });

  router.get('/toys/:id', (req, res) => {
    const toy = loadToy(req, res);
    if (!toy) return;
    renderToyForm(res, 200, { toy, values: toyValues(toy), saved: req.query.saved === '1' });
  });

  router.post('/toys/:id', (req, res) => {
    const toy = loadToy(req, res);
    if (!toy) return;
    const values = readToyForm(req.body);
    const errors = validateToy(values);
    if (errors.length > 0) {
      renderToyForm(res, 422, { toy, values, errors });
      return;
    }
    updateToy(db, toy.id, values);
    res.redirect(`/admin/toys/${toy.id}?saved=1`);
  });

  router.post('/toys/:id/delete', (req, res) => {
    const toy = loadToy(req, res);
    if (!toy) return;
    const images = listImages(db, toy.id);
    deleteToy(db, toy.id);
    for (const image of images) removeImageFiles(toysDir, image);
    res.redirect('/admin/toys?saved=1');
  });

  router.post('/toys/:id/move', (req, res) => {
    const toy = loadToy(req, res);
    if (!toy) return;
    moveToy(db, toy.id, req.body.direction);
    res.redirect('/admin/toys');
  });

  router.post('/toys/:id/toggle', (req, res) => {
    const toy = loadToy(req, res);
    if (!toy) return;
    toggleToy(db, toy.id, req.body.field);
    res.redirect('/admin/toys');
  });

  router.post('/toys/:id/images', receivePhotos, async (req, res) => {
    const toy = loadToy(req, res);
    if (!toy) return;
    const problems = await savePhotos(toy.id, req.files);
    if (req.uploadProblem) problems.push(req.uploadProblem);
    if (!req.uploadProblem && !req.files?.length) problems.push('აირჩიე მინიმუმ ერთი ფოტო.');
    if (problems.length > 0) {
      renderToyForm(res, 422, { toy, values: toyValues(toy), errors: problems });
      return;
    }
    res.redirect(`/admin/toys/${toy.id}?saved=1`);
  });

  router.post('/toys/:id/images/:imageId/delete', (req, res) => {
    const toy = loadToy(req, res);
    if (!toy) return;
    const image = loadImage(req, res, toy);
    if (!image) return;
    deleteImage(db, image.id);
    removeImageFiles(toysDir, image);
    res.redirect(`/admin/toys/${toy.id}?saved=1`);
  });

  router.post('/toys/:id/images/:imageId/move', (req, res) => {
    const toy = loadToy(req, res);
    if (!toy) return;
    const image = loadImage(req, res, toy);
    if (!image) return;
    moveImage(db, toy.id, image.id, req.body.direction);
    res.redirect(`/admin/toys/${toy.id}`);
  });

  router.post('/toys/:id/images/:imageId/cover', (req, res) => {
    const toy = loadToy(req, res);
    if (!toy) return;
    const image = loadImage(req, res, toy);
    if (!image) return;
    makeCover(db, toy.id, image.id);
    res.redirect(`/admin/toys/${toy.id}?saved=1`);
  });

  function renderContent(res, status, { saved = false } = {}) {
    res.status(status).render('admin/content', { section: 'content', fields: EDITABLE_TEXT, texts: readSiteText(db), saved });
  }

  router.get('/content', (req, res) => renderContent(res, 200, { saved: req.query.saved === '1' }));

  router.post('/content', (req, res) => {
    for (const { key } of EDITABLE_TEXT) {
      saveSiteText(db, key, String(req.body[`${key}__ka`] ?? '').trim(), String(req.body[`${key}__en`] ?? '').trim());
    }
    res.redirect('/admin/content?saved=1');
  });

  function contactFromDb() {
    const texts = readSiteText(db);
    const values = {
      phone: getSetting(db, 'phone'),
      email: getSetting(db, 'email'),
      whatsapp: getSetting(db, 'whatsapp'),
      instagram_url: getSetting(db, 'instagram_url'),
      facebook_url: getSetting(db, 'facebook_url'),
    };
    for (const key of CONTACT_TEXT_KEYS) {
      values[`${key}__ka`] = texts[key].ka;
      values[`${key}__en`] = texts[key].en;
    }
    return values;
  }

  function contactFromForm(body) {
    const values = {};
    const names = ['phone', 'email', 'whatsapp', 'instagram_url', 'facebook_url', ...CONTACT_TEXT_KEYS.flatMap((key) => [`${key}__ka`, `${key}__en`])];
    for (const name of names) values[name] = String(body[name] ?? '').trim();
    return values;
  }

  function validateContact(values) {
    const errors = [];
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.push('ელფოსტა არასწორია. ჩაწერე ასე: name@example.com.');
    if (!normalizeWhatsapp(values.whatsapp).ok) errors.push('WhatsApp ნომერი არასწორია. ჩაწერე ასე: +995 5XX XX XX XX.');
    if (values.instagram_url && !isHttpUrl(values.instagram_url)) errors.push('Instagram ბმული https://-ით უნდა იწყებოდეს.');
    if (values.facebook_url && !isHttpUrl(values.facebook_url)) errors.push('Facebook ბმული https://-ით უნდა იწყებოდეს.');
    return errors;
  }

  function renderContact(res, status, values, { errors = [], saved = false } = {}) {
    const fields = SITE_TEXT.filter(({ key }) => CONTACT_TEXT_KEYS.includes(key));
    res.status(status).render('admin/contact', { section: 'contact', values, fields, errors, saved });
  }

  router.get('/contact', (req, res) => renderContact(res, 200, contactFromDb(), { saved: req.query.saved === '1' }));

  router.post('/contact', (req, res) => {
    const values = contactFromForm(req.body);
    const errors = validateContact(values);
    if (errors.length > 0) {
      renderContact(res, 422, values, { errors });
      return;
    }
    for (const name of ['phone', 'email', 'instagram_url', 'facebook_url']) setSetting(db, name, values[name]);
    setSetting(db, 'whatsapp', normalizeWhatsapp(values.whatsapp).digits);
    for (const key of CONTACT_TEXT_KEYS) saveSiteText(db, key, values[`${key}__ka`], values[`${key}__en`]);
    res.redirect('/admin/contact?saved=1');
  });

  function brandImage(key) {
    const stored = getSetting(db, key);
    return stored ? JSON.parse(stored) : null;
  }

  function renderBrand(res, status, { errors = [], saved = false } = {}) {
    const view = (key) => {
      const image = brandImage(key);
      return image ? imageView('/media/brand', image) : null;
    };
    res.status(status).render('admin/brand', { section: 'brand', logo: view('logo'), hero: view('hero'), errors, saved, maxUploadMb: MAX_UPLOAD_MB });
  }

  router.get('/brand', (req, res) => renderBrand(res, 200, { saved: req.query.saved === '1' }));

  router.post('/brand/:kind', receiveOne, async (req, res, next) => {
    const target = BRAND_IMAGES[req.params.kind];
    if (!target) {
      next();
      return;
    }
    if (req.uploadProblem) {
      renderBrand(res, 422, { errors: [req.uploadProblem] });
      return;
    }
    if (!req.file) {
      renderBrand(res, 422, { errors: ['აირჩიე ფოტო.'] });
      return;
    }
    try {
      const previous = brandImage(req.params.kind);
      const saved = await saveImage(req.file.buffer, brandDir, target.widths);
      setSetting(db, req.params.kind, JSON.stringify(saved));
      if (previous) removeImageFiles(brandDir, previous);
      res.redirect('/admin/brand?saved=1');
    } catch (error) {
      if (!(error instanceof ImageRejected)) throw error;
      renderBrand(res, 422, { errors: [error.message] });
    }
  });

  function renderPassword(res, status, { errors = [], saved = false } = {}) {
    res.status(status).render('admin/password', { section: 'password', errors, saved, minLength: MIN_PASSWORD_LENGTH });
  }

  router.get('/password', (req, res) => renderPassword(res, 200, { saved: req.query.saved === '1' }));

  router.post('/password', (req, res) => {
    const { current_password: current, new_password: next, confirm_password: confirm } = req.body;
    const errors = [];
    if (!verifyPassword(db, current)) errors.push('მიმდინარე პაროლი არასწორია.');
    if (String(next ?? '').length < MIN_PASSWORD_LENGTH) errors.push(`ახალი პაროლი მინიმუმ ${MIN_PASSWORD_LENGTH} სიმბოლო უნდა იყოს.`);
    if (next !== confirm) errors.push('ახალი პაროლი და გამეორება ერთმანეთს არ ემთხვევა.');
    if (errors.length > 0) {
      renderPassword(res, 422, { errors });
      return;
    }
    setPassword(db, next);
    endOtherSessions(db, readCookie(req, SESSION_COOKIE));
    res.redirect('/admin/password?saved=1');
  });

  router.use((req, res) => res.status(404).render('admin/not-found', { section: null }));

  return router;
}
