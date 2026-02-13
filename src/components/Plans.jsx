import { motion } from 'framer-motion';

export default function Plans({ t }) {
  return (
    <section id="servicos" className="section-padding">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-10 flex flex-col gap-3">
          <h2 className="text-3xl font-semibold text-navy md:text-4xl">{t.services.title}</h2>
          <p className="max-w-2xl text-base text-navy/70">{t.services.subtitle}</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <motion.div
            className="rounded-2xl border border-navy/10 bg-white/80 p-8 shadow-soft transition hover:-translate-y-1"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-semibold text-navy">{t.services.base.name}</h3>
              <span className="text-sm font-semibold text-teal">{t.services.base.price}</span>
            </div>
            <p className="mt-2 text-sm text-navy/70">{t.services.base.tagline}</p>
            <ul className="mt-6 space-y-3 text-sm text-navy/70">
              {t.services.base.items.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-teal" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div
            className="relative rounded-2xl border border-teal/40 bg-white p-8 shadow-softLg transition hover:-translate-y-1"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <div className="absolute -top-4 right-6 rounded-full bg-teal px-4 py-1 text-xs font-semibold uppercase tracking-widest text-white">
              Premium
            </div>
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-semibold text-navy">{t.services.premium.name}</h3>
              <span className="text-sm font-semibold text-teal">{t.services.premium.price}</span>
            </div>
            <p className="mt-2 text-sm text-navy/70">{t.services.premium.tagline}</p>
            <ul className="mt-6 space-y-3 text-sm text-navy/70">
              {t.services.premium.items.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-teal" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
        <p className="mt-6 text-sm text-navy/60">{t.services.pricingNote}</p>
      </div>
    </section>
  );
}
