import { useState } from 'react';
import { motion } from 'framer-motion';
import heroImg from '../assets/hero.jpg';

export default function Hero({ t, fallbackImages }) {
  const [imgSrc, setImgSrc] = useState(heroImg);

  return (
    <section id="top" className="section-padding">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-[1.1fr_0.9fr]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-6"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-teal">TravelBuddies</p>
          <h1 className="text-4xl font-semibold leading-tight text-navy md:text-5xl">
            {t.hero.headline}
          </h1>
          <p className="text-lg text-navy/70">{t.hero.subhead}</p>
          <p className="max-w-xl text-base text-navy/70">{t.hero.intro}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href="#diagnostico"
              className="inline-flex items-center justify-center rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white shadow-soft hover:-translate-y-0.5 hover:shadow-softLg transition"
            >
              {t.hero.primaryCta}
            </a>
            <a
              href="#servicos"
              className="inline-flex items-center justify-center rounded-full border border-navy/15 px-6 py-3 text-sm font-semibold text-navy hover:border-teal hover:text-teal transition"
            >
              {t.hero.secondaryCta}
            </a>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="relative"
        >
          <div className="absolute -left-6 -top-6 h-full w-full rounded-[2.5rem] bg-tealsoft/60" />
          <div className="relative overflow-hidden rounded-[2.5rem] shadow-softLg">
            <img
              src={imgSrc}
              onError={() => setImgSrc(fallbackImages.hero)}
              alt="Familia a viajar"
              className="h-[420px] w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-navy/30 via-transparent to-transparent" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
