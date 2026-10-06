// Isolated component fixture. No account, API client, or production navigation.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import i18n from 'i18next';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import { Input, TimeCommitInput } from '../src/components/ui/input';
import '../src/index.css';

await i18n.use(initReactI18next).init({
  lng: 'de',
  resources: {
    de: {
      translation: {
        common: {
          time24HourHint:
            'Uhrzeit von 00:00 bis 23:59 eingeben, zum Beispiel 14:30.',
        },
      },
    },
  },
});
export default function ClockReview() {
  const [time, setTime] = useState('14:30');
  const [planned, setPlanned] = useState('18:45');
  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <section className="mx-auto max-w-lg space-y-6 rounded-xl border bg-card p-6">
        <h1 className="text-2xl font-semibold">
          Uhrzeiten im 24-Stunden-Format
        </h1>
        <p className="text-sm text-muted-foreground">
          Isolierte Vorschau mit Beispieldaten
        </p>
        <div className="space-y-2">
          <label htmlFor="reminder">Erinnerung</label>
          <TimeCommitInput id="reminder" value={time} onCommit={setTime} />
          <p className="text-sm text-muted-foreground" id="saved">
            Gespeichert: {time}
          </p>
        </div>
        <form
          className="space-y-2"
          onSubmit={(event) => event.preventDefault()}
        >
          <label htmlFor="training">Trainingszeit</label>
          <Input
            id="training"
            type="time"
            value={planned}
            onChange={(event) => setPlanned(event.target.value)}
          />
          <button type="submit" className="rounded-lg border px-4 py-2">
            Prüfen
          </button>
        </form>
      </section>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(
  <I18nextProvider i18n={i18n}>
    <ClockReview />
  </I18nextProvider>
);
