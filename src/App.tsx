import { useState, useRef, useEffect } from 'react';
import * as mammoth from 'mammoth';
import { analyzeContract, askContractQuestion, extractTextFromImage, ContractAnalysis } from './services/geminiService';
import { FileText, AlertTriangle, CheckCircle2, Info, Loader2, ArrowRight, ShieldAlert, Upload, X, File as FileIcon, MessageCircle, Send, MessageSquare, Camera, Share2, Printer, Moon, Sun } from 'lucide-react';
import Logo from './components/Logo';
import ReactMarkdown from 'react-markdown';

export default function App() {
  const [contractText, setContractText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ContractAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Q&A State
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [qaHistory, setQaHistory] = useState<{q: string, a: string, context: string[]}[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [showQaModal, setShowQaModal] = useState(false);
  const qaMessagesEndRef = useRef<HTMLDivElement>(null);
  
  // Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(isDark);
    if (isDark) document.documentElement.classList.add('dark');
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  useEffect(() => {
    return () => stopScanning();
  }, []);

  useEffect(() => {
    qaMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [qaHistory, isAsking, showQaModal]);

  const processFile = async (file: File) => {
    setError(null);
    setAttachedFiles([file]);
    
    try {
      if (file.name.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setContractText(result.value);
      } else {
        const text = await file.text();
        setContractText(text);
      }
    } catch (err) {
      setError('Failed to read the file. Please try a different .txt or .docx file.');
    }
  };

  const handleAnalyze = async () => {
    if (!contractText.trim()) return;
    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);
    try {
      const result = await analyzeContract(contractText);
      setAnalysis(result);
    } catch (err) {
      setError('Failed to analyze the contract. Please try again.');
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startScanning = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('Could not access camera.');
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
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
      const text = await extractTextFromImage(dataUri);
      setContractText(prev => prev ? prev + '\n\n' + text : text);
    } catch (err) {
      setError('Failed to extract text from the image.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const toggleItemSelection = (desc: string) => {
    const newItems = new Set(selectedItems);
    if (newItems.has(desc)) newItems.delete(desc);
    else newItems.add(desc);
    setSelectedItems(newItems);
  };

  const handleAskQuestion = async () => {
    if (!currentQuestion.trim() || !contractText.trim()) return;
    
    const q = currentQuestion;
    setCurrentQuestion('');
    setIsAsking(true);
    
    const context = Array.from(selectedItems);
    try {
      const a = await askContractQuestion(contractText, q, context);
      setQaHistory(prev => [...prev, { q, a, context }]);
    } catch (err) {
      setQaHistory(prev => [...prev, { q, a: "Failed to answer. Please try again.", context }]);
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

  const handlePrint = () => { window.print(); };
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ClearSign Contract Analysis',
          text: analysis?.summary || 'Check out this contract analysis!',
          url: window.location.href,
        });
      } catch (err) { console.error('Share failed', err); }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 sticky top-0 z-10 print:hidden transition-colors duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">ClearSign</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">AI Contract Analyzer</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">
              Understand what you sign.
            </div>
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 print:block print:w-full">
        <div className="flex flex-col gap-4 h-[calc(100vh-8rem)] print:hidden">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Document Text</h2>
            <div className="flex items-center gap-2">
              <button 
                onClick={startScanning}
                className="text-sm flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium transition-colors bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg"
              >
                <Camera className="w-4 h-4" />
                Scan Doc
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="text-sm flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium transition-colors bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg"
              >
                <Upload className="w-4 h-4" />
                Upload File
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".txt,.docx" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
            </div>
          </div>

          <div 
            className={`flex-1 relative rounded-xl border-2 transition-all overflow-hidden bg-white dark:bg-slate-900 ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-800 focus-within:border-blue-500'}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files?.[0]; if (file) processFile(file); }}
          >
            <textarea
              className="w-full h-full p-4 resize-none outline-none dark:text-slate-300 bg-transparent"
              placeholder="Paste contract text here, or drag & drop a .txt or .docx file..."
              value={contractText}
              onChange={(e) => setContractText(e.target.value)}
            />
            {isProcessingImage && (
              <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  <p className="text-slate-600 dark:text-slate-300 font-medium">Extracting text...</p>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || contractText.trim() === ''}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing Contract...
              </>
            ) : (
              <>
                Analyze Contract
                <ArrowRight className="w-5 h-5 ml-1" />
              </>
            )}
          </button>
          
          {error && <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">{error}</div>}
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto h-[calc(100vh-8rem)] print:h-auto print:overflow-visible custom-scrollbar pb-6 print:pb-0">
          <div className="flex items-center justify-between print:hidden">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Analysis Results</h2>
            <div className="flex gap-2">
              <button onClick={() => setShowQaModal(true)} disabled={!analysis} className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 flex items-center gap-1.5 text-sm font-medium">
                <MessageSquare className="w-4 h-4" /> Ask AI
              </button>
              <button onClick={handleShare} disabled={!analysis} className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"><Share2 className="w-4 h-4" /></button>
              <button onClick={handlePrint} disabled={!analysis} className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"><Printer className="w-4 h-4" /></button>
            </div>
          </div>

          {!analysis && !isAnalyzing && (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-white/50 dark:bg-slate-900/50 print:hidden">
              <FileIcon className="w-12 h-12 mb-4 text-slate-300 dark:text-slate-600" />
              <p className="text-center font-medium">No contract analyzed yet.</p>
              <p className="text-sm mt-1">Paste your text and click Analyze to begin.</p>
            </div>
          )}

          {analysis && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 print:shadow-none print:border-none print:p-0">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" /> Executive Summary
                </h3>
                <div className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{analysis.summary}</div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 print:shadow-none print:border-none print:p-0">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-red-600" /> Red Flags & Risks
                  </h3>
                </div>
                {analysis.redFlags.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No significant red flags detected.</p>
                ) : (
                  <div className="space-y-3">
                    {analysis.redFlags.map((flag, idx) => {
                      const isSelected = selectedItems.has(flag.description);
                      return (
                        <div key={idx} onClick={() => toggleItemSelection(flag.description)} className={`p-4 border rounded-xl flex gap-3 cursor-pointer transition-all ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 hover:border-blue-200'}`}>
                          <div className="mt-0.5">{getSeverityIcon(flag.severity)}</div>
                          <div>
                            <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">{flag.description}</p>
                            {flag.lineReference && <span className="inline-block mt-2 text-xs px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-500">Ref: {flag.lineReference}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border border-slate-200 dark:border-slate-800 print:shadow-none print:border-none print:p-0">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Key Obligations
                </h3>
                {analysis.obligations.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">No major obligations identified.</p>
                ) : (
                  <div className="space-y-3">
                    {analysis.obligations.map((ob, idx) => {
                      const isSelected = selectedItems.has(ob.description);
                      return (
                        <div key={idx} onClick={() => toggleItemSelection(ob.description)} className={`p-4 border rounded-xl cursor-pointer transition-all ${isSelected ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 hover:border-blue-200'}`}>
                          <div className="text-xs uppercase tracking-wider font-semibold text-blue-600 mb-1">{ob.party}</div>
                          <p className="text-sm text-slate-700 dark:text-slate-300">{ob.description}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Scanner Modal */}
      {isScanning && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col justify-center print:hidden">
          <div className="p-4 flex justify-between items-center absolute top-0 w-full bg-black/50 text-white z-10">
            <h2 className="text-lg font-bold">Scan Document</h2>
            <button onClick={stopScanning} className="p-2 bg-white/20 hover:bg-white/30 rounded-full"><X className="w-5 h-5"/></button>
          </div>
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute bottom-8 left-0 w-full flex justify-center">
            <button onClick={captureImageAndExtractText} className="w-16 h-16 rounded-full border-4 border-white bg-white/30 backdrop-blur" />
          </div>
        </div>
      )}

      {/* Q&A Modal */}
      {showQaModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2"><MessageCircle className="w-5 h-5 text-blue-600" /> Contract Q&A</h2>
              <button onClick={() => setShowQaModal(false)} className="text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg p-1.5"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedItems.size > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Context ({selectedItems.size} selected)</span>
                  <ul className="mt-2 text-sm text-slate-700 dark:text-slate-300 list-disc pl-4 space-y-1">
                    {Array.from(selectedItems).map((i, idx) => <li key={idx}>{i}</li>)}
                  </ul>
                </div>
              )}
              {qaHistory.length === 0 && <div className="text-center text-slate-500 dark:text-slate-400 py-8">Ask any questions about the contract!</div>}
              {qaHistory.map((item, idx) => (
                <div key={idx} className="space-y-4">
                  <div className="flex justify-end"><div className="bg-blue-600 text-white rounded-2xl rounded-tr-none px-4 py-3 max-w-[85%] text-sm">{item.q}</div></div>
                  <div className="flex flex-col items-start bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-2xl rounded-tl-none px-4 py-3 max-w-[85%] text-sm prose dark:prose-invert"><ReactMarkdown>{item.a}</ReactMarkdown></div>
                </div>
              ))}
              {isAsking && (
                <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-none w-16 px-4 py-3">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
              <div ref={qaMessagesEndRef} />
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex gap-2">
              <input value={currentQuestion} onChange={e => setCurrentQuestion(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAskQuestion()} placeholder="Ask a question about this contract..." className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 text-sm text-slate-900 dark:text-white outline-none focus:border-blue-500" />
              <button disabled={isAsking || !currentQuestion.trim() || !contractText.trim()} onClick={handleAskQuestion} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white p-3 rounded-xl"><Send className="w-5 h-5"/></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
