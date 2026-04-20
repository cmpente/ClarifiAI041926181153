import React, { useState, useEffect } from 'react';
import { Download, Play, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

import { DebugImageComparison } from './DebugImageComparison';

interface TopicStatus {
  state: string;
  details?: any;
}

export function DebugStyleBaseline() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'run' | 'compare'>('run');
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
  
  const [referenceTests, setReferenceTests] = useState<any>({});
  const [isRunningSelfTest, setIsRunningSelfTest] = useState(false);

  const runSelfTests = async () => {
     setIsRunningSelfTest(true);
     setReferenceTests({});
     try {
       const topics = [
         {topic: "GMP Compliance — Wash Hands", sceneTypes: ["handwashing", "gmp"]},
         {topic: "Food Safety — Grade Out Defective Product", sceneTypes: ["food_safety", "product_inspection"]},
         {topic: "Stand-Up Forklift Safety — Stay In Designated Paths", sceneTypes: ["forklift"]},
         {topic: "LOTO - Jammed Conveyor", sceneTypes: ["loto", "sign_present"]},
         {topic: "Sanitation — Preparing for Washdown", sceneTypes: ["sanitation_washdown"]}
       ];
       const results: any = {};
       for (const t of topics) {
          const res = await fetch(`/api/debug/prompt-self-test?topic=${encodeURIComponent(t.topic)}&sceneTypes=${encodeURIComponent(t.sceneTypes.join(','))}`);
          results[t.topic] = await res.json();
       }
       setReferenceTests(results);
     } catch(e) {
       console.error("Self test error", e);
     }
     setIsRunningSelfTest(false);
  };

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

    for (const data of Object.values(blobs) as {png: Blob, prompt: Blob}[]) {
       const text = await data.prompt.text();
       if (text.includes('${')) {
         console.error('[DebugBaseline] ⚠️ Unresolved template literal detected in prompt!');
         alert('Prompt contains unresolved template literals. This baseline is invalid. Check console.');
         return;
       }
    }

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
    <div className={`fixed bottom-4 right-4 ${activeTab === 'compare' ? 'w-[800px]' : 'w-96'} max-h-[90vh] overflow-y-auto z-[9999] bg-white rounded-xl shadow-2xl border-2 border-orange-500 flex flex-col transition-all duration-200`}>
      <div className="bg-orange-50 p-4 border-b rounded-t-xl shrink-0 flex justify-between items-center">
        <h3 className="text-orange-900 text-sm font-bold uppercase tracking-wider m-0">Style Baseline (DEV)</h3>
        <button className="text-orange-900 hover:bg-orange-200 rounded p-1" onClick={() => setIsOpen(false)}>×</button>
      </div>

      <div className="flex border-b text-xs">
        <button 
          className={`flex-1 py-2 font-bold ${activeTab === 'run' ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'}`}
          onClick={() => setActiveTab('run')}
        >
          Run Baseline
        </button>
        <button 
          className={`flex-1 py-2 font-bold ${activeTab === 'compare' ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'}`}
          onClick={() => setActiveTab('compare')}
        >
          Compare
        </button>
      </div>
      
      <div className="p-4 space-y-4 text-sm text-black bg-white overflow-y-auto">
        {activeTab === 'run' ? (
          <>
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

            <div className="p-3 bg-gray-100 rounded-md text-xs space-y-2">
               <button 
                  onClick={runSelfTests} 
                  disabled={isRunningSelfTest}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-1 rounded"
               >
                  {isRunningSelfTest ? 'Checking References...' : 'Pre-flight Reference Check'}
               </button>
               {Object.keys(referenceTests).length > 0 && (
                  <div className="max-h-60 overflow-y-auto space-y-3 mt-2">
                     {Object.entries(referenceTests).map(([t, data]: any) => (
                        <div key={t} className="border-l-4 border-blue-500 pl-2">
                           <div className="font-bold line-clamp-1" title={t}>{t}</div>
                           {data.referenceImages && (
                             <div className="text-[10px] text-gray-700 mt-1 space-y-1">
                               <div>Total Images: {data.referenceImages.totalImages} ({(data.referenceImages.totalBytesEncoded / 1024 / 1024).toFixed(2)} MB)</div>
                               <ul className="list-disc pl-3">
                                 {data.referenceImages.facilityAnchors.map((f: any) => (
                                    <li key={f.file}>{f.file} <span className="opacity-50">({f.category})</span></li>
                                 ))}
                               </ul>
                             </div>
                           )}
                           {data.error && <div className="text-red-500">{data.error}</div>}
                        </div>
                     ))}
                  </div>
               )}
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
                        <div className="flex flex-col space-y-1 mt-1">
                          <div className="flex justify-start space-x-2">
                              <button className="text-blue-500 hover:underline" onClick={() => downloadSingle(blobs[info.details.slug].png, `${info.details.slug}.png`)}>[Download PNG]</button>
                              <button className="text-blue-500 hover:underline" onClick={() => downloadSingle(blobs[info.details.slug].prompt, `${info.details.slug}.prompt.txt`)}>[Download Prompt]</button>
                              <button 
                                className="text-purple-600 hover:underline font-bold" 
                                onClick={async () => {
                                  try {
                                    setStatus(prev => ({...prev, [topic]: {...prev[topic], qaStatus: 'running'}}));
                                    const arrayBuffer = await blobs[info.details.slug].png.arrayBuffer();
                                    const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
                                    
                                    const res = await fetch('/api/debug/vision-qa', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json', ...(debugKey ? { 'x-goog-api-key': debugKey } : {}) },
                                      body: JSON.stringify({ imageBase64: base64 })
                                    });
                                    const result = await res.json();
                                    setStatus(prev => ({...prev, [topic]: {...prev[topic], qaStatus: 'complete', qaResult: result}}));
                                  } catch (err) {
                                    setStatus(prev => ({...prev, [topic]: {...prev[topic], qaStatus: 'error'}}));
                                  }
                                }}
                              >
                                [Run Form QA]
                              </button>
                          </div>
                          {info.qaStatus === 'running' && <div className="text-purple-500 text-[10px]">Running Vision QA...</div>}
                          {info.qaStatus === 'error' && <div className="text-red-500 text-[10px]">QA Failed</div>}
                          {info.qaStatus === 'complete' && info.qaResult && (
                             <div className="bg-white p-1 mt-1 border rounded text-[10px] space-y-1 max-h-32 overflow-y-auto w-full">
                                {Object.entries(info.qaResult).map(([k, v]: [string, any]) => {
                                   if (k === 'summary') return <div key={k} className="font-bold border-t mt-1 pt-1">{v as string}</div>;
                                   const isPass = v.answer?.toLowerCase().includes('yes');
                                   const isUnclear = v.answer?.toLowerCase().includes('unclear');
                                   return (
                                     <div key={k} className="flex">
                                        <span className={`w-3 flex-shrink-0 ${isPass ? 'text-green-500' : (isUnclear ? 'text-yellow-500' : 'text-red-500')}`}>
                                          {isPass ? '✓' : (isUnclear ? '?' : '✗')}
                                        </span>
                                        <span className="flex-1">{v.detail}</span>
                                     </div>
                                   );
                                })}
                             </div>
                          )}
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
          </>
        ) : (
          <DebugImageComparison initialBlobs={blobs} manifestData={manifestData} />
        )}
      </div>
    </div>
  );
}
