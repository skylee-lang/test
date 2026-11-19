import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, readSession, sessionCookie, validSecret, idValid, isAuthorized, reply } from '../functions/_lib/security.js';

const secret = 'unit-test-only-very-long-32-plus-character-secret';
const now = 1795000000000;
test('signed sessions are accepted and expire after 30 minutes', async () => {
  const { token, expiresIn } = await createSession(secret, now);
  assert.equal(expiresIn, 1800);
  const request = new Request('https://example.pages.dev/api/listings', {
    headers: { Cookie: sessionCookie(token).split(';')[0] }
  });
  assert.ok(await readSession(request, secret, now + 1799000));
  assert.equal(await readSession(request, secret, now + 1800000), null);
});
test('modified signature is rejected', async () => {
  const { token } = await createSession(secret, now);
  const [payload, signature] = token.split('.');
  const changed = signature[0] === 'A' ? 'B' : 'A';
  const request = new Request('https://example.pages.dev/api/listings', {
    headers: { Cookie: 'wb_test_session=' + payload + '.' + changed + signature.slice(1) }
  });
  assert.equal(await readSession(request, secret, now + 1000), null);
});
test('sessions are not accepted with a different key', async () => {
  const { token } = await createSession(secret, now);
  const request = new Request('https://example.pages.dev/api/listings', {
    headers: { Cookie: 'wb_test_session=' + token }
  });
  assert.equal(await readSession(request, 'another-separate-test-secret-of-32-plus-characters', now + 1000), null);
});
test('sync auth and listing ID checks', () => {
  assert.equal(validSecret('short'), false);
  assert.equal(idValid('DEMO-001'), true);
  assert.equal(idValid('../admin'), false);
  const request = new Request('https://example.pages.dev/api/internal/sync', {
    headers: { Authorization: 'Bearer ' + secret }
  });
  assert.equal(isAuthorized(request, secret), true);
  assert.equal(isAuthorized(request, 'another-separate-test-secret-of-32-plus-characters'), false);
});
test('JSON responses are not cached', async () => {
  const response = reply({ok:true});
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal((await response.json()).ok, true);
});
