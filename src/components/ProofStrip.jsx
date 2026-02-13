import { motion } from 'framer-motion';

export default function ProofStrip({ t }) {
  return (
    <section className="py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 rounded-full border border-navy/10 bg-white/70 px-8 py-4 text-center text-sm font-medium text-navy/70 shadow-soft sm:flex-row">
        {t.proof.map((item) => (
          <motion.span
            key={item}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {item}
          </motion.span>
        ))}
      </div>
    </section>
  );
}
