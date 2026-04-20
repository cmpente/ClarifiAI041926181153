import React, { useState, useEffect, useRef } from 'react';
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';

type ComponentSideTuple = 'correct' | 'wrong' | 'missing';
type GloveTuple = 'blue-nitrile' | 'other' | 'bare';
type BalaclavaTuple = 'mesh' | 'opaque' | 'missing';
type BootTuple = 'black-rubber' | 'other' | 'missing';
type StatusTuple = 'red-x' | 'green-check' | 'wrong' | 'missing';

export type Observation = {
  narrativeRendered: 'yes' | 'no' | 'partial';
  narrativeNotes: string;
  hardHats: { left: ComponentSideTuple; center: ComponentSideTuple; right: ComponentSideTuple };
  balaclavas: { left: BalaclavaTuple; center: BalaclavaTuple; right: BalaclavaTuple };
  gloves: { left: GloveTuple; center: GloveTuple; right: GloveTuple };
  boots: { left: BootTuple; center: BootTuple; right: BootTuple };
  apronsPresent: { left: boolean; center: boolean; right: boolean };
  statusIconLeft: StatusTuple;
  statusIconCenter: StatusTuple;
  statusIconRight: StatusTuple;
  headerEnglish: string;
  headerTranslation: string;
  strayTextPresent: boolean;
  linework: string;
  colorPalette: string;
  environmentDensity: string;
  deltasFromGolden: string;
  freeformNotes: string;
};

const DEFAULT_OBSERVATION: Observation = {
  narrativeRendered: 'yes',
  narrativeNotes: '',
  hardHats: { left: 'correct', center: 'correct', right: 'correct' },
  balaclavas: { left: 'mesh', center: 'mesh', right: 'mesh' },
  gloves: { left: 'blue-nitrile', center: 'blue-nitrile', right: 'blue-nitrile' },
  boots: { left: 'black-rubber', center: 'black-rubber', right: 'black-rubber' },
  apronsPresent: { left: false, center: false, right: false },
  statusIconLeft: 'red-x',
  statusIconCenter: 'green-check',
  statusIconRight: 'green-check',
  headerEnglish: '',
  headerTranslation: '',
  strayTextPresent: false,
  linework: '',
  colorPalette: '',
  environmentDensity: '',
  deltasFromGolden: '',
  freeformNotes: ''
};

interface DebugImageComparisonProps {
  initialBlobs: Record<string, { png: Blob, prompt: Blob }>;
  manifestData: any[];
}

