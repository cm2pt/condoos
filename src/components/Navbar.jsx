import { useState } from 'react';
import logoUrl from '../assets/logo.png';

export default function Navbar({ lang, setLang, t }) {
  const [logoError, setLogoError] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-navy/10">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="#top" className="flex items-center gap-3">
          {!logoError ? (
            <img
              src={logoUrl}
              alt="TravelBuddies"
              className="h-10 w-10 rounded-full object-cover shadow-soft"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal text-white">TB</div>
          )}
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-navy/70">TravelBuddies</p>
            <p className="text-sm font-medium text-navy">Organizamos Viagens em Familia</p>
          </div>
        </a>
        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          <a href="#servicos" className="hover:text-teal transition">{t.nav.services}</a>
          <a href="#como" className="hover:text-teal transition">{t.nav.steps}</a>
          <a href="#diagnostico" className="hover:text-teal transition">{t.nav.diagnosis}</a>
        </nav>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLang(lang === 'pt' ? 'en' : 'pt')}
            className="rounded-full border border-navy/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-navy/70 hover:border-teal hover:text-teal transition"
            aria-label="Toggle language"
          >
            {lang === 'pt' ? 'EN' : 'PT'}
          </button>
        </div>
      </div>
    </header>
  );
}
