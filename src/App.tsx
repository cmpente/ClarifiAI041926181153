/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="vite/client" />
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, 
  Loader2, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Sparkles,
  Image as ImageIcon,
  Type as TypeIcon,
  Layers,
  History,
  Trash2,
  ChevronRight,
  Menu,
  X,
  Globe,
  Settings,
  Maximize2,
  LayoutGrid,
  List,
  Clock,
  Calendar,
  Zap,
  Search,
  Copy,
  Upload,
  Camera
} from 'lucide-react';
import { GeminiService } from './services/geminiService';
import { DebugStyleBaseline } from './components/DebugStyleBaseline';
import { ClarifiLogo } from './components/ClarifiLogo';
import { SafetyPosterData, MASTER_IMAGE_PROMPT_TEMPLATE, GEMINI_TEXT_MODEL, GEMINI_IMAGE_MODEL_PRO, GEMINI_IMAGE_MODEL_FLASH, GEMINI_IMAGE_MODEL_FLASH_3_1, VisionQAResult } from './constants';
import { ACTION_TEMPLATES, generateProceduralActions, generateProceduralEnvironments } from './data/proceduralOptions';
import { SafetyTopic, SUGGESTED_TOPICS, TOPIC_CATEGORIES } from './lib/safetyTopics';
import { get, set } from 'idb-keyval';
import { prng } from './utils/random';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

interface PosterHistoryItem {
  id: string;
  topic: string;
  image: string;
  timestamp: number;
  prompt: string;
}

