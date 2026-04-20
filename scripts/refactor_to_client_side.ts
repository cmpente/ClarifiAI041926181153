import fs from 'fs';

let content = fs.readFileSync('src/components/DebugStyleBaseline.tsx', 'utf-8');

// replace the state hook and handle Download logic
content = content.replace(
  `  const [totalCost, setTotalCost] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [debugKey, setDebugKey] = useState(() => `,
  `  const [totalCost, setTotalCost] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [blobs, setBlobs] = useState<Record<string, { png: Blob, prompt: Blob}>>({});
  const [manifestData, setManifestData] = useState<any[]>([]);
  const [debugKey, setDebugKey] = useState(() => `
);

// update topic complete
content = content.replace(
  `          } else if (eventName === 'topic-complete' || data.event === 'topic-complete') {
            console.log('[DebugStyleBaseline] topic-complete:', data);
            setStatus(prev => ({ ...prev, [data.topic]: { state: 'complete', details: data.data } }));
            setTotalCost(prev => prev + (data.data.cost || 0));
          } else if`,
  `          } else if (eventName === 'topic-complete' || data.event === 'topic-complete') {
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
          } else if`
);

content = content.replace(
  `          } else if (eventName === 'run-complete' || data.event === 'run-complete') {
            console.log('[DebugStyleBaseline] run-complete');
            if (data.totalCost) setTotalCost(data.totalCost);
            setIsRunning(false);
            setIsComplete(true);
            return;
          }`,
  `          } else if (eventName === 'run-complete' || data.event === 'run-complete') {
            console.log('[DebugStyleBaseline] run-complete');
            if (data.totalCost) setTotalCost(data.totalCost);
            if (data.manifest) setManifestData(data.manifest);
            setIsRunning(false);
            setIsComplete(true);
            return;
          }`
);

// update reset inside runBaseline
content = content.replace(
  `    setIsComplete(false);
    setStatus({});
    setTotalCost(0);`,
  `    setIsComplete(false);
    setStatus({});
    setTotalCost(0);
    setBlobs({});
    setManifestData([]);`
)


// Handle downloads logic properly via new Zip button
const zippedLogic = `
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
    for (const [slug, data] of Object.entries(blobs)) {
       downloadSingle(data.png, \`\${slug}.png\`);
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
    for (const [slug, data] of Object.entries(blobs)) {
       const pngBuffer = new Uint8Array(await data.png.arrayBuffer());
       const promptBuffer = new Uint8Array(await data.prompt.arrayBuffer());
       zipObj['tests']['style-baseline']['before'][\`\${slug}.png\`] = pngBuffer;
       zipObj['tests']['style-baseline']['before'][\`\${slug}.prompt.txt\`] = promptBuffer;
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
`;

content = content.replace(
  `  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = '/tests/style-baseline/before/run-manifest.json';
    a.download = 'run-manifest.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };`,
  zippedLogic
);

// Output render for topic
content = content.replace(
  `              {info.state === 'complete' && info.details?.imageSize && (
                <div className="text-gray-400 mt-1 flex justify-between">
                  <span>{(info.details.imageSize / 1024).toFixed(1)} KB</span>
                  <span>{info.details.timeTotalMs}ms</span>
                </div>
              )}`,
  `              {info.state === 'complete' && info.details?.imageSize && (
                <div className="text-gray-400 mt-1 flex flex-col">
                  <div className="flex justify-between">
                    <span>{(info.details.imageSize / 1024).toFixed(1)} KB</span>
                    <span>{info.details.timeTotalMs}ms</span>
                  </div>
                  {blobs[info.details.slug] && (
                     <div className="flex justify-start space-x-2 mt-1">
                        <button className="text-blue-500 hover:underline" onClick={() => downloadSingle(blobs[info.details.slug].png, \`\${info.details.slug}.png\`)}>[Download PNG]</button>
                        <button className="text-blue-500 hover:underline" onClick={() => downloadSingle(blobs[info.details.slug].prompt, \`\${info.details.slug}.prompt.txt\`)}>[Download Prompt]</button>
                     </div>
                  )}
                </div>
              )}`
);

// Output render end screen
content = content.replace(
  `        {isComplete && (
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
        )}`,
  `        {isComplete && (
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
        )}`
);

// remove the warning about file locations
content = content.replace(
  `        <div className="bg-orange-100 text-orange-800 p-3 rounded-md text-xs">
          <strong>Warning:</strong> This calls the Gemini API (~$0.15). Results written to <code>tests/style-baseline/before/</code>.
        </div>`,
  `        <div className="bg-orange-100 text-orange-800 p-3 rounded-md text-xs">
          <strong>Warning:</strong> This calls the Gemini API (~$0.15). Files must be manually downloaded/extracted locally.
        </div>`
);

fs.writeFileSync('src/components/DebugStyleBaseline.tsx', content);

