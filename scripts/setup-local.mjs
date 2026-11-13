import { randomBytes, scryptSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
const root = process.cwd(); const envPath = resolve(root, '.env.local');
let existing = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
const has = key => new RegExp(`^${key}=`, 'm').test(existing);
let password;
const lines = [];
if(!has('PRODUCER_AUTH_MODE'))lines.push('PRODUCER_AUTH_MODE=open');
if (!has('DATABASE_URL') && !has('TGIQ_SQLITE_PATH')) lines.push('TGIQ_SQLITE_PATH=.data/tgiq.sqlite');
if (!has('SESSION_SECRET')) lines.push(`SESSION_SECRET=${randomBytes(48).toString('hex')}`);
if ((existing.match(/^PRODUCER_AUTH_MODE=(.*)$/m)?.[1]??'open')==='password' && !has('PRODUCER_PASSWORD_HASH')) {
  password = randomBytes(18).toString('base64url'); const salt = randomBytes(16).toString('hex');
  lines.push(`PRODUCER_PASSWORD_HASH=${salt}:${scryptSync(password, salt, 64).toString('hex')}`);
}
if (!has('APP_ORIGIN')) lines.push('APP_ORIGIN=http://localhost:3000');
if (lines.length) { existing = existing.trimEnd() + '\n' + lines.join('\n') + '\n'; writeFileSync(envPath, existing, { mode: 0o600 }); chmodSync(envPath, 0o600); }
mkdirSync(resolve(root, '.data'), { recursive: true });
if (password) {
  writeFileSync(resolve(root, '.data/local-access.json'), JSON.stringify({ url: 'http://localhost:3000', producerPassword: password, note: 'Local credentials only. Keep this file private. Regenerate producer password by removing PRODUCER_PASSWORD_HASH and rerunning setup.' }, null, 2), { mode: 0o600 });
  console.log('Local access configured. Your producer password is in .data/local-access.json.');
} else console.log('Producer access configured. No password is required in open mode.');
console.log('Durable local storage is configured. Start with npm run dev; no football API key is needed.');
