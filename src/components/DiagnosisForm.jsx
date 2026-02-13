import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';

const WHATSAPP_NUMBER = '351919676329';
const EMAIL = 'joana_krisna@hotmail.com';
const INSTAGRAM_URL = 'https://www.instagram.com/family_in_trouble/';

function buildMessage(data, t) {
  const lines = [t.messageIntro];
  const addLine = (label, value) => {
    if (value) lines.push(`${label}: ${value}`);
  };

  addLine(t.messageLabels.name, data.name);
  addLine(t.messageLabels.email, data.email);
  addLine(t.messageLabels.who, data.who);
  addLine(t.messageLabels.dates, data.dates);
  addLine(t.messageLabels.budget, data.budget);
  addLine(t.messageLabels.service, data.service);
  addLine(t.messageLabels.notes, data.notes);

  return lines.join('\n');
}

export default function DiagnosisForm({ t, lang }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      service: t.diagnosis.form.serviceOptions[2],
    },
  });

  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const encodedMessage = useMemo(() => encodeURIComponent(message), [message]);

  const waUrl = message
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`
    : `https://wa.me/${WHATSAPP_NUMBER}`;

  const mailtoUrl = message
    ? `mailto:${EMAIL}?subject=${encodeURIComponent(t.emailSubject)}&body=${encodedMessage}`
    : `mailto:${EMAIL}?subject=${encodeURIComponent(t.emailSubject)}`;

  const onSubmit = async (data) => {
    const formatted = buildMessage(data, t);
    setMessage(formatted);
    try {
      await navigator.clipboard.writeText(formatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      setCopied(false);
    }
  };

  const handleInstagram = async () => {
    if (message) {
      try {
        await navigator.clipboard.writeText(message);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch (err) {
        setCopied(false);
      }
    }
    window.open(INSTAGRAM_URL, '_blank');
  };

  return (
    <section id="diagnostico" className="section-padding">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-10 flex flex-col gap-3">
          <h2 className="text-3xl font-semibold text-navy md:text-4xl">{t.diagnosis.title}</h2>
          <p className="max-w-2xl text-base text-navy/70">{t.diagnosis.subtitle}</p>
        </div>
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="grid gap-4 rounded-2xl border border-navy/10 bg-white/80 p-6 shadow-soft"
          >
            <div>
              <label className="text-sm font-medium text-navy">{t.diagnosis.form.name}</label>
              <input
                className="mt-2 w-full rounded-xl border border-navy/10 bg-white px-4 py-3 text-sm focus:border-teal focus:outline-none"
                placeholder={t.diagnosis.form.name}
                {...register('name', { required: true })}
              />
              {errors.name && (
                <p className="mt-1 text-xs text-blush">{t.diagnosis.form.name} *</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-navy">{t.diagnosis.form.email}</label>
              <input
                className="mt-2 w-full rounded-xl border border-navy/10 bg-white px-4 py-3 text-sm focus:border-teal focus:outline-none"
                placeholder={t.diagnosis.form.email}
                type="email"
                {...register('email', { required: true })}
              />
              {errors.email && (
                <p className="mt-1 text-xs text-blush">{t.diagnosis.form.email} *</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-navy">{t.diagnosis.form.who}</label>
                <input
                  className="mt-2 w-full rounded-xl border border-navy/10 bg-white px-4 py-3 text-sm focus:border-teal focus:outline-none"
                  placeholder={t.diagnosis.form.who}
                  {...register('who')}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-navy">{t.diagnosis.form.dates}</label>
                <input
                  className="mt-2 w-full rounded-xl border border-navy/10 bg-white px-4 py-3 text-sm focus:border-teal focus:outline-none"
                  placeholder={t.diagnosis.form.dates}
                  {...register('dates')}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-navy">{t.diagnosis.form.budget}</label>
                <input
                  className="mt-2 w-full rounded-xl border border-navy/10 bg-white px-4 py-3 text-sm focus:border-teal focus:outline-none"
                  placeholder={t.diagnosis.form.budget}
                  {...register('budget')}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-navy">{t.diagnosis.form.service}</label>
                <select
                  className="mt-2 w-full rounded-xl border border-navy/10 bg-white px-4 py-3 text-sm focus:border-teal focus:outline-none"
                  {...register('service')}
                >
                  {t.diagnosis.form.serviceOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-navy">{t.diagnosis.form.notes}</label>
              <textarea
                rows={4}
                className="mt-2 w-full rounded-xl border border-navy/10 bg-white px-4 py-3 text-sm focus:border-teal focus:outline-none"
                placeholder={t.diagnosis.form.notes}
                {...register('notes')}
              />
            </div>
            <button
              type="submit"
              className="mt-2 inline-flex items-center justify-center rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white shadow-soft hover:-translate-y-0.5 hover:shadow-softLg transition"
            >
              {t.diagnosis.form.submit}
            </button>
          </form>
          <div className="space-y-4">
            <motion.div
              className="rounded-2xl border border-navy/10 bg-white/80 p-6 shadow-soft"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h3 className="text-lg font-semibold text-navy">{t.diagnosis.form.messageTitle}</h3>
              <div className="mt-4 min-h-[180px] rounded-xl border border-navy/10 bg-white p-4 text-sm text-navy/70">
                {message || t.messageIntro}
              </div>
              {copied && (
                <p className="mt-3 text-xs font-medium text-teal">{t.diagnosis.form.copied}</p>
              )}
            </motion.div>
            <div className="grid gap-3">
              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-teal px-6 py-3 text-sm font-semibold text-white shadow-soft hover:-translate-y-0.5 hover:shadow-softLg transition"
              >
                {t.diagnosis.buttons.whatsapp}
              </a>
              <a
                href={mailtoUrl}
                className="inline-flex items-center justify-center rounded-full border border-navy/15 px-6 py-3 text-sm font-semibold text-navy hover:border-teal hover:text-teal transition"
              >
                {t.diagnosis.buttons.email}
              </a>
              <button
                type="button"
                onClick={handleInstagram}
                className="inline-flex items-center justify-center rounded-full border border-navy/15 px-6 py-3 text-sm font-semibold text-navy hover:border-teal hover:text-teal transition"
              >
                {t.diagnosis.buttons.instagram}
              </button>
              <p className="text-xs text-navy/60">
                {lang === 'pt'
                  ? 'WhatsApp e Email abrem com a mensagem preenchida.'
                  : 'WhatsApp and Email open with the message filled in.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
