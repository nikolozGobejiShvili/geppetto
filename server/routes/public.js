import express from 'express';
import { readSiteText, translator } from '../content.js';
import { getSetting } from '../db.js';
import { FIXED, LANGUAGES } from '../i18n.js';
import { imageView } from '../images.js';
import { buildOrderMessage, orderChannels } from '../order.js';
import { formatPrice } from '../price.js';
import { getPublishedToyBySlug, listHomeToys, listImages, listPublishedToys } from '../toys.js';

const HOME_TOY_LIMIT = 6;

function prefixFor(lang) {
  return lang === 'en' ? '/en' : '';
}

function pathIn(lang, path) {
  const prefix = prefixFor(lang);
  if (path === '/') return prefix || '/';
  return `${prefix}${path}`;
}

function readBrandImage(db, key) {
  const stored = getSetting(db, key);
  return stored ? imageView('/media/brand', JSON.parse(stored)) : null;
}

function readContact(db, t) {
  const phone = getSetting(db, 'phone');
  const contact = {
    phone,
    email: getSetting(db, 'email'),
    whatsapp: getSetting(db, 'whatsapp'),
    instagram: getSetting(db, 'instagram_url'),
    facebook: getSetting(db, 'facebook_url'),
    address: t('contact_address'),
    hours: t('contact_hours'),
  };
  const hasAny = Object.values(contact).some(Boolean);
  return { ...contact, hasAny, phoneHref: phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : '' };
}

function viewLocals(db, lang, currentPath, req) {
  const t = translator(readSiteText(db), lang);
  const origin = `${req.protocol}://${req.get('host')}`;
  return {
    lang,
    t,
    fixed: FIXED[lang],
    url: (path) => pathIn(lang, path),
    currentPath,
    languages: LANGUAGES.map((code) => ({
      code,
      name: FIXED[code].languageName,
      href: pathIn(code, currentPath),
      absolute: `${origin}${pathIn(code, currentPath)}`,
    })),
    logo: readBrandImage(db, 'logo'),
    contact: readContact(db, t),
    pageTitle: t('meta_title'),
    pageDescription: t('meta_description'),
    formatPrice: (tetri) => formatPrice(tetri, lang),
    toyName: (toy) => toy[`name_${lang}`] || toy.name_ka,
  };
}

function withCover(db, toys) {
  return toys.map((toy) => {
    const [cover] = listImages(db, toy.id);
    return { ...toy, cover: cover ? imageView('/media/toys', cover) : null };
  });
}

export function publicRouter({ db, lang }) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const locals = viewLocals(db, lang, '/', req);
    res.render('public/home', {
      ...locals,
      hero: readBrandImage(db, 'hero'),
      toys: withCover(db, listHomeToys(db, HOME_TOY_LIMIT)),
    });
  });

  router.get('/toys', (req, res) => {
    const locals = viewLocals(db, lang, '/toys', req);
    res.render('public/toys', {
      ...locals,
      pageTitle: `${locals.t('toys_title')} | ${locals.t('meta_title')}`,
      toys: withCover(db, listPublishedToys(db)),
    });
  });

  router.get('/toys/:slug', (req, res, next) => {
    const toy = getPublishedToyBySlug(db, req.params.slug);
    if (!toy) {
      next();
      return;
    }
    const locals = viewLocals(db, lang, `/toys/${toy.slug}`, req);
    const description = toy[`description_${lang}`] || toy.description_ka;
    const orderMessage = buildOrderMessage(locals.t('order_message'), {
      name: locals.toyName(toy),
      link: locals.languages.find(({ code }) => code === lang).absolute,
    });
    res.render('public/toy', {
      ...locals,
      pageTitle: `${locals.toyName(toy)} | ${locals.t('meta_title')}`,
      pageDescription: description || locals.pageDescription,
      toy,
      description,
      orderMessage,
      channels: orderChannels(locals.contact, orderMessage),
      age: toy[`age_${lang}`] || toy.age_ka,
      images: listImages(db, toy.id).map((image) => imageView('/media/toys', image)),
    });
  });

  router.get('/contact', (req, res) => {
    const locals = viewLocals(db, lang, '/contact', req);
    res.render('public/contact', {
      ...locals,
      pageTitle: `${locals.t('contact_title')} | ${locals.t('meta_title')}`,
    });
  });

  return router;
}

function languageOfPath(path) {
  return path === '/en' || path.startsWith('/en/') ? 'en' : 'ka';
}

function renderProblem(db, req, res, status, titleKey, textKey) {
  const lang = languageOfPath(req.path);
  const locals = viewLocals(db, lang, '/', req);
  res.status(status).render('public/problem', {
    ...locals,
    currentPath: null,
    pageTitle: locals.fixed[titleKey],
    problemTitle: locals.fixed[titleKey],
    problemText: locals.fixed[textKey],
  });
}

export function notFoundHandler({ db }) {
  return (req, res) => renderProblem(db, req, res, 404, 'notFoundTitle', 'notFoundText');
}

export function errorHandler({ db, log }) {
  return (error, req, res, next) => {
    log(error);
    if (res.headersSent) {
      next(error);
      return;
    }
    renderProblem(db, req, res, 500, 'errorTitle', 'errorText');
  };
}
