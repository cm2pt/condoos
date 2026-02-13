export default function Footer({ t }) {
  return (
    <footer className="border-t border-navy/10 bg-white/70 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-navy/70">TravelBuddies</p>
          <p className="text-sm text-navy/70">{t.footer.line}</p>
        </div>
        <p className="text-xs text-navy/60">{t.footer.disclaimer}</p>
      </div>
    </footer>
  );
}
