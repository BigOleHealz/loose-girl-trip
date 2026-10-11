"use client";
import { useEffect, useState } from 'react';

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
export default function InstallApp() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)');
    const onPrompt = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt); window.addEventListener('appinstalled', onInstalled);
    if (media.matches) queueMicrotask(onInstalled);
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => setError('Install support could not load. Refresh while online to retry.'));
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  async function install() {
    if (!prompt) return;
    try { await prompt.prompt(); if ((await prompt.userChoice).outcome === 'accepted') setInstalled(true); }
    catch { setError('Use your browser menu to install this app.'); }
    finally { setPrompt(null); }
  }
  if (installed) return <p className="hint install-status">Ready for the road · app installed</p>;
  return <details className="install-app"><summary>Install app <span aria-hidden="true">↗</span></summary><p className="hint">Keep Loose Girl Trip on your home screen.</p>
    {prompt && <button className="primary-button" onClick={() => void install()}>Install Loose Girl Trip</button>}
    <p className="hint"><strong>iPhone/iPad:</strong> open in Safari, tap Share, then Add to Home Screen.</p><p className="hint"><strong>Android/desktop:</strong> open your browser menu and choose Install app or Add to Home Screen.</p>
    <p className="hint">Maps, weather, shared edits and sign-in need an internet connection.</p>{error && <p className="error" role="alert">{error}</p>}
  </details>;
}
