import fs from 'fs';

const updatedComponent = `import React, { useState, useEffect } from 'react';
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

    const apiKey = localStorage.getItem('GEMINI_API_KEY') || sessionStorage.getItem('GEMINI_API_KEY') || '';
    const url = \`/api/debug/run-style-baseline?force=\${force}\`;
    
    console.log('[DebugStyleBaseline] Starting fetch with readable stream:', url);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          ...(apiKey ? { 'x-goog-api-key': apiKey } : {})
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
        
        const frames = buffer.split('\\n\\n');
        buffer = frames.pop() || '';
        
        for (const frame of frames) {
          const lines = frame.split('\\n');
          let eventName = 'message';
          let dataStr = '';
          for (const line of lines) {
            if (line.startsWith('event:')) eventName = line.slice(6).trim();
            else if (line.startsWith('data:')) dataStr += line.slice(5).trim();
          }
          
          if (!dataStr) continue;
          
          let data;
          try { data = JSON.parse(dataStr); } catch(e) { continue; }
          
          if (eventName === 'topic-skipped') {
            console.log('[DebugStyleBaseline] topic-skipped:', data);
            setStatus(prev => ({ ...prev, [data.topic]: { state: 'skipped' } }));
          } else if (eventName === 'topic-complete') {
            console.log('[DebugStyleBaseline] topic-complete:', data);
            setStatus(prev => ({ ...prev, [data.topic]: { state: 'complete', details: data.data } }));
            setTotalCost(prev => prev + (data.data.cost || 0));
          } else if (eventName === 'topic-error') {
            console.log('[DebugStyleBaseline] topic-error:', data);
            setStatus(prev => ({ ...prev, [data.topic]: { state: 'error', details: data.error } }));
          } else if (eventName === 'run-error') {
            console.error('[DebugStyleBaseline] run-error:', data.error);
            setIsRunning(false);
            return;
          } else if (eventName === 'run-complete') {
            console.log('[DebugStyleBaseline] run-complete');
            if (data.totalCost) setTotalCost(data.totalCost);
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

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = '/tests/style-baseline/before/run-manifest.json';
    a.download = 'run-manifest.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
          <strong>Warning:</strong> This calls the Gemini API (~$0.15). Results written to <code>tests/style-baseline/before/</code>.
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
          disabled={isRunning}
          className="w-full flex justify-center items-center py-2 px-4 rounded-md font-bold transition-colors bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50"
        >
          {isRunning ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
          {isRunning ? 'Running Baseline...' : 'Run Baseline'}
        </button>

        <div className="space-y-2 mt-4 border-t pt-4">
          <div className="flex justify-between font-semibold text-xs text-gray-500 uppercase tracking-wider mb-2">
            <span>Status</span>
            <span>Est Cost: \${totalCost.toFixed(4)}</span>
          </div>
          
          {Object.entries(status).map(([topic, info]: [string, any]) => (
            <div key={topic} className="flex flex-col text-xs bg-gray-50 p-2 rounded border border-gray-100">
              <div className="flex justify-between items-start">
                <span className="font-medium text-gray-700" title={topic}>{topic.length > 30 ? topic.substring(0, 30) + '...' : topic}</span>
                <span>
                  {info.state === 'skipped' && <span className="flex items-center text-gray-500"><RefreshCw className="w-3 h-3 mr-1" />Skipped</span>}
                  {info.state === 'error' && <span className="flex items-center text-red-500"><AlertCircle className="w-3 h-3 mr-1" />Error</span>}
                  {info.state === 'complete' && <span className="flex items-center text-green-600"><CheckCircle2 className="w-3 h-3 mr-1" />\${info.details?.cost?.toFixed(4)}</span>}
                </span>
              </div>
              {info.state === 'error' && <div className="text-red-500 mt-1">{info.details}</div>}
              {info.state === 'complete' && info.details?.imageSize && (
                <div className="text-gray-400 mt-1 flex justify-between">
                  <span>{(info.details.imageSize / 1024).toFixed(1)} KB</span>
                  <span>{info.details.timeTotalMs}ms</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {isComplete && (
          <div className="border-t pt-4 mt-4 space-y-3">
            <button onClick={handleDownload} className="w-full flex flex-row items-center justify-center py-2 px-4 border border-gray-300 rounded hover:bg-gray-50 text-gray-800 transition-colors bg-white">
              <Download className="w-4 h-4 mr-2" />
              Download manifest
            </button>
            <div className="text-xs text-center text-gray-500">
              <p>Files written to:</p>
              <code className="bg-gray-100 px-1 py-0.5 rounded break-all select-all block mt-1">
                /tests/style-baseline/before/
              </code>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
`;

fs.writeFileSync('src/components/DebugStyleBaseline.tsx', updatedComponent);
