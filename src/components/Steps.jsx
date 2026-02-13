import { motion } from 'framer-motion';

export default function Steps({ t }) {
  return (
    <section id="como" className="section-padding">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-10 flex flex-col gap-3">
          <h2 className="text-3xl font-semibold text-navy md:text-4xl">{t.steps.title}</h2>
          <p className="max-w-2xl text-base text-navy/70">{t.steps.subtitle}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.steps.items.map((step, index) => (
            <motion.div
              key={step}
              className="glass-card rounded-2xl p-6 shadow-soft"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 * index }}
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-tealsoft text-sm font-semibold text-navy">
                0{index + 1}
              </div>
              <p className="text-sm text-navy/70">{step}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
