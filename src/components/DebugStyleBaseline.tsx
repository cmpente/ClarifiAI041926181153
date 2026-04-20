import React, { useState, useEffect } from 'react';
import { Download, Play, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

interface TopicStatus {
  state: string;
  details?: any;
}

export function DebugStyleBaseline() {
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [force, setForce] = useState(false);
  const [status, setStatus] = useState<Record<string, TopicStatus>>({});
  const [totalCost, setTotalCost] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [blobs, setBlobs] = useState<Record<string, { png: Blob, prompt: Blob}>>({});
  const [manifestData, setManifestData] = useState<any[]>([]);
  const [debugKey, setDebugKey] = useState(() => 
    localStorage.getItem('GEMINI_API_KEY') 
    || sessionStorage.getItem('GEMINI_API_KEY') 
    || ''
  );

  console.log('[DebugStyleBaseline] Component rendering, visible:', isOpen);

  useEffect(() => {
    console.log('[DebugStyleBaseline] Registering keyboard listener');
    const handleKeyDown = (e: KeyboardEvent) => {
      console.log('[DebugStyleBaseline] keydown', { key: e.key, ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey, alt: e.altKey });
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const runBaseline = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setIsComplete(false);
    setStatus({});
    setTotalCost(0);
    setBlobs({});
    setManifestData([]);

    const url = `/api/debug/run-style-baseline?force=${force}`;
    
    console.log('[DebugStyleBaseline] Starting fetch with readable stream:', url);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          ...(debugKey ? { 'x-goog-api-key': debugKey } : {})
        }
      });
      
      if (!response.ok) {
        console.error('[DebugStyleBaseline] Request failed:', response.status, await response.text());
        setIsRunning(false);
        return;
      }
      
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        
        const frames = buffer.split('\n\n');
        buffer = frames.pop() || '';
        
        for (const frame of frames) {
          const lines = frame.split('\n');
          let eventName = 'message';
          let dataStr = '';
          for (const line of lines) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim();
            else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
          }
          
          if (!dataStr) continue;
          
          let data;
          try { data = JSON.parse(dataStr); } catch(e) { continue; }
          
          if (eventName === 'topic-skipped' || data.event === 'topic-skipped') {
            console.log('[DebugStyleBaseline] topic-skipped:', data);
            setStatus(prev => ({ ...prev, [data.topic]: { state: 'skipped' } }));
          } else if (eventName === 'topic-complete' || data.event === 'topic-complete') {
            console.log('[DebugStyleBaseline] topic-complete:', data.topic);
            const rawTopicData = data.data || data;
            const topicCopy = { ...rawTopicData };
            const pngBase64 = topicCopy.pngBase64;
            const promptText = topicCopy.promptText;
            delete topicCopy.pngBase64;
            delete topicCopy.promptText;
            
            setStatus(prev => ({ ...prev, [data.topic]: { state: 'complete', details: topicCopy } }));
            setTotalCost(prev => prev + (topicCopy.cost || 0));
            
            if (pngBase64) {
               const byteCharacters = atob(pngBase64);
               const byteNumbers = new Array(byteCharacters.length);
               for (let i = 0; i < byteCharacters.length; i++) {
                   byteNumbers[i] = byteCharacters.charCodeAt(i);
               }
               const byteArray = new Uint8Array(byteNumbers);
               const pngBlob = new Blob([byteArray], { type: 'image/png' });
               const promptBlob = new Blob([promptText || ''], { type: 'text/plain' });
               
               setBlobs(prev => ({
                   ...prev,
                   [data.slug || topicCopy.slug]: { png: pngBlob, prompt: promptBlob }
               }));
            }
          } else if (eventName === 'topic-error' || data.event === 'topic-error') {
            console.log('[DebugStyleBaseline] topic-error:', data);
            setStatus(prev => ({ ...prev, [data.topic]: { state: 'error', details: data.error } }));
          } else if (eventName === 'run-error' || data.event === 'run-error') {
            console.error('[DebugStyleBaseline] run-error:', data.error);
            setIsRunning(false);
            return;
          } else if (eventName === 'run-complete' || data.event === 'run-complete') {
            console.log('[DebugStyleBaseline] run-complete');
            if (data.totalCost) setTotalCost(data.totalCost);
            if (data.manifest) setManifestData(data.manifest);
            setIsRunning(false);
            setIsComplete(true);
            return;
          }
        }
      }
    } catch (error) {
      console.error('[DebugStyleBaseline] fetch error:', error);
    } finally {
      setIsRunning(false);
    }
  };


  const downloadSingle = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAllPNGs = async () => {
    for (const [slug, data] of Object.entries(blobs) as [string, {png: Blob, prompt: Blob}][]) {
       downloadSingle(data.png, `${slug}.png`);
       await new Promise(r => setTimeout(r, 200));
    }
  };

  const handleDownloadZip = async () => {
    const { zip } = await import('fflate');

    const manifestObj = manifestData.reduce((acc, cur) => {
        acc[cur.topic] = cur;
        return acc;
    }, {} as any);

    const zipObj: any = {
      'tests': {
         'style-baseline': {
            'before': {
               'run-manifest.json': new TextEncoder().encode(JSON.stringify(manifestObj, null, 2))
            }
         }
      }
    };
    
    // Process all blobs
    for (const [slug, data] of Object.entries(blobs) as [string, {png: Blob, prompt: Blob}][]) {
       const pngBuffer = new Uint8Array(await data.png.arrayBuffer());
       const promptBuffer = new Uint8Array(await data.prompt.arrayBuffer());
       zipObj['tests']['style-baseline']['before'][`${slug}.png`] = pngBuffer;
       zipObj['tests']['style-baseline']['before'][`${slug}.prompt.txt`] = promptBuffer;
    }

    zip(zipObj, (err, data) => {
       if (err) {
         console.error('[DebugStyleBaseline] zip error:', err);
         return;
       }
       const zipBlob = new Blob([data], { type: 'application/zip' });
       downloadSingle(zipBlob, 'style-baseline-results.zip');
    });
  };


  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-[80vh] overflow-y-auto z-[9999] bg-white rounded-xl shadow-2xl border-2 border-orange-500 flex flex-col">
      <div className="bg-orange-50 p-4 border-b rounded-t-xl shrink-0 flex justify-between items-center">
        <h3 className="text-orange-900 text-sm font-bold uppercase tracking-wider m-0">Style Baseline (DEV)</h3>
        <button className="text-orange-900 hover:bg-orange-200 rounded p-1" onClick={() => setIsOpen(false)}>×</button>
      </div>
      
      <div className="p-4 space-y-4 text-sm text-black bg-white overflow-y-auto">
        <div className="bg-orange-100 text-orange-800 p-3 rounded-md text-xs">
          <strong>Warning:</strong> This calls the Gemini API (~$0.15). Files must be manually downloaded/extracted locally.
        </div>

        <div className="flex flex-col space-y-2 bg-gray-50 p-2 rounded-md border border-gray-200">
          <label className="text-xs font-bold text-gray-700 block">
            API Key (required for baseline run):
          </label>
          <input
            type="password"
            value={debugKey}
            onChange={(e) => setDebugKey(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full text-xs p-2 border border-gray-300 rounded"
          />
          <small className="text-[10px] text-gray-500 block leading-tight">
            ⚠️ This panel requires the Gemini API key to be entered directly because the AI Studio runtime does not expose the injected key to custom endpoints.
          </small>
          <button 
            onClick={() => {
              localStorage.setItem('GEMINI_API_KEY', debugKey);
              console.log('[DebugBaseline] Saved key to localStorage');
            }}
            className="text-xs bg-gray-200 hover:bg-gray-300 py-1 px-3 rounded w-max"
          >
            Save Key to localStorage
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <input 
            type="checkbox" 
            id="force-run" 
            checked={force} 
            onChange={(e) => setForce(e.target.checked)}
            disabled={isRunning} 
          />
          <label htmlFor="force-run" className="text-xs font-medium cursor-pointer">
            Force regenerate (overwrite existing)
          </label>
        </div>

        <button 
          onClick={() => {
            console.log('[DebugStyleBaseline] Run button clicked');
            runBaseline();
          }} 
          disabled={isRunning || debugKey.length < 30 || !debugKey.startsWith('AIzaSy')}
          className="w-full flex justify-center items-center py-2 px-4 rounded-md font-bold transition-colors bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50"
        >
          {isRunning ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
          {isRunning ? 'Running Baseline...' : 'Run Baseline'}
        </button>

        <div className="space-y-2 mt-4 border-t pt-4">
          <div className="flex justify-between font-semibold text-xs text-gray-500 uppercase tracking-wider mb-2">
            <span>Status</span>
            <span>Est Cost: ${totalCost.toFixed(4)}</span>
          </div>
          
          {Object.entries(status).map(([topic, info]: [string, any]) => (
            <div key={topic} className="flex flex-col text-xs bg-gray-50 p-2 rounded border border-gray-100">
              <div className="flex justify-between items-start">
                <span className="font-medium text-gray-700" title={topic}>{topic.length > 30 ? topic.substring(0, 30) + '...' : topic}</span>
                <span>
                  {info.state === 'skipped' && <span className="flex items-center text-gray-500"><RefreshCw className="w-3 h-3 mr-1" />Skipped</span>}
                  {info.state === 'error' && <span className="flex items-center text-red-500"><AlertCircle className="w-3 h-3 mr-1" />Error</span>}
                  {info.state === 'complete' && <span className="flex items-center text-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />${info.details?.cost?.toFixed(4)}</span>}
                </span>
              </div>
              {info.state === 'error' && <div className="text-red-500 mt-1">{info.details}</div>}
              {info.state === 'complete' && info.details?.imageSize && (
                <div className="text-gray-400 mt-1 flex flex-col">
                  <div className="flex justify-between">
                    <span>{(info.details.imageSize / 1024).toFixed(1)} KB</span>
                    <span>{info.details.timeTotalMs}ms</span>
                  </div>
                  {blobs[info.details.slug] && (
                     <div className="flex justify-start space-x-2 mt-1">
                        <button className="text-blue-500 hover:underline" onClick={() => downloadSingle(blobs[info.details.slug].png, `${info.details.slug}.png`)}>[Download PNG]</button>
                        <button className="text-blue-500 hover:underline" onClick={() => downloadSingle(blobs[info.details.slug].prompt, `${info.details.slug}.prompt.txt`)}>[Download Prompt]</button>
                     </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {isComplete && (
          <div className="border-t pt-4 mt-4 space-y-3">
             <button onClick={handleDownloadAllPNGs} className="w-full flex flex-row items-center justify-center py-2 px-4 border border-gray-300 rounded hover:bg-gray-50 text-gray-800 transition-colors bg-white font-medium">
               <Download className="w-4 h-4 mr-2" />
               Download All PNGs
             </button>
             <button onClick={handleDownloadZip} className="w-full flex flex-row items-center justify-center py-3 px-4 border border-transparent rounded hover:bg-blue-700 text-white transition-colors bg-blue-600 font-bold shadow-md">
               <Download className="w-4 h-4 mr-2" />
               Download Manifest + All (ZIP)
             </button>
             <div className="text-xs text-center text-gray-500">
               <p>Extracting the ZIP at your repository root will auto-place files in the correct tests/ directory.</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
