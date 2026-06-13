import { useState, useRef, useEffect, useCallback } from 'react';
import * as mammoth from 'mammoth';
import {
  analyzeContractFull,
  askContractQuestionFull,
  extractTextFromImageFull,
  ApiRequestError,
} from './services/analysisApi';
import type { ContractAnalysis } from './services/analysisApi';
import { getCredits } from './services/billingApi';
import {
  FileText, AlertTriangle, CheckCircle2, Info, Loader2, ArrowRight,
  ShieldAlert, Upload, X, File as FileIcon, MessageCircle, Send,
  MessageSquare, Camera, Share2, Printer, Moon, Sun, Coins,
} from 'lucide-react';
import Logo from './components/Logo';
import Landing from './components/Landing';
import DisclaimerModal from './components/DisclaimerModal';
import PaywallModal from './components/PaywallModal';
import ReactMarkdown from 'react-markdown';
import { copy } from './content/copy';

type AppStage = 'landing' | 'disclaimer' | 'app';
const ACCEPTED_KEY = 'clearsign.accepted';

function getInitialStage(): AppStage {
  try {
    return localStorage.getItem(ACCEPTED_KEY) ? 'app' : 'landing';
  } catch {
    return 'landing';
  }
}

function acceptDisclaimer() {
  try { localStorage.setItem(ACCEPTED_KEY, '1'); } catch { /* private mode */ }
}

