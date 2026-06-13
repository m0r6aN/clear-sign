import { ShieldAlert } from 'lucide-react';
import disclaimerMd from '../content/disclaimer.md?raw';
import ReactMarkdown from 'react-markdown';

interface Props {
  onAccept: () => void;
}

export default function DisclaimerModal({ onAccept }: Props) {
  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh]">
        <div className="flex items-center gap-3 p-5 border-b border-slate-200 dark:border-slate-800">
          <ShieldAlert className="w-5 h-5 text-orange-500 shrink-0" />
          <h2 className="font-semibold text-slate-900 dark:text-white text-lg">Before you begin</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-5 prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{disclaimerMd}</ReactMarkdown>
        </div>
        <div className="p-5 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onAccept}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl transition-colors shadow-sm"
          >
            I understand — continue
          </button>
        </div>
      </div>
    </div>
  );
}
