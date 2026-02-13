import { motion } from 'framer-motion';
import { useState } from 'react';
import tileOne from '../assets/tile1.jpg';
import tileTwo from '../assets/tile2.jpg';

export default function PainPoints({ t, fallbackImages }) {
  const [img1, setImg1] = useState(tileOne);
  const [img2, setImg2] = useState(tileTwo);

  return (
    <section className="section-padding">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-10 flex flex-col gap-3">
          <h2 className="text-3xl font-semibold text-navy md:text-4xl">{t.painPoints.title}</h2>
          <p className="max-w-2xl text-base text-navy/70">{t.painPoints.subtitle}</p>
        </div>
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              { img: img1, setImg: setImg1, caption: t.painPoints.tiles[0].caption },
              { img: img2, setImg: setImg2, caption: t.painPoints.tiles[1].caption },
            ].map((tile, index) => (
              <motion.div
                key={tile.caption}
                className="group relative overflow-hidden rounded-2xl shadow-soft"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 * index }}
              >
                <img
                  src={tile.img}
                  onError={() => tile.setImg(index === 0 ? fallbackImages.tile1 : fallbackImages.tile2)}
                  alt="TravelBuddies real life"
                  className="h-64 w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy/50 via-transparent to-transparent" />
                <p className="absolute bottom-4 left-4 right-4 text-sm font-medium text-white">
                  {tile.caption}
                </p>
              </motion.div>
            ))}
          </div>
          <div className="grid gap-4">
            {t.painPoints.cards.map((card, index) => (
              <motion.div
                key={card.title}
                className="glass-card rounded-2xl p-6 shadow-soft transition hover:-translate-y-1"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 * index }}
              >
                <h3 className="text-lg font-semibold text-navy">{card.title}</h3>
                <p className="mt-2 text-sm text-navy/70">{card.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
