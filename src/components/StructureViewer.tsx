'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface Domain {
  id: number;
  domain_number: number;
  start_pos: number;
  end_pos: number;
  assigned_t_group?: string;
}

interface EditedBoundary {
  start: number;
  end: number;
}

interface StructureViewerProps {
  proteinId: string;
  domains: Domain[];
  editedBoundaries?: { [key: number]: EditedBoundary };
  breakpoints?: number[];
  isCollectingBreakpoints?: boolean;
  onBreakpointClick?: (position: number) => void;
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
  editedBoundaries = {},
  breakpoints = [],
  isCollectingBreakpoints = false,
  onBreakpointClick,
  width = '100%',
  height = '500px'
}: StructureViewerProps) {
  const [viewerElement, setViewerElement] = useState<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<any>(null);
  const [residueMappings, setResidueMappings] = useState<Map<number, number>>(new Map());
  const [hasMappings, setHasMappings] = useState(false);

  // Use refs to track current state for callbacks
  const isCollectingRef = useRef(isCollectingBreakpoints);
  const onBreakpointClickRef = useRef(onBreakpointClick);

  // Update refs when props change
  useEffect(() => {
    isCollectingRef.current = isCollectingBreakpoints;
    onBreakpointClickRef.current = onBreakpointClick;
  }, [isCollectingBreakpoints, onBreakpointClick]);

  // Callback ref - called when element is attached to DOM
  const viewerRef = useCallback((element: HTMLDivElement | null) => {
    console.log('[StructureViewer] Callback ref called with:', element);
    setViewerElement(element);
  }, []);

  // Fetch residue mappings (SEQID → PDB numbering)
  useEffect(() => {
    async function fetchMappings() {
      try {
        console.log(`[StructureViewer] Fetching residue mappings for ${proteinId}...`);
        const response = await fetch(`/api/protein/${proteinId}/residue-mapping`);

        if (!response.ok) {
          console.log('[StructureViewer] No residue mappings available (will use SEQID numbering)');
          setHasMappings(false);
          return;
        }

        const data = await response.json();

        if (data.has_mappings && data.mapping_map) {
          const map = new Map<number, number>();
          Object.entries(data.mapping_map).forEach(([seqid, pdbPos]) => {
            map.set(Number(seqid), Number(pdbPos));
          });
          setResidueMappings(map);
          setHasMappings(true);
          console.log(`[StructureViewer] Loaded ${map.size} residue mappings`);
        } else {
          console.log('[StructureViewer] No mappings in response');
          setHasMappings(false);
        }
      } catch (err) {
        console.warn('[StructureViewer] Error fetching residue mappings:', err);
        setHasMappings(false);
      }
    }

    fetchMappings();
  }, [proteinId]);

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
        // @ts-ignore - 3dmol types not available
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

        // Extract chain from proteinId (e.g., "8yl2_F" -> "F", "8ckb_B001" -> "B001")
        const originalChainId = proteinId.split('_')[1];

        // Check what chains are present
        const chains = new Set(allAtoms.map((a: any) => a.chain));
        console.log(`[StructureViewer] Chains in structure: ${Array.from(chains).join(', ')}`);

        // Determine which chain ID to use:
        // - If original chain exists in structure, use it (full CIF files)
        // - Otherwise use "A" (chain-specific PDB files where chain is renamed)
        let chainId = originalChainId;
        if (!chains.has(originalChainId) && chains.has('A')) {
          chainId = 'A';
          console.log(`[StructureViewer] Chain ${originalChainId} not found, using 'A' instead (chain-specific file)`);
        } else {
          console.log(`[StructureViewer] Using chain ${chainId}`);
        }

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
        console.log(`[StructureViewer] Has residue mappings: ${hasMappings}`);

        domains.forEach((domain, index) => {
          const color = DOMAIN_COLORS[index % DOMAIN_COLORS.length];

          // Use edited boundaries if available, otherwise use domain boundaries
          const seqidStart = editedBoundaries[domain.id]?.start ?? domain.start_pos;
          const seqidEnd = editedBoundaries[domain.id]?.end ?? domain.end_pos;
          const isEdited = editedBoundaries[domain.id] !== undefined;

          // Convert SEQID positions to PDB positions if mappings available
          let startPos = seqidStart;
          let endPos = seqidEnd;

          if (hasMappings && residueMappings.size > 0) {
            // Convert start position
            const mappedStart = residueMappings.get(seqidStart);
            if (mappedStart !== undefined) {
              startPos = mappedStart;
            } else {
              console.warn(`  No mapping for start position ${seqidStart}, using SEQID`);
            }

            // Convert end position
            const mappedEnd = residueMappings.get(seqidEnd);
            if (mappedEnd !== undefined) {
              endPos = mappedEnd;
            } else {
              console.warn(`  No mapping for end position ${seqidEnd}, using SEQID`);
            }

            console.log(`  Domain ${domain.domain_number}${isEdited ? ' (EDITED)' : ''}: SEQID ${seqidStart}-${seqidEnd} → PDB ${startPos}-${endPos}`);
          } else {
            console.log(`  Domain ${domain.domain_number}${isEdited ? ' (EDITED)' : ''}: Using SEQID ${seqidStart}-${seqidEnd} (no mappings)`);
          }

          const selection = {
            chain: chainId,
            resi: `${startPos}-${endPos}`
          };

          viewerInstance.setStyle(selection, {
            cartoon: {
              color: color,
              opacity: 0.9
            }
          });
        });

        // Add hover labels to show residue information
        console.log('[StructureViewer] Adding hover labels...');
        viewerInstance.setHoverable({}, true,
          (atom: any) => {
            // Hover callback
            if (!atom) return '';
            // Show: residue name, chain, and residue number
            return `${atom.resn} ${atom.chain}:${atom.resi}`;
          },
          () => {
            // Unhover callback - called when hover ends
            // Return empty string or nothing to clear the label
          }
        );

        // Add click handler for breakpoint collection on target chain only
        console.log('[StructureViewer] Adding click handler...');
        const clickSelection = { chain: chainId };
        viewerInstance.setClickable(clickSelection, true, (atom: any) => {
          console.log(`[StructureViewer] Clicked atom:`, atom);
          if (!atom) {
            console.log('[StructureViewer] No atom clicked');
            return;
          }

          console.log(`[StructureViewer] Clicked ${atom.resn} ${atom.chain}:${atom.resi}, collecting=${isCollectingRef.current}`);

          // Only handle clicks when in breakpoint collection mode
          // Use refs to get current state values
          if (isCollectingRef.current && onBreakpointClickRef.current) {
            const position = atom.resi;
            console.log(`[StructureViewer] Reporting breakpoint at position ${position}`);
            onBreakpointClickRef.current(position);
          } else {
            console.log('[StructureViewer] Not in collection mode or no handler');
          }
        });

        // Add breakpoint markers
        if (breakpoints.length > 0) {
          console.log(`[StructureViewer] Adding ${breakpoints.length} breakpoint markers...`);
          breakpoints.forEach((seqidPos) => {
            // Convert SEQID to PDB position if mappings available
            let pdbPos = seqidPos;
            if (hasMappings && residueMappings.size > 0) {
              const mapped = residueMappings.get(seqidPos);
              if (mapped !== undefined) {
                pdbPos = mapped;
                console.log(`  Breakpoint at SEQID ${seqidPos} → PDB ${pdbPos}`);
              } else {
                console.warn(`  No mapping for breakpoint ${seqidPos}, using SEQID`);
              }
            }

            // Add sphere at C-alpha position
            const selection = { chain: chainId, resi: pdbPos, atom: 'CA' };
            viewerInstance.addSphere({
              center: selection,
              radius: 2.0,
              color: 'red',
              alpha: 0.8
            });

            // Add label
            viewerInstance.addLabel(`${seqidPos}`, {
              position: selection,
              backgroundColor: 'red',
              fontColor: 'white',
              fontSize: 10,
              backgroundOpacity: 0.8
            });
          });
        }

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
  }, [proteinId, domains, viewerElement, hasMappings, residueMappings, editedBoundaries, breakpoints]);

  return (
    <div className="relative">
      {/* Always render the viewer div so the ref gets attached */}
      <div
        ref={viewerRef}
        style={{ width, height, position: 'relative' }}
        className="rounded border border-gray-200"
        title="Hover over residues to see chain:position"
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

      {/* Domain Legend and Controls */}
      <div className="mt-3 space-y-2">
        {/* Hover hint */}
        <div className="text-xs text-gray-500 italic">
          💡 Hover over residues to see chain:position
        </div>

        {/* Domain legend */}
        {domains.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {domains.map((domain, index) => {
              const isEdited = editedBoundaries[domain.id] !== undefined;
              const displayStart = editedBoundaries[domain.id]?.start ?? domain.start_pos;
              const displayEnd = editedBoundaries[domain.id]?.end ?? domain.end_pos;

              return (
                <div key={domain.id} className="flex items-center gap-2 text-sm">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: DOMAIN_COLORS[index % DOMAIN_COLORS.length] }}
                  />
                  <span className="font-medium">
                    Domain {domain.domain_number}
                  </span>
                  <span className={isEdited ? "text-blue-600 font-semibold" : "text-gray-500"}>
                    ({displayStart}-{displayEnd})
                    {isEdited && ' ✎'}
                  </span>
                  {domain.assigned_t_group && (
                    <span className="text-gray-400 text-xs">
                      {domain.assigned_t_group}
                    </span>
                  )}
                </div>
              );
            })}
            {domains.length === 0 && (
              <div className="text-sm text-gray-500">
                <span className="inline-block w-4 h-4 rounded mr-2" style={{ backgroundColor: '#CCCCCC' }} />
                No domains (shown in gray)
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
