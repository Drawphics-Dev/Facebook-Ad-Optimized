import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayIcon, DownloadIcon, LoaderIcon } from 'lucide-react';

const stepsList = [
  'Queueing request',
  'Fetching ad data',
  'Extracting Video',
  'Analyzing Video and Script',
  'Improving Video and Script',
  'Rendering Video'
];

const tipsList = [
  'Pro tip: Use high-engagement creatives to lower CPM and boost CTR.',
  'Hint: Short captions often outperform long-form text on mobile.',
  'Did you know? First 3s of video drive 47% of conversion impact.',
  'Try This: Test 3 thumbnails per creative to find the best hook.',
  'Reminder: Keep aspect ratio 1:1 or 4:5 for feed performance.'
];
export function App() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [downloadFileName, setDownloadFileName] = useState('ad-video.mp4');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [controller, setController] = useState<AbortController | null>(null);

  const steps = stepsList;
  const tips = tipsList;

  useEffect(() => {
    if (!isLoading) {
      return;
    }
    setProgress(0);
    setCurrentStepIndex(0);
    setElapsedSeconds(0);
    setTipIndex(0);
    setStatus('Starting workflow...');

    const stepThresholds = [8, 22, 45, 68, 85, 97];

    const progressTimer = setInterval(() => {
      setProgress(prev => {
        const increment = Math.random() * 3 + 1; // 1 - 4%
        const next = Math.min(prev + increment, 97);
        // update step index based on thresholds
        const idx = stepThresholds.findIndex(t => next < t);
        const newIdx = idx === -1 ? steps.length - 1 : Math.max(0, idx);
        setCurrentStepIndex(newIdx);
        setStatus(`${steps[newIdx]}...`);
        return next;
      });
    }, 400);

    const elapsedTimer = setInterval(() => {
      setElapsedSeconds(s => s + 1);
    }, 1000);

    const tipsTimer = setInterval(() => {
      setTipIndex(i => (i + 1) % tips.length);
    }, 4000);

    return () => {
      clearInterval(progressTimer);
      clearInterval(elapsedTimer);
      clearInterval(tipsTimer);
    };
  }, [isLoading, steps, tips.length]);

  const handleCancel = () => {
    if (controller) {
      controller.abort();
    }
    setStatus('Workflow canceled');
    setIsLoading(false);
    setController(null);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const urlPattern = /^https?:\/\/(www\.)?facebook\.com\/ads\/library\//;
    if (!url.trim() || !urlPattern.test(url)) {
      setError('Please enter a valid Facebook Ad Library URL');
      return;
    }
    setError('');
    setStatus('Starting workflow...');
    setIsLoading(true);
    setVideoUrl('');
    setProgress(0);
    setCurrentStepIndex(0);
    setElapsedSeconds(0);
    setTipIndex(0);
    try {
      const ctrl = new AbortController();
      setController(ctrl);
      const webhookUrl = 'https://primary-production-42b2b.up.railway.app/webhook/ad-library-url';
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: ctrl.signal,
        body: JSON.stringify({
          adLink: url
        })
      });
      if (!response.ok) {
        throw new Error(`Workflow request failed (${response.status})`);
      }
      const data = await response.json();
      if (!data || data.status !== 'success' || !data.videoUrl) {
        throw new Error('Workflow did not return a valid video URL');
      }
      const envObj: Record<string, unknown> = (import.meta as unknown as { env?: Record<string, unknown> }).env || {};
      const apiKey = (envObj.VITE_GOOGLE_API_KEY as string | undefined);
      if (!apiKey) {
        throw new Error('Missing API key. Please set VITE_GOOGLE_API_KEY');
      }
      // Build download URL with key param
      const mediaUrl = new URL(data.videoUrl);
      mediaUrl.searchParams.set('key', apiKey);
      setStatus('Downloading media...');
      setCurrentStepIndex(Math.max(currentStepIndex, steps.length - 1));
      // Download the media as blob so we don't expose the API key in the URL
      const mediaResp = await fetch(mediaUrl.toString(), {
        method: 'GET',
        headers: { 'Accept': 'video/*,application/octet-stream' },
        signal: ctrl.signal
      });
      if (!mediaResp.ok) {
        throw new Error(`Failed to download video (${mediaResp.status})`);
      }
      const contentType = mediaResp.headers.get('content-type') || '';
      const blob = await mediaResp.blob();
      const objectUrl = URL.createObjectURL(blob);
      // Try to infer a filename
      const disposition = mediaResp.headers.get('content-disposition') || '';
      const nameMatch = disposition.match(/filename\*=UTF-8''([^;\n]+)/) || disposition.match(/filename="?([^";\n]+)"?/);
      let inferred = 'ad-video';
      if (nameMatch && nameMatch[1]) {
        try { inferred = decodeURIComponent(nameMatch[1]); } catch { inferred = nameMatch[1]; }
      }
      let ext = 'mp4';
      if (contentType.includes('webm')) ext = 'webm';
      if (contentType.includes('quicktime') || contentType.includes('mov')) ext = 'mov';
      if (!/\.(mp4|webm|mov)$/i.test(inferred)) inferred = `${inferred}.${ext}`;
      setDownloadFileName(inferred);
      setVideoUrl(objectUrl);
      setProgress(100);
      setCurrentStepIndex(steps.length - 1);
      setStatus('Workflow complete!');
    } catch (err) {
      let abortName = '';
      if (err && typeof err === 'object' && 'name' in err) {
        abortName = (err as { name?: string }).name || '';
      }
      if (abortName === 'AbortError') {
        setError('');
      } else {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setStatus('');
      }
    } finally {
      setIsLoading(false);
      setController(null);
    }
  };
  return <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Floating Header */}
      <motion.header initial={{
      y: -100,
      opacity: 0
    }} animate={{
      y: 0,
      opacity: 1
    }} transition={{
      duration: 0.6,
      ease: 'easeOut'
    }} className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 px-4">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-full px-8 py-4 shadow-2xl">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
            Facebook Ads Optimizer
          </h1>
        </div>
      </motion.header>
      {/* Main Content */}
      <main className="flex flex-col items-center justify-center min-h-screen px-4 pt-32 pb-16">
        <motion.div initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        duration: 0.8,
        delay: 0.2
      }} className={`w-full ${isLoading || videoUrl ? 'max-w-6xl' : 'max-w-2xl'}`}>
          <motion.div 
            layout
            className={`flex flex-col lg:flex-row gap-8 items-start ${isLoading || videoUrl ? '' : 'lg:justify-center'}`}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
          {/* Input Card */}
          <motion.div 
            layout
            className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl ${isLoading || videoUrl ? 'flex-1' : 'w-full'}`}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="adUrl" className="block text-sm font-medium text-slate-300 mb-2">
                  Facebook Ad Library URL
                </label>
                <input id="adUrl" type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.facebook.com/ads/library/..." className="w-full bg-slate-950/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:border-cyan-400/50 transition-all" required />
              </div>
              <motion.button type="submit" disabled={isLoading} whileHover={{
              scale: 1.02
            }} whileTap={{
              scale: 0.98
            }} className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:shadow-cyan-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {isLoading ? <>
                    <LoaderIcon className="w-5 h-5 animate-spin" />
                    Processing...
                  </> : <>
                    <PlayIcon className="w-5 h-5" />
                    Generate Video
                  </>}
              </motion.button>
              {/* Status Messages */}
              <AnimatePresence mode="wait">
                {status && !error && <motion.p initial={{
                opacity: 0,
                y: -10
              }} animate={{
                opacity: 1,
                y: 0
              }} exit={{
                opacity: 0,
                y: -10
              }} className="text-center text-sm text-cyan-400">
                    {status}
                  </motion.p>}
                {error && <motion.p initial={{
                opacity: 0,
                y: -10
              }} animate={{
                opacity: 1,
                y: 0
              }} exit={{
                opacity: 0,
                y: -10
              }} className="text-center text-sm text-red-400">
                    {error}
                  </motion.p>}
              </AnimatePresence>
              {/* In-Progress Experience */}
              <AnimatePresence>
                {isLoading && !error && <motion.div initial={{
                opacity: 0,
                y: 10
              }} animate={{
                opacity: 1,
                y: 0
              }} exit={{
                opacity: 0,
                y: 10
              }} transition={{
                duration: 0.3
              }} className="mt-4 space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                        <span>Progress</span>
                        <span>{Math.round(progress)}% • {elapsedSeconds}s</span>
                      </div>
                      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.round(progress)}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} className="h-full bg-gradient-to-r from-cyan-500 to-blue-600" />
                      </div>
                    </div>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {steps.map((label, idx) => {
                        const isDone = idx < currentStepIndex;
                        const isActive = idx === currentStepIndex;
                        return (
                          <li key={label} className={`flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 ${isActive ? 'bg-white/10' : 'bg-white/5'}`}>
                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${isDone ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : isActive ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-slate-700/40 text-slate-300 border border-white/10'}`}>
                              {isDone ? '✓' : isActive ? '•' : ''}
                            </span>
                            <span className={`text-xs ${isDone ? 'text-emerald-300' : isActive ? 'text-cyan-300' : 'text-slate-300'}`}>{label}</span>
                            {isActive && <LoaderIcon className="w-3 h-3 ml-auto animate-spin text-cyan-300" />}
                          </li>
                        );
                      })}
                    </ul>
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                      <div className="text-xs text-slate-400">Tip</div>
                      <div className="text-sm text-slate-200 mt-1">{tips[tipIndex]}</div>
                    </div>
                    <div className="flex justify-end">
                      <button type="button" onClick={handleCancel} className="text-xs text-slate-300 hover:text-white bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
                        Cancel
                      </button>
                    </div>
                  </motion.div>}
              </AnimatePresence>
            </form>
          </motion.div>
          {/* Video Display & Skeleton - Right Column */}
          {(isLoading || videoUrl) && (
            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
              className="flex-1 lg:max-w-md w-full"
            >
              <AnimatePresence mode="wait">
                {videoUrl && <motion.div 
                  key="video"
                  initial={{
                    opacity: 0,
                    y: 20
                  }} 
                  animate={{
                    opacity: 1,
                    y: 0
                  }} 
                  exit={{
                    opacity: 0,
                    y: 20
                  }} 
                  transition={{
                    duration: 0.5
                  }} 
                  className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-slate-300">
                      Final Output
                    </h3>
                    <a href={videoUrl} download={downloadFileName} className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
                      <DownloadIcon className="w-4 h-4" />
                      Download
                    </a>
                  </div>
                  <video src={videoUrl} controls playsInline className="w-full aspect-[9/16] rounded-xl border border-white/10 bg-black" />
                </motion.div>}
                {isLoading && !videoUrl && !error && <motion.div 
                  key="skeleton"
                  initial={{
                    opacity: 0,
                    y: 20
                  }} 
                  animate={{
                    opacity: 1,
                    y: 0
                  }} 
                  exit={{
                    opacity: 0,
                    y: 20
                  }} 
                  transition={{
                    duration: 0.3
                  }} 
                  className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-4 w-28 bg-white/10 rounded animate-pulse" />
                    <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
                  </div>
                  <div className="w-full aspect-[9/16] rounded-xl border border-white/10 bg-slate-900 animate-pulse" />
                </motion.div>}
              </AnimatePresence>
            </motion.div>
          )}
          </motion.div>
        </motion.div>
      </main>
      {/* Animated Background Elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <motion.div animate={{
        scale: [1, 1.2, 1],
        opacity: [0.3, 0.5, 0.3]
      }} transition={{
        duration: 8,
        repeat: Infinity,
        ease: 'easeInOut'
      }} className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl" />
        <motion.div animate={{
        scale: [1, 1.3, 1],
        opacity: [0.2, 0.4, 0.2]
      }} transition={{
        duration: 10,
        repeat: Infinity,
        ease: 'easeInOut',
        delay: 1
      }} className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
      </div>
    </div>;
}