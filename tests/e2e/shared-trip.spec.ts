import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { EMPTY_TRIP, STORAGE_KEY } from '../../src/lib/trip';

// No auth tokens in Playwright traces or screenshots.
test.use({ trace: 'off' });
test('two authenticated browsers migrate, invite, edit live and share a real driving route', async ({ browser, request }) => {
  test.setTimeout(120000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const adminKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  test.skip(!url || !key || !adminKey || !process.env.ORS_API_KEY, 'Live verification requires the provisioned Supabase and ORS environment.');
  const admin = createClient(url!, adminKey!, { global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) }, auth: { persistSession: false, autoRefreshToken: false } });
  const users: string[] = [];
  const contexts = [await browser.newContext({ baseURL: 'http://127.0.0.1:3107', viewport: { width: 1440, height: 1200 } }), await browser.newContext({ baseURL: 'http://127.0.0.1:3107', viewport: { width: 390, height: 844 } })];
  let outsider: typeof admin | null = null;
  async function identity(index: number) {
    const email = `loose-trip-check-${Date.now()}-${index}@example.com`;
    const created = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (created.error || !created.data.user) throw new Error('Could not create a temporary verification account.');
    users.push(created.data.user.id);
    // generateLink returns a link but never sends mail.
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    if (link.error || !link.data.properties?.hashed_token) throw new Error('Could not generate a test sign-in link.');
    return link.data.properties.hashed_token;
  }
  try {
    const tokens = [await identity(0), await identity(1), await identity(2)];
    const a = await contexts[0].newPage(), b = await contexts[1].newPage();
    const local = { ...EMPTY_TRIP, name: 'Live verification road trip', startDate: '2027-01-01', endDate: '2027-12-31', stops: [
      { id: crypto.randomUUID(), name: 'Denver', state: 'CO', lat: 39.74, lon: -104.99, arriveDate: '2027-06-01', departDate: '2027-06-05' },
      { id: crypto.randomUUID(), name: 'Topeka', state: 'KS', lat: 39.05, lon: -95.68, arriveDate: '2027-06-06', departDate: '2027-06-09' },
    ] };
    await a.addInitScript(({ key, trip }) => {
      if (!localStorage.getItem('test-seeded')) { localStorage.setItem(key, JSON.stringify(trip)); localStorage.setItem('test-seeded', 'true'); }
    }, { key: STORAGE_KEY, trip: local });
    // Catch navigation failures without exposing the one-time token URL.
    try { await a.goto(`/auth/confirm?token_hash=${encodeURIComponent(tokens[0])}`, { waitUntil: 'domcontentloaded', timeout: 20000 }); }
    catch { throw new Error('Test account A could not complete its callback.'); }
    await expect(a.getByRole('button', { name: 'Shared trips' })).toBeVisible({ timeout: 15000 });
    await a.getByRole('button', { name: 'Shared trips' }).click();
    await expect(a.getByRole('button', { name: 'Upload my local trip' })).toBeVisible({ timeout: 10000 });
    await a.getByRole('button', { name: 'Upload my local trip' }).click();
    await expect(a.locator('.stop-card')).toHaveCount(2);
    expect(await a.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBeNull();
    await a.getByRole('button', { name: 'Invite a traveler' }).click();
    const invite = await a.getByLabel('Invite link (expires in 7 days)').inputValue();
    const invitePath = new URL(invite).pathname;
    try { await b.goto(`/auth/confirm?token_hash=${encodeURIComponent(tokens[1])}&next=${encodeURIComponent(invitePath)}`, { waitUntil: 'domcontentloaded', timeout: 20000 }); }
    catch { throw new Error('Test account B could not complete its callback.'); }
    await b.getByRole('button', { name: 'Join this trip' }).click();
    await expect(b.locator('.stop-card')).toHaveCount(2);
    await expect(a.locator('.route-summary details')).toHaveCount(1, { timeout: 45000 });
    await expect(b.locator('.route-summary details')).toHaveCount(1, { timeout: 45000 });
    await expect(a.locator('.leaflet-overlay-pane path')).toBeVisible();
    await a.locator('.route-summary summary').click();
    await expect(a.locator('.route-summary details')).toContainText('Colorado');
    await expect(a.locator('.route-summary details')).toContainText('Kansas');
    const summary = a.locator('.route-summary summary small');
    await expect(summary).toContainText('mi');
    let routeRequests = 0;
    a.on('request', req => { if (req.url().endsWith('/api/route')) routeRequests++; });
    b.on('request', req => { if (req.url().endsWith('/api/route')) routeRequests++; });
    await a.getByRole('button', { name: 'Edit Denver', exact: true }).click();
    await a.getByLabel('Stop name').fill('Denver base camp');
    await a.getByLabel('Depart', { exact: true }).fill('2027-06-04');
    await a.getByRole('button', { name: 'Save stop', exact: true }).click();
    await expect(b.locator('.stop-title strong').first()).toHaveText('Denver base camp', { timeout: 15000 });
    await b.getByRole('button', { name: 'Edit Topeka', exact: true }).click();
    await b.getByLabel('Stop name').fill('Topeka hideaway');
    await b.getByRole('button', { name: 'Save stop', exact: true }).click();
    await expect(a.locator('.stop-title strong').last()).toHaveText('Topeka hideaway', { timeout: 15000 });
    expect(routeRequests).toBe(0); // Date/name edits reuse the coordinate-keyed route.

    const tripId = await a.evaluate(() => localStorage.getItem('loose-girl-trip:active-cloud-trip'));
    outsider = createClient(url!, key!, { auth: { persistSession: false, autoRefreshToken: false } });
    const auth = await outsider.auth.verifyOtp({ token_hash: tokens[2], type: 'email' });
    if (auth.error) throw new Error('Could not verify the outsider test session.');
    const hidden = await outsider.from('trips').select('id').eq('id', tripId!);
    expect(hidden.error).toBeNull(); expect(hidden.data).toEqual([]);
    const hiddenStops = await outsider.from('stops').select('id').eq('trip_id', tripId!);
    expect(hiddenStops.data).toEqual([]);
    const blockedInvite = await outsider.from('invites').insert({ trip_id: tripId });
    expect(Boolean(blockedInvite.error)).toBe(true);
    const blockedLeg = await outsider.rpc('claim_leg', { target: tripId, key: 'outsider-check' });
    expect(Boolean(blockedLeg.error)).toBe(true);
    const anonymous = await request.post('/api/route', { data: { tripId, fromStopId: local.stops[0].id, toStopId: local.stops[1].id } });
    expect(anonymous.status()).toBe(401);

    // Even anonymous/expired invites cannot enroll a traveler. A valid link can.
    const expiredCode = crypto.randomUUID();
    const expired = await admin.from('invites').insert({ code: expiredCode, trip_id: tripId, expires_at: '2020-01-01T00:00:00Z' });
    expect(expired.error).toBeNull();
    expect(Boolean((await outsider.rpc('join_trip', { invite_code: expiredCode })).error)).toBe(true);
    expect((await outsider.rpc('join_trip', { invite_code: invitePath.split('/').pop() })).data).toBe(tripId);
    const claims = await Promise.all([1, 2].map(() => outsider!.rpc('claim_leg', { target: tripId, key: 'verification-lease' })));
    expect(claims.every(c => !c.error)).toBe(true);
    expect(claims.map(c => c.data.status).sort()).toEqual(['claimed', 'pending']);
    const token = claims.find(c => c.data.status === 'claimed')!.data.token;
    expect((await outsider.rpc('finish_leg', { target: tripId, key: 'verification-lease', token: crypto.randomUUID(), result: null })).data).toBe(false);
    expect((await outsider.rpc('finish_leg', { target: tripId, key: 'verification-lease', token, result: null })).data).toBe(true);
    await a.screenshot({ path: 'test-results/shared-trip-desktop.png' });
    await b.screenshot({ path: 'test-results/shared-trip-mobile.png' });

    // Verify shared deletions arrive through Realtime without a refresh.
    await b.getByRole('button', { name: 'Delete Topeka hideaway', exact: true }).click();
    await expect(a.locator('.stop-card')).toHaveCount(1, { timeout: 15000 });
    await b.reload();
    await expect(b.locator('.stop-card')).toHaveCount(1);
    expect(await b.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBeNull();
    for (const page of [a, b]) {
      const panel = page.getByRole('button', { name: 'Shared trips' });
      if (await panel.getAttribute('aria-expanded') === 'false') await panel.click();
      await page.getByRole('button', { name: 'Sign out', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Plan together' })).toBeVisible();
    }
  } finally {
    if (outsider) await outsider.auth.signOut({ scope: 'global' });
    await Promise.allSettled(contexts.map(c => c.close()));
    for (const id of users) await admin.auth.admin.deleteUser(id);
  }
});
