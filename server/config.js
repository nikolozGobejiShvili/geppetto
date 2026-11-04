import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url));

export function readConfig(env = process.env) {
  return {
    dataDir: env.DATA_DIR ? path.resolve(env.DATA_DIR) : path.join(PROJECT_ROOT, 'data'),
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? '127.0.0.1',
    cookieSecure: env.COOKIE_SECURE === '1',
    trustProxy: env.TRUST_PROXY === '1',
  };
}
