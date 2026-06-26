// Vendor tool: mint an OFFLINE monthly license key, signed with the issuer private key.
//
//   node scripts/sign-license-key.mjs [installId] [days] [graceDays]
//
//   installId  the customer's Install ID (shown on the app's activation screen),
//              or '*' for a key valid on any machine. Default: '*'
//   days       paid period length. Default: 30
//   graceDays  grace window after expiry. Default: 5
//
// Prints the key (a JWT) to stdout — paste it into the app's activation screen.
// Requires server/.keys/issuer-private.pem (generated once; never commit it).
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { importPKCS8, SignJWT } from 'jose';

const installId = process.argv[2] || '*';
const days = Number(process.argv[3] || 30);
const graceDays = Number(process.argv[4] || 5);

const pem = readFileSync(new URL('../.keys/issuer-private.pem', import.meta.url), 'utf8');
const key = await importPKCS8(pem, 'EdDSA');

const nowSec = Math.floor(Date.now() / 1000);
const accessUntil = nowSec + days * 86400;
const exp = accessUntil + graceDays * 86400;

const jwt = await new SignJWT({ plan: 'monthly', mode: 'offline', accessUntil, graceDays })
  .setProtectedHeader({ alg: 'EdDSA', kid: 'manual-1' })
  .setIssuer('posdash')
  .setSubject(installId)
  .setIssuedAt(nowSec)
  .setExpirationTime(exp)
  .setJti(randomUUID())
  .sign(key);

process.stderr.write(
  `Signed monthly key — install=${installId}, paid ${days}d + ${graceDays}d grace, ` +
    `accessUntil=${new Date(accessUntil * 1000).toISOString()}\n\n`,
);
process.stdout.write(jwt + '\n');
