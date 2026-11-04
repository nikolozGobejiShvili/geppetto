const LOCAL_GEORGIAN_MOBILE = /^5\d{8}$/;
const PHONE_CHARACTERS = /^[+\d\s()-]+$/;
const MIN_PHONE_DIGITS = 10;
const MAX_PHONE_DIGITS = 15;

export function normalizeWhatsapp(value) {
  const text = String(value ?? '').trim();
  if (text === '') return { ok: true, digits: '' };
  if (!PHONE_CHARACTERS.test(text)) return { ok: false };
  const digits = text.replace(/\D/g, '');
  if (LOCAL_GEORGIAN_MOBILE.test(digits)) return { ok: true, digits: `995${digits}` };
  if (digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS) return { ok: false };
  return { ok: true, digits };
}

export function buildOrderMessage(template, { name, link }) {
  const text = template
    .replace(/\r\n/g, '\n')
    .replaceAll('{name}', () => name)
    .replaceAll('{link}', () => link);
  return text.includes(link) ? text : `${text}\n${link}`;
}

function pathParts(url) {
  try {
    const parsed = new URL(url);
    return { parsed, parts: parsed.pathname.split('/').filter(Boolean) };
  } catch {
    return { parsed: null, parts: [] };
  }
}

function facebookHandle(url) {
  const { parsed, parts } = pathParts(url);
  if (parts[0] === 'profile.php') return parsed.searchParams.get('id');
  if (parts[0] === 'people' || parts[0] === 'pages') return parts.at(-1);
  return parts[0];
}

export function whatsappLink(digits, message) {
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function messengerLink(facebookUrl, message) {
  const handle = facebookHandle(facebookUrl);
  return handle ? `https://m.me/${handle}?text=${encodeURIComponent(message)}` : facebookUrl;
}

// ig.me links cannot carry a message, so the visitor pastes the copied link.
export function instagramLink(instagramUrl) {
  const [handle] = pathParts(instagramUrl).parts;
  return handle ? `https://ig.me/m/${handle}` : instagramUrl;
}

export function orderChannels({ whatsapp, instagram, facebook }, message) {
  const channels = [];
  if (whatsapp) channels.push({ key: 'whatsapp', href: whatsappLink(whatsapp, message) });
  if (instagram) channels.push({ key: 'instagram', href: instagramLink(instagram) });
  if (facebook) channels.push({ key: 'facebook', href: messengerLink(facebook, message) });
  return channels;
}
