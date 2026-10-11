import { expect, test } from '@playwright/test';

test('Google sign-in preserves the invite return path and uses PKCE', async ({ page }) => {
  const code = '12345678-1234-1234-1234-123456789abc';
  let authorize: URL | null = null;
  // Exercise the real SDK redirect without signing in a personal Google account.
  await page.route('**/auth/v1/authorize?**', async route => {
    authorize = new URL(route.request().url());
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Google authorization reached</h1>' });
  });
  await page.goto(`/join/${code}`);
  await page.getByRole('button', { name: 'Plan together' }).click();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.getByLabel('Email address')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.getByRole('heading', { name: 'Google authorization reached' })).toBeVisible();
  const destination = authorize as URL | null;
  expect(destination).not.toBeNull();
  expect(destination!.searchParams.get('provider')).toBe('google');
  expect(destination!.searchParams.get('code_challenge_method')).toBe('s256');
  expect(destination!.searchParams.get('code_challenge')).toBeTruthy();
  const callback = new URL(destination!.searchParams.get('redirect_to')!);
  expect(callback.origin).toBe('http://127.0.0.1:3107');
  expect(callback.pathname).toBe('/auth/confirm');
  expect(callback.searchParams.get('next')).toBe(`/join/${code}`);
});
