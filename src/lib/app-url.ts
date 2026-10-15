export const PUBLIC_APP_ORIGIN = 'https://loose-girl-trip.vercel.app';

/** Traveler links must not send friends through Vercel's protected review URLs. */
export function travelerInviteUrl(code: string, currentOrigin: string): string {
  const current = new URL(currentOrigin);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(current.hostname);
  return new URL(`/join/${encodeURIComponent(code)}`, local ? current.origin : PUBLIC_APP_ORIGIN).toString();
}
