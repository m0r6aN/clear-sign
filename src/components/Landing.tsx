import { ArrowRight, ShieldAlert, CheckCircle2, FileText, Camera } from 'lucide-react';
import { copy } from '../content/copy';
import Logo from './Logo';

interface Props {
  onGetStarted: () => void;
}

export default function Landing({ onGetStarted }: Props) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <header className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Logo />
          <div>
            <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              {copy.app.name}
            </span>
            <span className="ml-2 text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
              {copy.app.subtitle}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="max-w-xl w-full space-y-6">
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white leading-tight">
              {copy.hero.headline}
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              {copy.hero.body}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {copy.hero.scaryClauses}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            <Feature icon={<ShieldAlert className="w-5 h-5 text-red-500" />} label="Red flags" desc="Risky clauses flagged instantly" />
            <Feature icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />} label="Obligations" desc="Know exactly what you're agreeing to" />
            <Feature icon={<Camera className="w-5 h-5 text-blue-500" />} label="Scan or upload" desc="Photo, .txt, or .docx — any device" />
          </div>

          <button
            onClick={onGetStarted}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-lg rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            {copy.hero.cta}
            <ArrowRight className="w-5 h-5" />
          </button>

          <p className="text-sm text-slate-500 dark:text-slate-400">
            {copy.hero.freeNote}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {copy.hero.trustNote}
          </p>
        </div>
      </main>

      <footer className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 text-center">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Not legal advice. Always consult a qualified attorney.
        </p>
      </footer>
    </div>
  );
}

function Feature({ icon, label, desc }: { icon: React.ReactNode; label: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <div className="font-semibold text-slate-900 dark:text-white text-sm">{label}</div>
        <div className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{desc}</div>
      </div>
    </div>
  );
}
