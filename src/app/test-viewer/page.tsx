'use client';

import { useEffect, useRef, useState } from 'react';

export default function TestViewerPage() {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [structureInfo, setStructureInfo] = useState<any>(null);

  const addLog = (msg: string) => {
    console.log(msg);
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  const testStructure = async () => {
    try {
      addLog('Starting test...');

      // Test 1: Load 3Dmol
      addLog('Loading 3Dmol.js...');
      // @ts-ignore - 3dmol types not available
      const module = await import('3dmol/build/3Dmol.js');
      const $3Dmol = (module as any).default || module;
      addLog('✓ 3Dmol.js loaded successfully');

      // Test 2: Fetch structure
      const proteinId = '8yl2_F';
      addLog(`Fetching structure for ${proteinId}...`);
      const response = await fetch(`/api/structure/${proteinId}`);
      addLog(`Response status: ${response.status}`);
      addLog(`Response headers: ${response.headers.get('content-type')}`);

      if (!response.ok) {
        addLog(`ERROR: API returned ${response.status}`);
        return;
      }

      const structureData = await response.text();
      addLog(`✓ Structure data received: ${structureData.length} bytes`);
      addLog(`First 200 chars: ${structureData.substring(0, 200)}`);

      // Test 3: Create viewer
      if (!viewerRef.current) {
        addLog('ERROR: Viewer ref not available');
        return;
      }

      addLog('Creating viewer...');
      const viewer = $3Dmol.createViewer(viewerRef.current, {
        backgroundColor: 'white',
        antialias: true
      });
      addLog('✓ Viewer created');

      // Test 4: Add model
      const format = structureData.includes('data_') ? 'cif' : 'pdb';
      addLog(`Detected format: ${format}`);
      addLog('Adding model to viewer...');

      const model = viewer.addModel(structureData, format);
      addLog('✓ Model added');

      // Test 5: Check what was loaded
      const allAtoms = viewer.selectedAtoms({});
      addLog(`Total atoms loaded: ${allAtoms.length}`);

      if (allAtoms.length > 0) {
        // Get chain info
        const chains = new Set(allAtoms.map((a: any) => a.chain));
        addLog(`Chains in structure: ${Array.from(chains).join(', ')}`);

        // Check for chain F specifically
        const chainF = viewer.selectedAtoms({ chain: 'F' });
        addLog(`Atoms in chain F: ${chainF.length}`);

        setStructureInfo({
          totalAtoms: allAtoms.length,
          chains: Array.from(chains),
          chainFAtoms: chainF.length
        });
      } else {
        addLog('WARNING: No atoms were loaded from the structure');
      }

      // Test 6: Style and render
      addLog('Styling structure...');
      viewer.setStyle({}, { cartoon: { color: 'spectrum' } });

      addLog('Rendering...');
      viewer.zoomTo();
      viewer.render();
      addLog('✓ Render complete!');

    } catch (err) {
      addLog(`ERROR: ${err}`);
      console.error('Full error:', err);
    }
  };

  useEffect(() => {
    if (viewerRef.current) {
      testStructure();
    }
  }, []);

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">3Dmol.js Structure Viewer Test</h1>

      <div className="grid grid-cols-2 gap-6">
        {/* Viewer */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Viewer (8yl2_F)</h2>
          <div
            ref={viewerRef}
            className="border border-gray-300 rounded"
            style={{ width: '100%', height: '500px', position: 'relative' }}
          />

          {structureInfo && (
            <div className="mt-4 p-4 bg-gray-100 rounded">
              <h3 className="font-semibold mb-2">Structure Info</h3>
              <div className="text-sm space-y-1">
                <div>Total atoms: {structureInfo.totalAtoms}</div>
                <div>Chains: {structureInfo.chains.join(', ')}</div>
                <div>Chain F atoms: {structureInfo.chainFAtoms}</div>
              </div>
            </div>
          )}
        </div>

        {/* Logs */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Debug Log</h2>
          <div className="bg-black text-green-400 p-4 rounded font-mono text-xs h-[500px] overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className="mb-1">{log}</div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <button
          onClick={testStructure}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Reload Test
        </button>
      </div>
    </div>
  );
}