export default function App() {
  const [stage, setStage] = useState<AppStage>(getInitialStage);
  const [isDarkMode, setIsDarkMode] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  );

  // Credits
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  // Contract input
  const [contractText, setContractText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ContractAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Q&A
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [qaHistory, setQaHistory] = useState<{ q: string; a: string; context: string[] }[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [showQaModal, setShowQaModal] = useState(false);
  const qaMessagesEndRef = useRef<HTMLDivElement>(null);

  // Scanner
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dark mode
  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode((d) => !d);

  // Load credits + handle Stripe redirect-back
  const loadCredits = useCallback(async () => {
    try {
      const { credits } = await getCredits();
      setCreditsRemaining(credits);
    } catch {
      // Backend may not be running locally; leave null
    }
  }, []);

  useEffect(() => {
    if (stage !== 'app') return;
    loadCredits();

    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      // Strip the query param so refreshing doesn't re-trigger
      window.history.replaceState({}, '', window.location.pathname);
      loadCredits();
    }
  }, [stage, loadCredits]);

  // Camera cleanup
  useEffect(() => () => stopScanning(), []);

  // QA scroll
  useEffect(() => {
    qaMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [qaHistory, isAsking, showQaModal]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleGetStarted = () => setStage('disclaimer');
  const handleAcceptDisclaimer = () => {
    acceptDisclaimer();
    setStage('app');
  };

  const handleInsufficientCredits = () => setShowPaywall(true);

  const processFile = async (file: File) => {
    setError(null);
    setAttachedFiles([file]);
    try {
      if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setContractText(result.value);
      } else {
        setContractText(await file.text());
      }
    } catch {
      setError(copy.errors.fileRead);
    }
  };

  const handleAnalyze = async () => {
    if (!contractText.trim()) return;
    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);
    try {
      const result = await analyzeContractFull(contractText);
      setAnalysis(result.analysis);
      setCreditsRemaining(result.creditsRemaining);
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'insufficient_credits') {
        handleInsufficientCredits();
      } else {
        setError(copy.errors.analyze);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startScanning = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setError(copy.errors.camera);
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
    }
    setIsScanning(false);
  };

  const captureImageAndExtractText = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsProcessingImage(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const dataUri = canvas.toDataURL('image/jpeg');
    stopScanning();
    try {
      const result = await extractTextFromImageFull(dataUri);
      setContractText((prev) => (prev ? `${prev}\n\n${result.text}` : result.text));
      setCreditsRemaining(result.creditsRemaining);
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'insufficient_credits') {
        handleInsufficientCredits();
      } else {
        setError(copy.errors.ocr);
      }
    } finally {
      setIsProcessingImage(false);
    }
  };

  const toggleItemSelection = (desc: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      next.has(desc) ? next.delete(desc) : next.add(desc);
      return next;
    });
  };

  const handleAskQuestion = async () => {
    if (!currentQuestion.trim() || !contractText.trim()) return;
    const q = currentQuestion;
    setCurrentQuestion('');
    setIsAsking(true);
    const context = Array.from(selectedItems);
    try {
      const result = await askContractQuestionFull(contractText, q, context);
      setQaHistory((prev) => [...prev, { q, a: result.answer, context }]);
      setCreditsRemaining(result.creditsRemaining);
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'insufficient_credits') {
        handleInsufficientCredits();
      } else {
        setQaHistory((prev) => [...prev, { q, a: copy.errors.ask, context }]);
      }
    } finally {
      setIsAsking(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high': return <ShieldAlert className="w-5 h-5 text-red-600" />;
      case 'medium': return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      case 'low': return <Info className="w-5 h-5 text-yellow-600" />;
      default: return <Info className="w-5 h-5 text-gray-600" />;
    }
  };

  const handlePrint = () => window.print();
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ClearSign Contract Analysis',
          text: analysis?.summary || 'Check out this contract analysis!',
          url: window.location.href,
        });
      } catch { /* user cancelled */ }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  // ── Render gates ───────────────────────────────────────────────────────────

  if (stage === 'landing') return <Landing onGetStarted={handleGetStarted} />;

  if (stage === 'disclaimer') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <DisclaimerModal onAccept={handleAcceptDisclaimer} />
      </div>
    );
  }

  // ── Main app ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 sticky top-0 z-10 print:hidden transition-colors duration-300">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo />
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                {copy.app.name}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                {copy.app.subtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {creditsRemaining !== null && (
              <button
                onClick={() => creditsRemaining === 0 && setShowPaywall(true)}
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                  creditsRemaining === 0
                    ? 'text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 cursor-pointer'
                    : 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                {creditsRemaining === 0 ? 'Buy credits' : `${creditsRemaining} left`}
              </button>
            )}
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors"
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main — mobile-first stacked, desktop side-by-side */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 flex flex-col lg:grid lg:grid-cols-2 gap-6 print:block print:w-full">

        {/* ── Left / Input column ── */}
        <div className="flex flex-col gap-3 print:hidden">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {copy.input.heading}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={startScanning}
                className="text-xs flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium transition-colors bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2.5 py-1.5 rounded-lg"
              >
                <Camera className="w-3.5 h-3.5" />
                {copy.input.scanButton}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium transition-colors bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2.5 py-1.5 rounded-lg"
              >
                <Upload className="w-3.5 h-3.5" />
                {copy.input.uploadButton}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".txt,.docx"
                onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
              />
            </div>
          </div>

          {attachedFiles.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300">
              <FileIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{attachedFiles[0].name}</span>
              <button onClick={() => { setAttachedFiles([]); setContractText(''); }} className="ml-auto shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div
            className={`relative rounded-xl border-2 transition-all overflow-hidden bg-white dark:bg-slate-900 ${
              isDragging
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-slate-200 dark:border-slate-800 focus-within:border-blue-500'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) processFile(file);
            }}
          >
            <textarea
              className="w-full h-48 sm:h-64 lg:h-72 p-4 resize-none outline-none text-sm dark:text-slate-300 bg-transparent placeholder:text-slate-400"
              placeholder={copy.input.placeholder}
              value={contractText}
              onChange={(e) => setContractText(e.target.value)}
            />
            {isProcessingImage && (
              <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  <p className="text-slate-600 dark:text-slate-300 font-medium text-sm">
                    {copy.scanner.extracting}
                  </p>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !contractText.trim()}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isAnalyzing ? (
              <><Loader2 className="w-5 h-5 animate-spin" />{copy.input.analyzing}</>
            ) : (
              <>{copy.input.analyzeButton}<ArrowRight className="w-5 h-5 ml-1" /></>
            )}
          </button>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl text-sm border border-red-100 dark:border-red-800">
              {error}
            </div>
          )}
        </div>

        {/* ── Right / Results column ── */}
        <div className="flex flex-col gap-3 lg:overflow-y-auto lg:max-h-[calc(100vh-8rem)] print:h-auto print:overflow-visible pb-6 print:pb-0">
          <div className="flex items-center justify-between print:hidden">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              {copy.results.heading}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowQaModal(true)}
                disabled={!analysis}
                className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 flex items-center gap-1 text-xs font-medium"
              >
                <MessageSquare className="w-4 h-4" />{copy.qa.askButton}
              </button>
              <button
                onClick={handleShare}
                disabled={!analysis}
                className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                onClick={handlePrint}
                disabled={!analysis}
                className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!analysis && !isAnalyzing && (
            <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-white/50 dark:bg-slate-900/50 print:hidden min-h-[160px]">
              <FileIcon className="w-10 h-10 mb-3 text-slate-300 dark:text-slate-600" />
              <p className="font-medium text-sm">{copy.results.emptyTitle}</p>
              <p className="text-xs mt-1">{copy.results.emptySubtitle}</p>
            </div>
          )}

          {analysis && (
            <div className="space-y-4">
              <Card>
                <SectionTitle icon={<FileText className="w-4 h-4 text-blue-600" />} title={copy.results.summaryHeading} />
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {analysis.summary}
                </p>
              </Card>

              <Card>
                <SectionTitle icon={<ShieldAlert className="w-4 h-4 text-red-600" />} title={copy.results.redFlagsHeading} />
                {analysis.redFlags.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">{copy.results.redFlagsEmpty}</p>
                ) : (
                  <div className="space-y-2 mt-3">
                    {analysis.redFlags.map((flag, idx) => {
                      const isSelected = selectedItems.has(flag.description);
                      return (
                        <div
                          key={idx}
                          onClick={() => toggleItemSelection(flag.description)}
                          className={`p-3 border rounded-xl flex gap-3 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 hover:border-blue-200'
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">{getSeverityIcon(flag.severity)}</div>
                          <div>
                            <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                              {flag.description}
                            </p>
                            {flag.lineReference && (
                              <span className="inline-block mt-1.5 text-xs px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-500">
                                {flag.lineReference}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              <Card>
                <SectionTitle icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} title={copy.results.obligationsHeading} />
                {analysis.obligations.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">{copy.results.obligationsEmpty}</p>
                ) : (
                  <div className="space-y-2 mt-3">
                    {analysis.obligations.map((ob, idx) => {
                      const isSelected = selectedItems.has(ob.description);
                      return (
                        <div
                          key={idx}
                          onClick={() => toggleItemSelection(ob.description)}
                          className={`p-3 border rounded-xl cursor-pointer transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 hover:border-blue-200'
                          }`}
                        >
                          <div className="text-xs uppercase tracking-wider font-semibold text-blue-600 mb-1">
                            {ob.party}
                          </div>
                          <p className="text-sm text-slate-700 dark:text-slate-300">{ob.description}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      </main>

      {/* ── Scanner Modal (full-screen) ── */}
      {isScanning && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col print:hidden">
          <div className="p-4 flex justify-between items-center absolute top-0 w-full bg-gradient-to-b from-black/60 to-transparent text-white z-10">
            <h2 className="text-lg font-bold">{copy.scanner.heading}</h2>
            <button onClick={stopScanning} className="p-2 bg-white/20 hover:bg-white/30 rounded-full">
              <X className="w-5 h-5" />
            </button>
          </div>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
          {/* Viewfinder hint */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-72 h-48 border-2 border-white/50 rounded-lg" />
          </div>
          <div className="absolute bottom-10 left-0 w-full flex justify-center">
            <button
              onClick={captureImageAndExtractText}
              className="w-16 h-16 rounded-full border-4 border-white bg-white/30 backdrop-blur active:scale-95 transition-transform"
              aria-label="Capture"
            />
          </div>
        </div>
      )}

      {/* ── Q&A Modal ── */}
      {showQaModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 flex items-end sm:items-center justify-center print:hidden">
          <div className="bg-white dark:bg-slate-900 w-full sm:max-w-2xl sm:mx-4 rounded-t-2xl sm:rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] sm:max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-blue-600" />
                {copy.qa.modalHeading}
              </h2>
              <button
                onClick={() => setShowQaModal(false)}
                className="text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg p-1.5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedItems.size > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {copy.qa.contextLabel} ({selectedItems.size} selected)
                  </span>
                  <ul className="mt-2 text-sm text-slate-700 dark:text-slate-300 list-disc pl-4 space-y-1">
                    {Array.from(selectedItems).map((i, idx) => <li key={idx}>{i}</li>)}
                  </ul>
                </div>
              )}
              {qaHistory.length === 0 && (
                <div className="text-center text-slate-500 dark:text-slate-400 py-8 text-sm">
                  {copy.qa.empty}
                </div>
              )}
              {qaHistory.map((item, idx) => (
                <div key={idx} className="space-y-3">
                  <div className="flex justify-end">
                    <div className="bg-blue-600 text-white rounded-2xl rounded-tr-none px-4 py-3 max-w-[85%] text-sm">
                      {item.q}
                    </div>
                  </div>
                  <div className="flex flex-col items-start bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-2xl rounded-tl-none px-4 py-3 max-w-[85%] text-sm prose dark:prose-invert prose-sm">
                    <ReactMarkdown>{item.a}</ReactMarkdown>
                  </div>
                </div>
              ))}
              {isAsking && (
                <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-none w-16 px-4 py-3">
                  {[0, 150, 300].map((delay) => (
                    <div
                      key={delay}
                      className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              )}
              <div ref={qaMessagesEndRef} />
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex gap-2">
              <input
                value={currentQuestion}
                onChange={(e) => setCurrentQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAskQuestion()}
                placeholder={copy.qa.inputPlaceholder}
                className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500"
              />
              <button
                disabled={isAsking || !currentQuestion.trim() || !contractText.trim()}
                onClick={handleAskQuestion}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white p-3 rounded-xl"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Paywall Modal ── */}
      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} />}
    </div>
  );
}

// ── Small helpers ───────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 print:shadow-none print:border-none print:p-0">
      {children}
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm">
      {icon}
      {title}
    </h3>
  );
}
