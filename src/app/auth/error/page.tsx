import Link from 'next/link';

export default function AuthError() {
  return <main className="join-page"><div className="join-card"><h1>Let’s try signing in again.</h1><p>Sign-in could not complete. Return to the map and continue with Google again.</p><Link href="/">Back to the map</Link></div></main>;
}
