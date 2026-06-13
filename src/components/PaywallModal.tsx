import { useState } from 'react';
import { X, Loader2, CreditCard } from 'lucide-react';
import { copy } from '../content/copy';
import { createCheckoutSession } from '../services/billingApi';

const PACKS = [
  { id: 'pack_10', label: '10 analyses', price: '$5' },
  { id: 'pack_25', label: '25 analyses', price: '$10' },
  { id: 'pack_50', label: '50 analyses', price: '$18' },
];

interface Props {
  onClose: () => void;
}

export default function PaywallModal({ onClose }: Props) {
  const [email, setEmail] = useState('');
  const [selectedPack, setSelectedPack] = useState(PACKS[1].id);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBuy = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const { url } = await createCheckoutSession(selectedPack, email.trim());
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errors.generic);
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white text-lg">
              {copy.billing.outOfCreditsTitle}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {copy.billing.outOfCreditsBody}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="space-y-2">
            {PACKS.map((pack) => (
              <button
                key={pack.id}
                onClick={() => setSelectedPack(pack.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left ${
                  selectedPack === pack.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'
                }`}
              >
                <span className="font-medium text-slate-800 dark:text-slate-100 text-sm">
                  {pack.label}
                </span>
                <span className="font-semibold text-slate-900 dark:text-white">{pack.price}</span>
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="paywall-email">
              Email for receipt
            </label>
            <input
              id="paywall-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && handleBuy()}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <button
            onClick={handleBuy}
            disabled={isLoading}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Redirecting...</>
            ) : (
              <><CreditCard className="w-5 h-5" /> {copy.billing.checkoutCta}</>
            )}
          </button>

          <p className="text-center text-xs text-slate-400 dark:text-slate-500">
            Secure checkout via Stripe
          </p>
        </div>
      </div>
    </div>
  );
}
