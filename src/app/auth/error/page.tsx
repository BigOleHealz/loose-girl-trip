import Link from 'next/link';

export default function AuthError() {
  return <main className="join-page"><div className="join-card"><h1>Let’s try a fresh link.</h1><p>This sign-in link has expired, has already been used, or could not connect. Return to the map and request another email link.</p><Link href="/">Back to the map</Link></div></main>;
}
