/**
 * TypeScript types for ECOD curation data models
 * Based on ecod_curation schema
 */

export interface Protein {
  id: number;
  source_id: string;
  pdb_id: string;
  chain_id: string;
  sequence: string;
  sequence_length: number;
  partition_coverage: number;
  domain_count: number;
  partition_quality: string;
  curation_status: 'pending' | 'curated' | 'rejected' | 'needs_review';
  curation_source?: 'manual' | 'propagated' | 'automated';
  release_date: string;
  processed_at: string;
  cluster_size?: number;
  cluster_members?: string[];
}

export interface Domain {
  id: number;
  protein_id: number;
  domain_number: number;
  start_pos: number;
  end_pos: number;
  residue_range: string;
  automated_start_pos?: number;
  automated_end_pos?: number;
  automated_range_string?: string;
  assigned_t_group: string;
  assigned_h_group?: string;
  assigned_x_group?: string;
  assigned_f_group?: string;
  best_match_ecod_uid?: number;
  assignment_method: string;
  classification_level: string;
  confidence: number;
  curator_decision?: 'pending' | 'accepted' | 'modified' | 'rejected' | 'needs_expert';
  curator_name?: string;
  curated_at?: string;
  evidence: Evidence[];
}

export interface Evidence {
  id: number;
  domain_id: number;
  evidence_type: 'blast' | 'hhsearch';
  hit_ecod_domain_id?: string;
  hit_ecod_uid?: number;
  hit_pdb_id?: string;
  hit_chain_id?: string;
  evalue: number;
  score?: number;
  identity?: number;
  similarity?: number;
  query_coverage?: number;
  hit_coverage?: number;
  query_range?: string;
  hit_range?: string;
  ref_t_group?: string;
  ref_h_group?: string;
  ref_x_group?: string;
  ref_f_group?: string;
  source_file?: string;
}

export interface QueueItem {
  protein_id: number;
  source_id: string;
  domain_count: number;
  partition_coverage: number;
  cluster_size: number;
  priority: number;
  priority_reason?: string;
  has_gap: boolean;
  uncovered_residues: number;
  cluster_name?: string;
}

// Queue protein from /api/queue/all (with clustering support)
export interface QueueProtein {
  source_id: string;
  sequence_length: number;
  domain_count: number;
  partition_coverage: number;
  partition_quality: string;
  curation_status: string;
  pdb_release_date?: string;
  experimental_method?: string;
  resolution_angstrom?: number;
  priority_score?: number;
  is_representative?: boolean;
  cluster_size?: number;
}

export interface CurationDecision {
  protein_id: number;
  curator: string;
  decision: 'approved' | 'rejected' | 'needs_review';
  domains: DomainDecision[];
  notes?: string;
  breakpoints?: number[];
}

export interface DomainDecision {
  domain_id: number;
  start_pos: number;
  end_pos: number;
  curator_decision: 'pending' | 'accepted' | 'modified' | 'rejected' | 'needs_expert';
}

export interface CurationResponse {
  success: boolean;
  protein_id: number;
  next_protein?: string;
  propagated_to?: string[]; // Phase 2
  error?: string;
}

export interface ClusterMember {
  source_id: string;
  pdb_id: string;
  chain_id: string;
  sequence_length?: number;
  curation_status?: string;
  is_representative: boolean;
  sequence_identity_to_rep?: number;
}

export interface ClusterInfo {
  cluster_id: number | null;
  representative: string;
  cluster_size: number;
  members: ClusterMember[];
}