export function DebugImageComparison({ initialBlobs, manifestData }: DebugImageComparisonProps) {
  const [goldenList, setGoldenList] = useState<string[]>([]);
  const [selectedBefore, setSelectedBefore] = useState<string>('');
  const [selectedGolden, setSelectedGolden] = useState<string>('');
  
  const [customBlobs, setCustomBlobs] = useState<Record<string, Blob>>({});
  
  const [compareMode, setCompareMode] = useState<'slider' | 'side-by-side' | 'onion'>('slider');
  const [matchAspect, setMatchAspect] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [pixelPeek, setPixelPeek] = useState(false);
  const [onionOpacity, setOnionOpacity] = useState(50);
  
  const [observations, setObservations] = useState<Record<string, Observation>>({});
  const [generatedMarkdown, setGeneratedMarkdown] = useState('');

  const peekOverlayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/debug/golden-list')
      .then(res => res.json())
      .then(data => setGoldenList(data.files || []))
      .catch(err => console.error("Could not fetch golden files:", err));
  }, []);

  const allBeforeKeys = [...Object.keys(initialBlobs), ...Object.keys(customBlobs)];

  useEffect(() => {
    if (allBeforeKeys.length > 0 && !selectedBefore) {
      setSelectedBefore(allBeforeKeys[0]);
    }
  }, [initialBlobs, customBlobs, selectedBefore, allBeforeKeys]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setCustomBlobs(prev => ({ ...prev, [file.name]: file }));
      setSelectedBefore(file.name);
    }
  };

  const getBeforeUrl = () => {
    if (customBlobs[selectedBefore]) return URL.createObjectURL(customBlobs[selectedBefore]);
    if (initialBlobs[selectedBefore]) return URL.createObjectURL(initialBlobs[selectedBefore].png);
    return '';
  };

  const currentBeforeUrl = getBeforeUrl();
  const currentGoldenUrl = selectedGolden ? `/api/debug/golden/${encodeURIComponent(selectedGolden)}` : '';

  const [peekPos, setPeekPos] = useState({ x: 0, y: 0, xPercent: 0, yPercent: 0, active: false });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPeekPos({ 
       x, 
       y, 
       xPercent: (x / rect.width) * 100, 
       yPercent: (y / rect.height) * 100,
       active: true
    });
  };

  const handleMouseLeave = () => setPeekPos(prev => ({ ...prev, active: false }));

  const handleObsChange = (field: keyof Observation | string, val: any) => {
    setObservations(prev => {
      const current = prev[selectedBefore] || { ...DEFAULT_OBSERVATION };
      
      // Handle nested fields like hardHats.left
      if (field.includes('.')) {
         const [parent, child] = field.split('.') as [keyof Observation, string];
         return {
           ...prev,
           [selectedBefore]: {
             ...current,
             [parent]: {
               ...(current[parent] as any),
               [child]: val
             }
           }
         };
      }
      
      return {
        ...prev,
        [selectedBefore]: { ...current, [field]: val }
      };
    });
  };

  const obs = observations[selectedBefore] || DEFAULT_OBSERVATION;

  const generateMarkdown = () => {
    let md = '';
    for (const key of allBeforeKeys) {
      const o = observations[key] || DEFAULT_OBSERVATION;
      const manifestNode = manifestData.find(m => m.slug === key);
      
      md += `### ${key}\n`;
      if (manifestNode) {
        md += `- **File:** \`before/${manifestNode.imageFile}\` (${manifestNode.imageSize} bytes, hash: ${manifestNode.imageHash.substring(0,8)})\n`;
      }
      md += `- **Narrative rendered correctly:** ${o.narrativeRendered} ${o.narrativeNotes ? `(${o.narrativeNotes})` : ''}\n`;
      md += `- **Linework:** ${o.linework || '⚠️ UNVERIFIED'}\n`;
      md += `- **Color palette:** ${o.colorPalette || '⚠️ UNVERIFIED'}\n`;
      md += `- **Character PPE compliance:**\n`;
      md += `  - Hard hats correct color? L:${o.hardHats.left}, C:${o.hardHats.center}, R:${o.hardHats.right}\n`;
      md += `  - Balaclavas semi-transparent mesh? L:${o.balaclavas.left}, C:${o.balaclavas.center}, R:${o.balaclavas.right}\n`;
      md += `  - Blue nitrile gloves present? L:${o.gloves.left}, C:${o.gloves.center}, R:${o.gloves.right}\n`;
      md += `  - Black rubber boots present? L:${o.boots.left}, C:${o.boots.center}, R:${o.boots.right}\n`;
      md += `  - Yellow aprons present (should be NO)? L:${o.apronsPresent.left}, C:${o.apronsPresent.center}, R:${o.apronsPresent.right}\n`;
      md += `- **Environment grounding:** ${o.environmentDensity || '⚠️ UNVERIFIED'}\n`;
      md += `- **Status icons:** L:${o.statusIconLeft}, C:${o.statusIconCenter}, R:${o.statusIconRight}\n`;
      md += `- **Header text legibility:** EN: "${o.headerEnglish || '?'}", TRANS: "${o.headerTranslation || '?'}", Stray text: ${o.strayTextPresent ? 'Yes' : 'No'}\n`;
      md += `- **Deltas from golden set:** ${o.deltasFromGolden || 'None'}\n`;
      if (o.freeformNotes) md += `- **Notes:** ${o.freeformNotes}\n`;
      md += `\n`;
    }
    setGeneratedMarkdown(md);
  };

  return (
    <div className="flex flex-col space-y-4 pt-2 border-t border-gray-200 mt-2">
      {allBeforeKeys.length === 0 ? (
        <div className="text-gray-500 text-xs italic">
          Run the baseline first, or drag-and-drop PNGs into this panel to compare.
          <input type="file" accept="image/png" className="block mt-2 text-xs" onChange={handleFileUpload} />
        </div>
      ) : (
        <>
          <div className="flex space-x-2 text-xs">
            <div className="flex-1 flex flex-col">
              <label className="font-bold">Before (Baseline)</label>
              <select className="p-1 border rounded" value={selectedBefore} onChange={e => setSelectedBefore(e.target.value)}>
                {allBeforeKeys.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <input type="file" accept="image/png" className="block mt-1 text-[10px]" onChange={handleFileUpload} />
            </div>
            <div className="flex-1 flex flex-col">
              <label className="font-bold">Golden Reference</label>
              <select className="p-1 border rounded" value={selectedGolden} onChange={e => setSelectedGolden(e.target.value)}>
                <option value="">(None selected)</option>
                {goldenList.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <label className="font-bold">Mode:</label>
            <select className="p-1 border rounded" value={compareMode} onChange={e => setCompareMode(e.target.value as any)}>
              <option value="slider">Slider</option>
              <option value="side-by-side">Side-by-side</option>
              <option value="onion">Onion-skin</option>
            </select>
            
            <label className="ml-2 flex flex-row items-center cursor-pointer">
              <input type="checkbox" checked={matchAspect} onChange={e => setMatchAspect(e.target.checked)} className="mr-1"/>
              Match aspect
            </label>

            <label className="ml-2 flex flex-row items-center cursor-pointer">
              <input type="checkbox" checked={pixelPeek} onChange={e => setPixelPeek(e.target.checked)} className="mr-1"/>
              Pixel Peek
            </label>
          </div>
          
          <div className="flex items-center space-x-2 text-xs">
            <label className="font-bold">Zoom:</label>
            <input type="range" min="50" max="300" value={zoomLevel} onChange={e => setZoomLevel(Number(e.target.value))} />
            <span>{zoomLevel}%</span>
            
            {compareMode === 'onion' && (
              <>
                <label className="font-bold ml-2">Opacity:</label>
                <input type="range" min="0" max="100" value={onionOpacity} onChange={e => setOnionOpacity(Number(e.target.value))} />
              </>
            )}
          </div>
          
          {currentBeforeUrl && (
            <div 
              ref={containerRef}
              className="relative border border-gray-300 bg-gray-100 overflow-hidden" 
              style={{ paddingBottom: matchAspect ? '56.25%' : 'auto', height: matchAspect ? 0 : 'auto', cursor: pixelPeek ? 'crosshair' : 'default' }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onMouseEnter={() => setPeekPos(prev => ({ ...prev, active: true }))}
            >
              <div className="absolute inset-0 flex justify-center items-center overflow-auto" style={{ width: '100%', height: '100%' }}>
                  <div style={{ width: `${zoomLevel}%`, height: `${zoomLevel}%`, transformOrigin: 'top left', display: 'flex', flexDirection: compareMode === 'side-by-side' ? 'row' : 'column' }}>
                     {compareMode === 'slider' && currentGoldenUrl && (
                        <div style={{ width: '100%', height: '100%' }}>
                            <ReactCompareSlider
                                itemOne={<ReactCompareSliderImage src={currentBeforeUrl} alt="Before" />}
                                itemTwo={<ReactCompareSliderImage src={currentGoldenUrl} alt="Golden" />}
                                style={{ width: '100%', height: '100%' }}
                            />
                        </div>
                     )}
                     {compareMode === 'slider' && !currentGoldenUrl && (
                        <img src={currentBeforeUrl} style={{ width: '100%', height: '100%', objectFit: matchAspect ? 'contain' : 'fill' }} />
                     )}

                     {compareMode === 'side-by-side' && (
                        <>
                          <img src={currentBeforeUrl} style={{ flex: 1, objectFit: matchAspect ? 'contain' : 'fill' }} />
                          {currentGoldenUrl && <img src={currentGoldenUrl} style={{ flex: 1, objectFit: matchAspect ? 'contain' : 'fill' }} />}
                        </>
                     )}

                     {compareMode === 'onion' && (
                         <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                             {currentGoldenUrl && <img src={currentGoldenUrl} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: matchAspect ? 'contain' : 'fill' }} />}
                             <img src={currentBeforeUrl} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: onionOpacity / 100, objectFit: matchAspect ? 'contain' : 'fill' }} />
                         </div>
                     )}
                  </div>
              </div>

              {pixelPeek && currentGoldenUrl && peekPos.active && (
                 <div className="absolute w-[200px] h-[200px] border-2 border-red-500 rounded-full shadow-lg pointer-events-none z-50 bg-white flex flex-col overflow-hidden" style={{ left: peekPos.x + 20, top: peekPos.y + 20 }}>
                    <div className="flex-1 w-full bg-no-repeat" style={{ backgroundImage: `url(${currentBeforeUrl})`, backgroundPosition: `${peekPos.xPercent}% ${peekPos.yPercent}%`, backgroundSize: `${zoomLevel * 3}%` }} />
                    <div className="h-[2px] bg-red-500 w-full" />
                    <div className="flex-1 w-full bg-no-repeat" style={{ backgroundImage: `url(${currentGoldenUrl})`, backgroundPosition: `${peekPos.xPercent}% ${peekPos.yPercent}%`, backgroundSize: `${zoomLevel * 3}%` }} />
                 </div>
              )}
            </div>
          )}

          {/* Form */}
          <div className="text-xs space-y-2 mt-4 max-h-[300px] overflow-y-auto pr-2 border-t pt-2">
            <h4 className="font-bold">Observations for {selectedBefore}</h4>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500">Narrative Rendered</label>
                <select className="border p-1 w-full" value={obs.narrativeRendered} onChange={e => handleObsChange('narrativeRendered', e.target.value)}>
                  <option value="yes">Yes</option>
                  <option value="partial">Partial</option>
                  <option value="no">No</option>
                </select>
                <input placeholder="Notes..." type="text" className="w-full border p-1 mt-1" value={obs.narrativeNotes} onChange={e => handleObsChange('narrativeNotes', e.target.value)} />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500">Linework / Color</label>
                <input placeholder="Linework notes..." type="text" className="w-full border p-1 mb-1" value={obs.linework} onChange={e => handleObsChange('linework', e.target.value)} />
                <input placeholder="Color palettes notes..." type="text" className="w-full border p-1" value={obs.colorPalette} onChange={e => handleObsChange('colorPalette', e.target.value)} />
              </div>
            </div>

            <table className="w-full text-left bg-gray-50 border mt-2">
              <thead>
                 <tr className="bg-gray-200">
                   <th className="p-1 font-bold">PPE</th>
                   <th className="p-1 font-bold text-center">Left</th>
                   <th className="p-1 font-bold text-center">Center</th>
                   <th className="p-1 font-bold text-center">Right</th>
                 </tr>
              </thead>
              <tbody>
                {['hardHats', 'balaclavas', 'gloves', 'boots'].map(k => (
                  <tr key={k} className="border-b">
                    <td className="p-1 font-medium bg-gray-100">{k}</td>
                    <td className="p-1 text-center"><select className="w-full text-[10px]" value={(obs as any)[k].left} onChange={e => handleObsChange(`${k}.left`, e.target.value)}><option>correct</option><option>wrong</option><option>missing</option><option>mesh</option><option>opaque</option><option>blue-nitrile</option><option>other</option><option>bare</option><option>black-rubber</option></select></td>
                    <td className="p-1 text-center"><select className="w-full text-[10px]" value={(obs as any)[k].center} onChange={e => handleObsChange(`${k}.center`, e.target.value)}><option>correct</option><option>wrong</option><option>missing</option><option>mesh</option><option>opaque</option><option>blue-nitrile</option><option>other</option><option>bare</option><option>black-rubber</option></select></td>
                    <td className="p-1 text-center"><select className="w-full text-[10px]" value={(obs as any)[k].right} onChange={e => handleObsChange(`${k}.right`, e.target.value)}><option>correct</option><option>wrong</option><option>missing</option><option>mesh</option><option>opaque</option><option>blue-nitrile</option><option>other</option><option>bare</option><option>black-rubber</option></select></td>
                  </tr>
                ))}
                  <tr className="border-b">
                    <td className="p-1 font-medium bg-gray-100">Aprons</td>
                    <td className="p-1 text-center"><input type="checkbox" checked={obs.apronsPresent.left} onChange={e => handleObsChange('apronsPresent.left', e.target.checked)} /></td>
                    <td className="p-1 text-center"><input type="checkbox" checked={obs.apronsPresent.center} onChange={e => handleObsChange('apronsPresent.center', e.target.checked)} /></td>
                    <td className="p-1 text-center"><input type="checkbox" checked={obs.apronsPresent.right} onChange={e => handleObsChange('apronsPresent.right', e.target.checked)} /></td>
                  </tr>
                  <tr>
                    <td className="p-1 font-medium bg-gray-100">Status</td>
                    <td className="p-1 text-center"><select className="w-full text-[10px]" value={(obs as any)['statusIconLeft']} onChange={e => handleObsChange('statusIconLeft', e.target.value)}><option>red-x</option><option>green-check</option><option>wrong</option><option>missing</option></select></td>
                    <td className="p-1 text-center"><select className="w-full text-[10px]" value={(obs as any)['statusIconCenter']} onChange={e => handleObsChange('statusIconCenter', e.target.value)}><option>red-x</option><option>green-check</option><option>wrong</option><option>missing</option></select></td>
                    <td className="p-1 text-center"><select className="w-full text-[10px]" value={(obs as any)['statusIconRight']} onChange={e => handleObsChange('statusIconRight', e.target.value)}><option>red-x</option><option>green-check</option><option>wrong</option><option>missing</option></select></td>
                  </tr>
              </tbody>
            </table>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <label className="block text-[10px] uppercase font-bold text-gray-500">Header Text</label>
                <input placeholder="Eng..." type="text" className="w-full border p-1" value={obs.headerEnglish} onChange={e => handleObsChange('headerEnglish', e.target.value)} />
                <input placeholder="Transl..." type="text" className="w-full border p-1 mt-1" value={obs.headerTranslation} onChange={e => handleObsChange('headerTranslation', e.target.value)} />
              </div>
              <div>
                 <label className="block text-[10px] uppercase font-bold text-gray-500">Misc</label>
                 <label className="flex items-center"><input type="checkbox" checked={obs.strayTextPresent} onChange={e => handleObsChange('strayTextPresent', e.target.checked)} className="mr-1"/> Stray text</label>
                 <input placeholder="Env Density notes..." type="text" className="w-full border p-1 mt-1" value={obs.environmentDensity} onChange={e => handleObsChange('environmentDensity', e.target.value)} />
                 <input placeholder="Deltas from golden..." type="text" className="w-full border p-1 mt-1" value={obs.deltasFromGolden} onChange={e => handleObsChange('deltasFromGolden', e.target.value)} />
              </div>
            </div>

            <textarea placeholder="Freeform notes..." className="w-full border p-1 mt-2 h-16" value={obs.freeformNotes} onChange={e => handleObsChange('freeformNotes', e.target.value)} />
          </div>

          <button onClick={generateMarkdown} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-2 text-xs">
            Generate Audit Observations
          </button>
          
          {generatedMarkdown && (
             <div className="mt-2">
                <label className="font-bold text-[10px] text-gray-500">Copy this to STYLE_AUDIT.md:</label>
                <textarea readOnly className="w-full h-32 text-[10px] font-mono border p-1 bg-gray-50 mt-1" value={generatedMarkdown} />
             </div>
          )}

        </>
      )}
    </div>
  );
}
