'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface Domain {
  id: number;
  domain_number: number;
  start_pos: number;
  end_pos: number;
  assigned_t_group?: string;
}

interface StructureViewerProps {
  proteinId: string;
  domains: Domain[];
  width?: string;
  height?: string;
}

// Color palette for domains
const DOMAIN_COLORS = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#10B981', // green
  '#F59E0B', // amber
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
];

export default function StructureViewer({
  proteinId,
  domains,
  width = '100%',
  height = '500px'
}: StructureViewerProps) {
  const [viewerElement, setViewerElement] = useState<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<any>(null);

  // Callback ref - called when element is attached to DOM
  const viewerRef = useCallback((element: HTMLDivElement | null) => {
    console.log('[StructureViewer] Callback ref called with:', element);
    setViewerElement(element);
  }, []);

  useEffect(() => {
    if (!viewerElement) {
      console.log('[StructureViewer] No viewer element yet');
      return;
    }

    let $3Dmol: any;
    let isMounted = true;

    const loadAndRender = async () => {
      try {
        console.log(`[StructureViewer] Loading structure for ${proteinId}...`);
        console.log('[StructureViewer] Element ready:', viewerElement);

        // Import 3Dmol
        const module = await import('3dmol/build/3Dmol.js');
        $3Dmol = (module as any).default || module;
        console.log('[StructureViewer] 3Dmol.js loaded');

        if (!isMounted) return;

        // Fetch structure from API
        console.log(`[StructureViewer] Fetching from /api/structure/${proteinId}...`);
        const response = await fetch(`/api/structure/${proteinId}`);

        if (!response.ok) {
          console.error(`[StructureViewer] API error: ${response.status}`);
          if (isMounted) {
            if (response.status === 404) {
              setError('Structure file not available for this protein');
            } else {
              setError('Failed to load structure');
            }
            setLoading(false);
          }
          return;
        }

        console.log('[StructureViewer] Parsing structure data...');
        const structureData = await response.text();
        console.log(`[StructureViewer] Structure data size: ${structureData.length} bytes`);

        if (!isMounted || !viewerElement) return;

        // Initialize viewer
        console.log('[StructureViewer] Initializing viewer...');
        const config = { backgroundColor: 'white' };
        const viewerInstance = $3Dmol.createViewer(viewerElement, config);

        // Add structure
        const format = structureData.includes('data_') ? 'cif' : 'pdb';
        console.log(`[StructureViewer] Adding model (format: ${format})...`);
        viewerInstance.addModel(structureData, format);

        // Check if model was loaded
        const allAtoms = viewerInstance.selectedAtoms({});
        const numAtoms = allAtoms.length;
        console.log(`[StructureViewer] Model loaded with ${numAtoms} atoms`);

        if (numAtoms === 0) {
          throw new Error('No atoms loaded from structure file');
        }

        // Extract chain from proteinId (e.g., "8yl2_F" -> "F")
        const chainId = proteinId.split('_')[1];
        console.log(`[StructureViewer] Target chain: ${chainId}`);

        // Check what chains are present
        const chains = new Set(allAtoms.map((a: any) => a.chain));
        console.log(`[StructureViewer] Chains in structure: ${Array.from(chains).join(', ')}`);

        // Check if we have the target chain
        const chainAtoms = viewerInstance.selectedAtoms({ chain: chainId });
        console.log(`[StructureViewer] Atoms in target chain ${chainId}: ${chainAtoms.length}`);

        if (chainAtoms.length === 0) {
          console.warn(`[StructureViewer] Chain ${chainId} not found in structure!`);
        }

        // Style the structure - default gray for all residues
        console.log('[StructureViewer] Styling structure...');
        viewerInstance.setStyle({}, { cartoon: { color: '#CCCCCC' } });

        // Color each domain differently - ONLY on the target chain
        console.log(`[StructureViewer] Coloring ${domains.length} domains on chain ${chainId}...`);
        domains.forEach((domain, index) => {
          const color = DOMAIN_COLORS[index % DOMAIN_COLORS.length];
          // IMPORTANT: Include chain in selection to avoid coloring all chains
          // Using SEQRES numbering (start_pos/end_pos) - works if structure is renumbered
          const selection = {
            chain: chainId,
            resi: `${domain.start_pos}-${domain.end_pos}`
          };

          console.log(`  Domain ${domain.domain_number}: chain=${chainId} resi=${domain.start_pos}-${domain.end_pos} -> ${color}`);
          viewerInstance.setStyle(selection, {
            cartoon: {
              color: color,
              opacity: 0.9
            }
          });
        });

        // Render and zoom to fit
        console.log('[StructureViewer] Rendering...');
        viewerInstance.zoomTo();
        viewerInstance.render();
        console.log('[StructureViewer] Render complete!');

        setViewer(viewerInstance);
        setLoading(false);

      } catch (err) {
        console.error('[StructureViewer] Error:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load structure viewer');
          setLoading(false);
        }
      }
    };

    loadAndRender();

    return () => {
      isMounted = false;
    };
  }, [proteinId, domains, viewerElement]);

  return (
    <div className="relative">
      {/* Always render the viewer div so the ref gets attached */}
      <div
        ref={viewerRef}
        style={{ width, height, position: 'relative' }}
        className="rounded border border-gray-200"
      />

      {/* Overlay loading state */}
      {loading && (
        <div
          style={{ width, height }}
          className="absolute top-0 left-0 bg-gray-100 rounded flex items-center justify-center"
        >
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <div className="text-gray-600">Loading structure...</div>
          </div>
        </div>
      )}

      {/* Overlay error state */}
      {error && (
        <div
          style={{ width, height }}
          className="absolute top-0 left-0 bg-gray-100 rounded flex items-center justify-center"
        >
          <div className="text-center text-gray-600">
            <div className="text-4xl mb-3">🧬</div>
            <div className="font-medium">{error}</div>
            <div className="text-sm mt-2">Structure visualization unavailable</div>
          </div>
        </div>
      )}

      {/* Domain Legend */}
      {domains.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3">
          {domains.map((domain, index) => (
            <div key={domain.id} className="flex items-center gap-2 text-sm">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: DOMAIN_COLORS[index % DOMAIN_COLORS.length] }}
              />
              <span className="font-medium">
                Domain {domain.domain_number}
              </span>
              <span className="text-gray-500">
                ({domain.start_pos}-{domain.end_pos})
              </span>
              {domain.assigned_t_group && (
                <span className="text-gray-400 text-xs">
                  {domain.assigned_t_group}
                </span>
              )}
            </div>
          ))}
          {domains.length === 0 && (
            <div className="text-sm text-gray-500">
              <span className="inline-block w-4 h-4 rounded mr-2" style={{ backgroundColor: '#CCCCCC' }} />
              No domains (shown in gray)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
