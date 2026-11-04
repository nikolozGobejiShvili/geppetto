import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'geppetto_admin';
const SESSION_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function generatePassword() {
  return randomBytes(12).toString('base64url');
}

export function verifyPassword(db, password) {
  const row = db.prepare('SELECT password_hash FROM admin WHERE id = 1').get();
  if (!row) return false;
  const [salt, hash] = row.password_hash.split(':');
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(String(password ?? ''), Buffer.from(salt, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

export function setPassword(db, password) {
  db.prepare(
    'INSERT INTO admin (id, password_hash) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash',
  ).run(hashPassword(password));
}

// Returns the new password on the very first start, otherwise null.
export function ensureAdmin(db) {
  if (db.prepare('SELECT 1 FROM admin WHERE id = 1').get()) return null;
  const password = generatePassword();
  setPassword(db, password);
  return password;
}

export function resetPassword(db) {
  const password = generatePassword();
  setPassword(db, password);
  db.prepare('DELETE FROM sessions').run();
  return password;
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function createSession(db) {
  const token = randomBytes(32).toString('hex');
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  db.prepare('INSERT INTO sessions (token_hash, expires_at) VALUES (?, ?)').run(hashToken(token), Date.now() + SESSION_LIFETIME_MS);
  return token;
}

export function hasSession(db, token) {
  if (!token) return false;
  const row = db.prepare('SELECT expires_at FROM sessions WHERE token_hash = ?').get(hashToken(token));
  return Boolean(row && row.expires_at > Date.now());
}

export function endSession(db, token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

// Ends every session except the given one, used after a password change.
export function endOtherSessions(db, token) {
  db.prepare('DELETE FROM sessions WHERE token_hash <> ?').run(hashToken(token));
}

export function readCookie(req, name) {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return null;
}

export function sessionCookieOptions(secure) {
  return { httpOnly: true, sameSite: 'strict', secure, path: '/admin', maxAge: SESSION_LIFETIME_MS };
}

export function createLoginLimiter(now = Date.now) {
  const attempts = new Map();
  return {
    isBlocked(ip) {
      const entry = attempts.get(ip);
      if (!entry) return false;
      if (now() - entry.firstFailure > LOCKOUT_MS) {
        attempts.delete(ip);
        return false;
      }
      return entry.count >= MAX_FAILED_LOGINS;
    },
    recordFailure(ip) {
      const entry = attempts.get(ip) ?? { count: 0, firstFailure: now() };
      entry.count += 1;
      attempts.set(ip, entry);
    },
    clear(ip) {
      attempts.delete(ip);
    },
  };
}

// Same-origin check for state-changing requests. SameSite cookies cover the rest.
export function sameOriginOnly(req, res, next) {
  const origin = req.get('origin');
  if (req.method !== 'GET' && req.method !== 'HEAD' && origin) {
    let host = null;
    try {
      host = new URL(origin).host;
    } catch {
      host = null;
    }
    if (host !== req.get('host')) {
      res.status(403).type('text/plain').send('მოთხოვნა სხვა საიტიდან უარყოფილია.');
      return;
    }
  }
  next();
}