export default function App() {
  const [topic, setTopic] = useState('');
  const [structuredTopic, setStructuredTopic] = useState<SafetyTopic | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [posterData, setPosterData] = useState<SafetyPosterData | null>(null);
  const [panelImages, setPanelImages] = useState<string[]>([]);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [exaggerate, setExaggerate] = useState(false);
  const [hazardHunt, setHazardHunt] = useState(false);
  const [history, setHistory] = useState<PosterHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [translationWarning, setTranslationWarning] = useState<{
    feedback: string;
    suggested: string;
    original: string;
  } | null>(null);
  
  // New State
  const [imageModel, setImageModel] = useState(GEMINI_IMAGE_MODEL_PRO);
  const [textModel, setTextModel] = useState(GEMINI_TEXT_MODEL);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [localKey, setLocalKey] = useState('');
  const [imageSize, setImageSize] = useState('2K');
  const abortControllerRef = useRef<AbortController | null>(null);
  const [timings, setTimings] = useState<{step1: number, step2: number}>({ step1: 0, step2: 0 });
  const [apiCost, setApiCost] = useState<number>(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [visionQA, setVisionQA] = useState<VisionQAResult | null>(null);
  const [isFixing, setIsFixing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [historyView, setHistoryView] = useState<'grid' | 'list'>('grid');
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);
      }
    } catch (err) {
      showToast("Could not access camera. Please check permissions.");
      console.error("Camera error:", err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setReferenceImages(prev => [...prev, dataUrl].slice(0, 3));
        stopCamera();
      }
    }
  };

  const [showHazardAnswers, setShowHazardAnswers] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length + referenceImages.length > 3) {
      setError("Maximum 3 reference images allowed.");
      return;
    }

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setReferenceImages(prev => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeReferenceImage = (index: number) => {
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const [isGeneratingTopic, setIsGeneratingTopic] = useState(false);

  const randomizeTopic = async () => {
    if (!hasKey) {
      setError("Please connect your API key to generate random topics.");
      return;
    }
    try {
      setIsGeneratingTopic(true);
      const gemini = new GeminiService();
      const randomIdea = await gemini.generateRandomTopic();
      setStructuredTopic(null);
      setTopic(randomIdea);
    } catch (e: any) {
      console.error(e);
      // Fallback
      setTopic("Ensure equipment is locked out before entering the restricted zone.");
    } finally {
      setIsGeneratingTopic(false);
    }
  };

  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Load History
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const saved = await get('poster_history');
        if (saved) {
          setHistory(saved);
        }
      } catch (e) {
        console.error("Failed to load history", e);
      }
      setHistoryLoaded(true);
    };
    loadHistory();

    const checkKey = async () => {
      try {
        if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
          if (await window.aistudio.hasSelectedApiKey()) {
            setHasKey(true);
            return;
          }
        }
        
        // Check server config
        try {
          const res = await fetch('/api/config');
          if (res.ok) {
            const data = await res.json();
            if (data.hasServerKey) {
              setHasKey(true);
              return;
            }
          }
        } catch (e) {
          console.warn("Could not check server config", e);
        }

        const metaEnv = (import.meta as any).env;
        const hasLocalKey = localStorage.getItem("GEMINI_API_KEY") || 
                           sessionStorage.getItem("GEMINI_API_KEY") || 
                           metaEnv?.VITE_GEMINI_API_KEY;
        
        if (hasLocalKey) {
          setHasKey(true);
        }
      } catch (e) {
        console.error("Error checking API key:", e);
      }
    };
    checkKey().catch(err => console.error("Unhandled error in checkKey:", err));

    const handleGlobalError = (event: ErrorEvent) => {
      // Ignore ResizeObserver errors as they are non-fatal and common in dev
      if (event.message?.includes("ResizeObserver")) return;
      
      console.error("Global Error Caught:", event.error || event.message);
      
      const message = event.error?.message || event.message || "An unknown error occurred";
      const isIgnored = message.includes("quota") || 
                        event.error?.name === "QuotaExceededError";
      
      if (!isIgnored) {
        setError("System Error: " + message);
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      // Ignore cancellations and specific harmless WebSocket errors
      const reasonStr = String(reason);
      if (reason === "Request cancelled" || 
          reason?.message === "Request cancelled" || 
          reasonStr.includes("WebSocket closed without opened")) return;
      
      console.error("Unhandled Promise Rejection:", reason);
      
      let message = "Unknown background error";
      if (reason) {
        if (typeof reason === 'string') {
          message = reason;
        } else if (reason.message) {
          message = reason.message;
        } else {
          try {
            message = JSON.stringify(reason);
          } catch (e) {
            message = String(reason);
          }
        }
      }
      
      // Avoid showing "null", "undefined", or empty objects as strings
      if (message && message !== "null" && message !== "undefined" && message !== "{}") {
        setError("Background Error: " + message);
      } else if (!reason) {
        // If there's truly no reason, it's often a silent failure we should log but maybe not alert
        console.warn("Promise rejected with no reason provided.");
      }
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Save History
  useEffect(() => {
    if (historyLoaded) {
      const saveHistory = async (data: any[]) => {
        try {
          // Keep only the last 30 items
          const trimmedData = data.slice(0, 30);
          await set('poster_history', trimmedData);
        } catch (e: any) {
          console.error("Failed to save history", e);
          
          // If quota exceeded, try to prune more aggressively
          if (e.name === 'QuotaExceededError' && data.length > 5) {
            try {
              const aggressivelyTrimmed = data.slice(0, 5);
              await set('poster_history', aggressivelyTrimmed);
              showToast("Storage limit reached. Older history was removed.");
            } catch (e2) {
              showToast("Storage full. Cannot save history.");
            }
          } else {
            showToast("Failed to save history: " + e.message);
          }
        }
      };
      
      saveHistory(history);
    }
  }, [history, historyLoaded]);

  const compressImage = async (base64Str: string, maxWidth = 800): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(base64Str);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve(base64Str);
    });
  };

  const handleOpenKey = async () => {
    try {
      if (window.aistudio) {
        await window.aistudio.openSelectKey();
        setHasKey(true);
      } else {
        setShowKeyModal(true);
      }
    } catch (e: any) {
      console.error("Error opening key selector:", e);
      setError("Failed to open API key selector: " + (e?.message || "Unknown error"));
    }
  };

  const handleSaveKey = () => {
    if (localKey.trim()) {
      localStorage.setItem("GEMINI_API_KEY", localKey.trim());
      setHasKey(true);
      setShowKeyModal(false);
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setLoadingMessage("Cancelled");
  };

  const [progress, setProgress] = useState(0);

  // Simulate progress
  useEffect(() => {
    if (loading) {
      setProgress(0);
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev;
          // Much slower progress for Pro model
          // 0.2 per 100ms = 2% per second -> 25s to 50%
          // 0.05 per 100ms = 0.5% per second -> 80s for next 40%
          const increment = prev < 50 ? 0.2 : 0.05;
          return prev + increment;
        });
      }, 100);
      return () => clearInterval(interval);
    } else {
      setProgress(100);
    }
  }, [loading]);

  const handleModelSwitch = (type: 'text' | 'image', newModel: string) => {
    if (type === 'text') setTextModel(newModel);
    else setImageModel(newModel);
  };

  const generatePoster = async (forceData?: SafetyPosterData, isRegeneratingImage: boolean = false, overrideTopic?: string) => {
    const payloadTopic = overrideTopic || topic;

    if (!payloadTopic.trim() && !forceData) return;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setProgress(0);
    setError(null);
    if (!isRegeneratingImage) {
      setPosterData(null);
      setPanelImages([]);
      setFinalImage(null);
      setVisionQA(null);
      setIsFixing(false);
    } else {
      // If just regenerating image (or fixing), clear previous QA
      setVisionQA(null);
    }
    setTranslationWarning(null);
    setIsUsingFallback(false);
    setLoadingStep(1);
    setTimings({ step1: 0, step2: 0 });
    setApiCost(0);

    try {
      const gemini = new GeminiService();
      
      let data: SafetyPosterData;
      if (forceData) {
        data = forceData;
      } else if (isRegeneratingImage && posterData) {
        data = posterData;
      } else {
        // Step 1: LLM Orchestration & Translation Check
        setLoadingStep(1);
        setLoadingMessage("Drafting safety narrative...");
        const t1 = Date.now();
        const textResponse = await gemini.generatePosterDataWithCost(payloadTopic, textModel, exaggerate, hazardHunt, referenceImages, abortController.signal);
        data = textResponse.data;
        setApiCost(prev => prev + textResponse.cost);
        setTimings(prev => ({ ...prev, step1: Date.now() - t1 }));
        
        // Translation Validation Step removed as it's not in the new schema
      }
      
      setPosterData(data);

      // Step 2: Image Generation
      setLoadingStep(2);
      setLoadingMessage(isFixing ? "Applying QA fixes and regenerating..." : (isRegeneratingImage ? "Regenerating visualization..." : "Generating safety visualization..."));
      
      let prompt = data.poster_prompt;
      if (isFixing && visionQA?.critique) {
        prompt += `\n\nCRITICAL CORRECTION FROM PREVIOUS ATTEMPT: ${visionQA.critique}\nYou MUST fix these specific issues in this new version.`;
      }
      
      const t2 = Date.now();
      const imageResponse = await gemini.generateImageWithCost(prompt, imageModel, imageSize, referenceImages, abortController.signal);
      const url = imageResponse.url;
      setApiCost(prev => prev + imageResponse.cost);
      setTimings(prev => ({ ...prev, step2: Date.now() - t2 }));
      
      setPanelImages([url]);
      setFinalImage(url);

      // Step 3: Vision QA (Single Pass)
      setLoadingMessage("Performing Quality Assurance check...");
      try {
        const qaResult = await gemini.visionQA(url, abortController.signal);
        setVisionQA(qaResult);
      } catch (qaErr) {
        console.error("Vision QA failed:", qaErr);
        setVisionQA(null);
      }

      // Step 4: Done
      setLoadingStep(3);
      setShowHazardAnswers(false);
      
      if (url) {
        // Compress image for history to save space
        const compressedUrl = await compressImage(url);
        const newItem: PosterHistoryItem = {
          id: Date.now().toString(),
          topic: (structuredTopic ? structuredTopic.title : topic) || data.header_en || "Safety Poster",
          image: compressedUrl,
          timestamp: Date.now(),
          prompt: prompt
        };
        setHistory(prev => [newItem, ...prev].slice(0, 30));
      }

      setLoading(false);
      setIsFixing(false);
    } catch (err: any) {
      if (err?.message === "Request cancelled") return;
      console.error("Generation Error:", err);
      
      let errorMessage = err?.message || String(err);
      
      // Provide more user-friendly error messages based on common API errors
      if (errorMessage.includes("403") || errorMessage.toLowerCase().includes("permission denied")) {
        errorMessage = "API Key Error: Your API key may be invalid or lacks necessary permissions. Please check your settings.";
      } else if (errorMessage.includes("429") || errorMessage.toLowerCase().includes("quota")) {
        // Fallback logic
        if (imageModel !== GEMINI_IMAGE_MODEL_FLASH) {
          setIsUsingFallback(true);
          setImageModel(GEMINI_IMAGE_MODEL_FLASH);
          setTimeout(() => generatePoster(forceData, isRegeneratingImage), 1000);
          return;
        }
        errorMessage = "Rate Limit Exceeded: You have reached the quota limit for the Gemini API. Please try again later or check your billing account.";
      } else if (errorMessage.includes("500") || errorMessage.includes("503")) {
        // Fallback logic
        if (imageModel !== GEMINI_IMAGE_MODEL_FLASH) {
          setIsUsingFallback(true);
          setImageModel(GEMINI_IMAGE_MODEL_FLASH);
          setTimeout(() => generatePoster(forceData, isRegeneratingImage), 1000);
          return;
        }
        errorMessage = "Service Unavailable: The Gemini API is currently experiencing issues. Please try again in a few moments.";
      } else if (errorMessage.toLowerCase().includes("safety")) {
        errorMessage = "Safety Filter Triggered: The requested content was blocked by safety filters. Please try a different, less sensitive topic.";
      } else if (errorMessage.toLowerCase().includes("network") || errorMessage.toLowerCase().includes("fetch")) {
        errorMessage = "Network Error: Failed to connect to the server. Please check your internet connection and try again.";
      } else if (errorMessage.toLowerCase().includes("timeout")) {
        errorMessage = "Request Timeout: The generation took too long to complete. Please try again, perhaps with a simpler prompt or a faster model.";
      } else if (!errorMessage || errorMessage === "[object Object]") {
         errorMessage = "An unexpected error occurred during generation. Please try again.";
      }

      setError(errorMessage);
      
      setLoading(false);
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleDownload = () => {
    if (!finalImage) return;
    const link = document.createElement('a');
    link.download = `safety-poster-${topic.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.href = finalImage;
    link.click();
  };

  const handleEdit = async () => {
    if (!finalImage || !editPrompt.trim()) return;
    setIsEditing(true);
    try {
      const gemini = new GeminiService();
      const edited = await gemini.editImage(finalImage, editPrompt);
      setFinalImage(edited);
      setEditPrompt('');
    } catch (err: any) {
      console.error("Edit Error:", err);
      setError("Failed to edit image: " + (err?.message || "Unknown error"));
    } finally {
      setIsEditing(false);
    }
  };


  return (
    <div className="h-screen w-full bg-[#121212] text-white font-sans overflow-hidden flex flex-col relative">
      {/* Background Shimmer */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/20 blur-[120px] rounded-full mix-blend-screen opacity-50 animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-teal-500/20 blur-[150px] rounded-full mix-blend-screen opacity-40 animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
        <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] bg-cyan-500/10 blur-[100px] rounded-full mix-blend-screen opacity-30 animate-pulse" style={{ animationDuration: '10s', animationDelay: '4s' }} />
      </div>

      {/* Header */}
      <header className="p-3 md:p-4 border-b border-white/5 flex items-center justify-between bg-[#1A1A1A]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <ClarifiLogo className="w-40 h-10 sm:w-56 sm:h-14" />
          <div className="hidden md:block border-l border-white/10 pl-3">
            <p className="text-[7px] text-zinc-500 font-bold tracking-[0.15em] uppercase">Bridging the gap between</p>
            <p className="text-[7px] text-zinc-500 font-bold tracking-[0.15em] uppercase mt-0.5">safety and understanding</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors relative"
            title="History"
          >
            <History className="w-5 h-5 text-zinc-400" />
            {history.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full border-2 border-zinc-900" />
            )}
          </button>
          
          <button 
            onClick={() => setShowKeyModal(true)}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5 text-zinc-400" />
          </button>

          {!hasKey && (
            <button 
              onClick={handleOpenKey}
              className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-xs font-bold rounded-lg transition-all flex items-center gap-2 border border-amber-500/20"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">CONNECT API</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto w-full">
        <div className="min-h-full flex flex-col items-center justify-start p-3 sm:p-6 relative">
          <AnimatePresence mode="wait">
            {!finalImage && !loading ? (
              <motion.div 
                key="input"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-3xl space-y-6 sm:space-y-8 text-center my-auto py-4 sm:py-8"
              >
                <div className="space-y-3 sm:space-y-4">
                  <h2 className="text-2xl xs:text-3xl sm:text-5xl md:text-6xl font-bold tracking-tighter leading-none px-2">
                    PREVENT ACCIDENTS.<br />
                    <span className="text-emerald-500">GENERATE SAFETY.</span>
                  </h2>
                </div>

                <div className="flex flex-col sm:relative w-full gap-4">
                  <div className="flex flex-col sm:flex-row w-full gap-3">
                    <div className="relative flex-1">
                      <textarea 
                        value={topic}
                        onChange={(e) => {
                          setTopic(e.target.value);
                          setStructuredTopic(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (handleOpenKey && hasKey) generatePoster();
                          }
                        }}
                        placeholder="e.g., Do not wear work boots home, risk of cross-contamination in the plant from onsite rendering areas..."
                        rows={3}
                        className="w-full bg-zinc-900 border-2 border-zinc-800 focus:border-emerald-500 p-4 sm:p-5 rounded-2xl text-sm outline-none transition-all pr-16 resize-none"
                      />
                      <button 
                        onClick={randomizeTopic}
                        disabled={isGeneratingTopic || !hasKey}
                        className="absolute right-3 top-3 p-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-emerald-500 rounded-xl transition-all flex items-center justify-center group"
                        title="Suggest Random Topic"
                      >
                        <RefreshCw className={`w-5 h-5 transition-transform duration-500 ${isGeneratingTopic ? 'animate-spin' : 'group-active:rotate-180'}`} />
                      </button>
                    </div>
                    <button 
                      onClick={() => generatePoster()}
                      disabled={!hasKey || !topic.trim() || loading}
                      className="w-full sm:w-auto px-8 py-4 sm:py-0 h-[auto] min-h-[100px] bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-700 text-black font-black rounded-2xl transition-all flex flex-col items-center justify-center gap-2 uppercase text-xs sm:text-sm tracking-widest shadow-lg shadow-emerald-500/20 shrink-0"
                    >
                      {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                      <span>GENERATE</span>
                    </button>
                  </div>
                </div>

                {/* Advanced Configuration UI (Now visible by default instead of hidden away) */}
                <div className="w-full text-left bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden mt-4">
                  <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/80">
                    <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-zinc-400">
                      <LayoutGrid className="w-4 h-4 text-emerald-500" /> Advanced Configuration
                    </span>
                  </div>
                  <div className="p-4 space-y-6">
                    <div className="flex flex-wrap gap-4 pt-2">
                       <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Text Model</label>
                        <div className="flex items-center bg-zinc-950 rounded-lg p-1 border border-zinc-800">
                          <button onClick={() => handleModelSwitch('text', 'gemini-3.1-flash-lite-preview')} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${textModel === 'gemini-3.1-flash-lite-preview' ? 'bg-emerald-500 text-black' : 'text-zinc-500 hover:text-zinc-300'}`}>Flash</button>
                          <button onClick={() => handleModelSwitch('text', 'gemini-3.1-pro-preview')} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${textModel === 'gemini-3.1-pro-preview' ? 'bg-emerald-500 text-black' : 'text-zinc-500 hover:text-zinc-300'}`}>Pro</button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Image Model</label>
                        <div className="flex items-center bg-zinc-950 rounded-lg p-1 border border-zinc-800">
                          <button 
                            onClick={() => handleModelSwitch('image', GEMINI_IMAGE_MODEL_FLASH)} 
                            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${imageModel === GEMINI_IMAGE_MODEL_FLASH ? 'bg-emerald-500 text-black' : 'text-zinc-500 hover:text-zinc-300'}`}
                          >
                            Fast
                          </button>
                          <button 
                            onClick={() => handleModelSwitch('image', GEMINI_IMAGE_MODEL_FLASH_3_1)} 
                            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${imageModel === GEMINI_IMAGE_MODEL_FLASH_3_1 ? 'bg-emerald-500 text-black' : 'text-zinc-500 hover:text-zinc-300'}`}
                          >
                            3.1 Flash
                          </button>
                          <button 
                            onClick={() => handleModelSwitch('image', GEMINI_IMAGE_MODEL_PRO)} 
                            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${imageModel === GEMINI_IMAGE_MODEL_PRO ? 'bg-emerald-500 text-black' : 'text-zinc-500 hover:text-zinc-300'}`}
                          >
                            Pro
                          </button>
                        </div>
                      </div>

                      {(imageModel === GEMINI_IMAGE_MODEL_PRO || imageModel === GEMINI_IMAGE_MODEL_FLASH_3_1) && (
                        <div className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Image Size</label>
                          <div className="flex items-center bg-zinc-950 rounded-lg p-1 border border-zinc-800">
                            {['1K', '2K', '4K'].map((size) => (
                              <button key={size} onClick={() => setImageSize(size)} className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${imageSize === size ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>{size}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-end gap-2 pb-1">
                        <button 
                          onClick={() => setExaggerate(!exaggerate)}
                          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-all ${exaggerate ? 'bg-amber-500/10 border-amber-500/50 text-amber-500' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                        >
                          <Zap className={`w-3.5 h-3.5 ${exaggerate ? 'fill-amber-500' : ''}`} />
                          <span className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap">Exaggerate</span>
                        </button>
                        <button 
                          onClick={() => setHazardHunt(!hazardHunt)}
                          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-all ${hazardHunt ? 'bg-purple-500/10 border-purple-500/50 text-purple-500' : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}
                        >
                          <Search className={`w-3.5 h-3.5 ${hazardHunt ? 'fill-purple-500' : ''}`} />
                          <span className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap">Hazard Hunt</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

              {!hasKey && (
                <p className="text-amber-400 text-sm flex items-center justify-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Please connect your Gemini API key to start.
                </p>
              )}

              <div className="w-full flex flex-col gap-2 mt-4 text-left">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                    Reference Images (Optional)
                  </label>
                  <span className="text-[9px] text-zinc-600 font-bold">{referenceImages.length}/3</span>
                </div>
                
                <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                  {referenceImages.map((img, idx) => (
                    <div key={idx} className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl border border-white/10 overflow-hidden group">
                      <img src={img} alt={`Reference ${idx}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeReferenceImage(idx)}
                        className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  
                  {referenceImages.length < 3 && (
                    <div className="flex gap-2">
                      <label className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl border border-dashed border-zinc-700 hover:border-emerald-500 hover:bg-emerald-500/5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all">
                        <Upload className="w-5 h-5 text-zinc-500" />
                        <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">Upload</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          multiple 
                          onChange={handleImageUpload} 
                          className="hidden" 
                        />
                      </label>
                      <button 
                        onClick={startCamera}
                        className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl border border-dashed border-zinc-700 hover:border-emerald-500 hover:bg-emerald-500/5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all"
                      >
                        <Camera className="w-5 h-5 text-zinc-500" />
                        <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500">Camera</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : loading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-12 w-full max-w-4xl px-4 my-auto py-8"
            >
              <div className="w-full aspect-[16/9] bg-zinc-900 border border-white/5 rounded-3xl overflow-hidden relative group shadow-2xl">
                {panelImages[0] ? (
                  <motion.img 
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    src={panelImages[0]} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ShieldAlert className="w-6 h-6 text-emerald-500" />
                      </div>
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              </div>

              <div className="flex flex-col items-center gap-8 w-full max-w-md">
                <div className="space-y-3 w-full text-center">
                  <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden relative">
                    <motion.div 
                      initial={{ width: "0%" }}
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                    />
                  </div>
                  <div className="flex justify-between items-center min-h-[2rem]">
                    <h3 className="text-sm sm:text-base font-bold uppercase tracking-widest text-emerald-500">
                      {loadingMessage || "Processing..." }
                    </h3>
                    <span className="text-xs font-mono text-zinc-500">{Math.round(progress)}%</span>
                  </div>
                  
                  {/* Timings Detail */}
                  <div className="flex justify-between text-[10px] text-zinc-600 font-mono uppercase tracking-widest mt-2">
                    <span className="truncate max-w-[120px]">Model: {imageModel.split('-').slice(1, 3).join(' ').toUpperCase()}</span>
                    <div className="flex gap-3">
                      {timings.step1 > 0 && <span>Text: {(timings.step1/1000).toFixed(1)}s</span>}
                      {timings.step2 > 0 && <span>Img: {(timings.step2/1000).toFixed(1)}s</span>}
                      {apiCost > 0 && <span className="text-emerald-500/70">Cost: ${apiCost.toFixed(4)}</span>}
                    </div>
                  </div>
                </div>

                {posterData && loadingStep >= 2 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full bg-zinc-900/80 border border-white/5 p-4 rounded-xl text-left shadow-inner flex flex-col max-h-48"
                  >
                    <div className="flex justify-between items-center mb-2 shrink-0">
                      <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest flex items-center gap-2">
                        <Sparkles className="w-3 h-3" /> Generated Prompt
                      </p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(posterData.poster_prompt);
                          showToast("Prompt copied to clipboard!");
                        }}
                        className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 uppercase tracking-widest transition-colors"
                      >
                        <Copy className="w-3 h-3" /> Copy Prompt
                      </button>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar pr-2">
                      <p className="text-xs text-zinc-400 font-mono leading-relaxed whitespace-pre-wrap">
                        {posterData.poster_prompt}
                      </p>
                    </div>
                  </motion.div>
                )}

                {isUsingFallback && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl animate-pulse">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">
                      High demand detected. Switching to standard model...
                    </span>
                  </div>
                )}
              </div>

              <button 
                onClick={handleCancel}
                className="px-8 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
              >
                Cancel Generation
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full h-full flex flex-col items-center gap-6 py-4 sm:py-8"
            >
              <div className="flex-1 w-full flex flex-col items-center justify-center overflow-hidden min-h-[50vh] gap-4">
                {visionQA && !visionQA.isValid && (
                  <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-4xl bg-amber-500/10 border-2 border-amber-500/30 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shadow-amber-500/5"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-amber-500/20 rounded-xl">
                        <AlertTriangle className="w-6 h-6 text-amber-500" />
                      </div>
                      <div className="text-left">
                        <h4 className="text-amber-500 font-black uppercase tracking-widest text-xs">QA Warning Detected</h4>
                        <p className="text-zinc-400 text-[10px] sm:text-xs font-medium max-w-xl">
                          {visionQA.issues.join(". ")}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setIsFixing(true);
                        generatePoster(posterData || undefined, true);
                      }}
                      className="whitespace-nowrap px-6 py-3 bg-amber-500 hover:bg-amber-600 text-black font-black rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Fix & Regenerate
                    </button>
                  </motion.div>
                )}
                
                <div className="relative group max-h-full max-w-full shadow-2xl shadow-black/50 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center">
                  <img 
                    src={finalImage!} 
                    alt="Generated Safety Poster" 
                    className="max-h-full max-w-full object-contain"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <button 
                      onClick={() => setSelectedImage(finalImage)}
                      className="p-4 bg-white text-black rounded-full hover:scale-110 transition-transform"
                      title="View Full Size"
                    >
                      <Maximize2 className="w-8 h-8" />
                    </button>
                    <button 
                      onClick={handleDownload}
                      className="p-4 bg-emerald-500 text-black rounded-full hover:scale-110 transition-transform"
                      title="Download"
                    >
                      <Download className="w-8 h-8" />
                    </button>
                    <button 
                      onClick={() => generatePoster(undefined, true)}
                      className="p-4 bg-zinc-800 text-white rounded-full hover:scale-110 transition-transform"
                      title="Regenerate Image"
                    >
                      <RefreshCw className="w-8 h-8" />
                    </button>
                    <button 
                      onClick={() => { 
                        setFinalImage(null); 
                        setTopic(''); 
                        setShowHazardAnswers(false);
                      }}
                      className="p-4 bg-zinc-800 text-white rounded-full hover:scale-110 transition-transform"
                      title="New Poster"
                    >
                      <Trash2 className="w-8 h-8" />
                    </button>
                  </div>
                </div>
                
                {apiCost > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900/50 border border-white/5 rounded-full backdrop-blur-sm">
                    <Sparkles className="w-3 h-3 text-emerald-500" />
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                      Est. Generation Cost: <span className="text-emerald-500 font-bold">${apiCost.toFixed(4)}</span>
                    </span>
                  </div>
                )}
              </div>
              <div className="w-full max-w-5xl flex flex-col sm:flex-row items-stretch gap-4 bg-zinc-900/50 p-4 rounded-3xl border border-white/5 backdrop-blur-xl shrink-0">
                <div className="flex-1 relative">
                  <input 
                    type="text"
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    placeholder="AI Edit: 'Add a retro filter', 'Make it brighter'..."
                    className="w-full h-full bg-black/40 border border-white/10 p-4 rounded-2xl outline-none focus:border-emerald-500 transition-all pr-12 text-sm"
                  />
                  <Sparkles className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleEdit}
                    disabled={isEditing || !editPrompt.trim()}
                    className="flex-1 sm:flex-none px-6 py-4 bg-zinc-100 hover:bg-white disabled:bg-zinc-800 text-black text-xs font-black rounded-2xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                  >
                    {isEditing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    EDIT
                  </button>
                  <button 
                    onClick={handleDownload}
                    className="flex-1 sm:flex-none px-6 py-4 bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-black rounded-2xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest shadow-lg shadow-emerald-500/20"
                  >
                    <Download className="w-4 h-4" />
                    DOWNLOAD
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          >
            <div className="bg-zinc-900 border border-red-500/50 p-8 rounded-3xl max-w-md w-full shadow-2xl flex flex-col gap-6">
              <div className="flex items-center gap-4 text-red-500">
                <div className="p-3 bg-red-500/10 rounded-2xl">
                  <XCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold uppercase tracking-tight">Generation Failed</h3>
              </div>
              
              <p className="text-zinc-300 leading-relaxed">
                {error}
              </p>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => { setError(null); generatePoster(); }}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl transition-all uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  Try Again
                </button>
                <button 
                  onClick={() => setError(null)}
                  className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-all uppercase tracking-wider"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
        </div>
      </main>

      {/* Full Size Image Viewer */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-4 sm:p-10"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-full max-h-full"
              onClick={(e) => e.stopPropagation()}
            >
              <img 
                src={selectedImage} 
                alt="Full size view" 
                className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              />
              <div className="absolute -top-12 right-0 flex gap-4">
                <button 
                  onClick={() => {
                    const link = document.createElement('a');
                    link.download = 'safety-poster-full.png';
                    link.href = selectedImage;
                    link.click();
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-600 transition-colors uppercase text-xs tracking-widest"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="p-2 bg-zinc-800 text-white rounded-xl hover:bg-zinc-700 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="p-4 border-t border-white/5 bg-zinc-950 flex justify-center items-center text-[10px] uppercase tracking-[0.3em] text-zinc-700">
        <div className="font-black">
          © {new Date().getFullYear()} CLARIFI AI • BRIDGING THE GAP BETWEEN SAFETY AND UNDERSTANDING
        </div>
      </footer>

      {/* History Sidebar */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:max-w-sm bg-zinc-900 border-l border-white/5 z-50 flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <History className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-bold uppercase tracking-tight">History</h3>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5">
                    <button 
                      onClick={() => setHistoryView('grid')}
                      className={`p-1.5 rounded-md transition-all ${historyView === 'grid' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setHistoryView('list')}
                      className={`p-1.5 rounded-md transition-all ${historyView === 'list' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                  <button 
                    onClick={() => setShowHistory(false)}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-zinc-500" />
                  </button>
                </div>
              </div>

              <div className={`flex-1 overflow-y-auto p-4 ${historyView === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-3'}`}>
                {history.length > 0 && (
                  <div className="col-span-full mb-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                    <p className="text-[9px] text-amber-200/80 leading-tight">
                      <strong>Storage Limit:</strong> Oldest posters will be automatically removed when storage is full.
                    </p>
                  </div>
                )}
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 col-span-full">
                    <div className="p-4 bg-zinc-800 rounded-full">
                      <ImageIcon className="w-8 h-8 text-zinc-600" />
                    </div>
                    <p className="text-zinc-500 text-sm">No posters generated yet.</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div 
                      key={item.id}
                      className={`group relative bg-zinc-800/30 border border-white/5 rounded-xl overflow-hidden hover:border-emerald-500/30 transition-all flex ${historyView === 'list' ? 'flex-row h-24' : 'flex-col'}`}
                    >
                      <div className={`relative ${historyView === 'list' ? 'w-32 h-full' : 'w-full aspect-[16/9]'}`}>
                        <img 
                          src={item.image} 
                          alt={item.topic} 
                          className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity cursor-pointer"
                          onClick={() => setSelectedImage(item.image)}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                          <Maximize2 className="w-5 h-5 text-white" />
                        </div>
                      </div>

                      <div className={`p-3 flex-1 min-w-0 flex flex-col justify-between ${historyView === 'grid' ? 'bg-zinc-900/50' : ''}`}>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className={`font-black truncate uppercase text-zinc-100 ${historyView === 'grid' ? 'text-[8px]' : 'text-[10px]'}`}>{item.topic}</p>
                            <button 
                              onClick={() => setHistory(prev => prev.filter(h => h.id !== item.id))}
                              className="p-1 hover:bg-red-500/10 text-zinc-600 hover:text-red-500 rounded-md transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            <div className="flex items-center gap-1 text-[8px] text-zinc-500 uppercase font-bold">
                              <Calendar className="w-2.5 h-2.5" />
                              {new Date(item.timestamp).toLocaleDateString()}
                            </div>
                            {historyView === 'list' && (
                              <div className="flex items-center gap-1 text-[8px] text-zinc-500 uppercase font-bold">
                                <Clock className="w-2.5 h-2.5" />
                                {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </div>
                        </div>

                        {historyView === 'list' && (
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-[7px] text-zinc-600 truncate italic leading-tight" title={item.prompt}>
                                {item.prompt}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(item.prompt);
                                  showToast("Prompt copied to clipboard!");
                                }}
                                className="p-1.5 bg-zinc-900/80 text-zinc-400 rounded-lg hover:bg-emerald-500 hover:text-black transition-all"
                                title="Copy Prompt"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={() => {
                                  setFinalImage(item.image);
                                  setTopic(item.topic);
                                  setShowHistory(false);
                                }}
                                className="p-1.5 bg-zinc-900/80 text-zinc-400 rounded-lg hover:bg-emerald-500 hover:text-black transition-all"
                                title="Load to Editor"
                              >
                                <RefreshCw className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}
                        
                        {historyView === 'grid' && (
                          <button 
                            onClick={() => {
                              setFinalImage(item.image);
                              setTopic(item.topic);
                              setShowHistory(false);
                            }}
                            className="mt-2 w-full py-1 bg-zinc-800 text-[8px] text-zinc-400 rounded-md hover:bg-emerald-500 hover:text-black transition-all font-bold uppercase tracking-widest"
                          >
                            Load
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {history.length > 0 && (
                <div className="p-4 border-t border-white/5">
                  <button 
                    onClick={() => {
                      if (confirm('Clear all history?')) {
                        setHistory([]);
                        localStorage.removeItem('poster_history');
                      }
                    }}
                    className="w-full py-3 text-xs font-bold text-zinc-500 hover:text-red-500 transition-colors uppercase tracking-widest"
                  >
                    Clear All History
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Key Modal */}
      <AnimatePresence>
        {showKeyModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          >
            <div className="bg-zinc-900 border border-white/10 p-8 rounded-3xl max-w-md w-full shadow-2xl flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold uppercase tracking-tight text-white">API Key Setup</h3>
                <button onClick={() => setShowKeyModal(false)} className="text-zinc-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <p className="text-zinc-400 text-sm">
                  Enter your Gemini API key below. This key is stored locally in your browser session.
                </p>
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex gap-3 items-start">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-200/80 leading-relaxed">
                    <strong>Security Warning:</strong> Client-side keys are visible in browser tools. For production, use the proxy server.
                  </p>
                </div>
                <input 
                  type="password"
                  value={localKey}
                  onChange={(e) => setLocalKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-black/40 border border-white/10 p-4 rounded-xl outline-none focus:border-emerald-500 transition-all text-sm font-mono"
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={handleSaveKey}
                  disabled={!localKey.trim()}
                  className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-bold rounded-xl transition-all uppercase tracking-wider"
                >
                  Save Key
                </button>
                {(localStorage.getItem("GEMINI_API_KEY") || sessionStorage.getItem("GEMINI_API_KEY")) && (
                  <button 
                    onClick={() => {
                      localStorage.removeItem("GEMINI_API_KEY");
                      sessionStorage.removeItem("GEMINI_API_KEY");
                      setLocalKey('');
                      setHasKey(false);
                      window.location.reload();
                    }}
                    className="px-4 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold rounded-xl transition-all uppercase tracking-wider border border-red-500/20"
                    title="Clear saved key"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Translation Warning Modal */}
      <AnimatePresence>
        {translationWarning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-zinc-900 border border-amber-500/30 p-8 rounded-3xl max-w-lg w-full shadow-2xl space-y-6"
            >
              <div className="flex items-center gap-4 text-amber-500">
                <div className="p-3 bg-amber-500/10 rounded-2xl">
                  <Globe className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold uppercase tracking-tight">Translation Check</h3>
                  <p className="text-xs text-amber-500/60 font-medium uppercase tracking-wider">Accuracy Verification</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-black/40 rounded-xl border border-white/5 space-y-2">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">AI Feedback</p>
                  <p className="text-zinc-300 text-sm leading-relaxed italic">"{translationWarning.feedback}"</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Original Draft</p>
                    <div className="p-3 bg-zinc-800/50 rounded-lg text-xs text-zinc-400 line-through">
                      {translationWarning.original}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] text-emerald-500 uppercase font-bold tracking-widest">Suggested Correction</p>
                    <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg text-xs text-emerald-500 font-bold">
                      {translationWarning.suggested}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <button 
                  onClick={() => {
                    if (posterData) {
                      const updatedData = { ...posterData, subtitles: translationWarning.suggested };
                      generatePoster(updatedData);
                    }
                  }}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl transition-all uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Apply & Generate
                </button>
                <button 
                  onClick={() => {
                    if (posterData) generatePoster(posterData);
                  }}
                  className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-all uppercase tracking-wider"
                >
                  Use Original Anyway
                </button>
                <button 
                  onClick={() => setTranslationWarning(null)}
                  className="w-full py-3 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Camera Modal */}
      <AnimatePresence>
        {showCamera && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/95 p-4"
          >
            <div className="relative w-full max-w-lg aspect-[3/4] sm:aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {/* Camera Controls */}
              <div className="absolute bottom-0 inset-x-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex justify-center items-center gap-8">
                <button 
                  onClick={stopCamera}
                  className="p-4 bg-zinc-800/80 text-white rounded-full hover:bg-zinc-700 transition-colors backdrop-blur-sm"
                >
                  <X className="w-6 h-6" />
                </button>
                <button 
                  onClick={capturePhoto}
                  className="w-16 h-16 bg-white rounded-full border-4 border-zinc-300 hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Message */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-emerald-500 text-black px-6 py-3 rounded-full font-bold uppercase tracking-widest text-xs shadow-2xl flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    
      {import.meta.env.DEV && <DebugStyleBaseline />}
    </div>
  );
}
