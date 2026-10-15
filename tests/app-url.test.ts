import test from 'node:test';
import assert from 'node:assert/strict';
import { PUBLIC_APP_ORIGIN, travelerInviteUrl } from '../src/lib/app-url';

test('traveler invites always use the public app, including invites created on protected review builds', () => {
  const code = '12345678-1234-1234-1234-123456789abc';
  for (const origin of [PUBLIC_APP_ORIGIN, 'https://loose-girl-trip-git-codex-shared-t-11e503-bigolehealzs-projects.vercel.app', 'https://loose-girl-trip-jplio4y3d-bigolehealzs-projects.vercel.app']) {
    assert.equal(travelerInviteUrl(code, origin), `${PUBLIC_APP_ORIGIN}/join/${code}`);
  }
  for (const origin of ['http://localhost:3000', 'http://127.0.0.1:3107', 'http://[::1]:3000']) {
    assert.equal(travelerInviteUrl(code, origin), `${origin}/join/${code}`);
  }
});
