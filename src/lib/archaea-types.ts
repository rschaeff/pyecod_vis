/**
 * TypeScript types for Archaea visualization module
 * Based on archaea schema
 */

// ============================================
// Core Entity Types
// ============================================

export interface ArchaeaProtein {
  protein_id: string;
  uniprot_acc: string | null;
  uniparc_id: string | null;
  sequence_length: number;
  source: 'AFDB' | 'Prodigal' | 'UniParc' | string;
  cif_file: string | null;
  pae_file: string | null;
  has_structure: boolean;
  has_pae: boolean;
  sequence?: string;
}

export interface ArchaeaTaxonomy {
  class_name: string;
  phylum: string;
  major_group: string | null;
  organism_name: string | null;
  genome_accession: string | null;
}

export interface StructureQuality {
  protein_id: string;
  mean_plddt: number | null;
  ptm: number | null;
  quality_score: number | null;
  af3_quality_category: 'high_quality' | 'medium_quality' | 'low_quality' | string | null;
  fraction_disordered: number | null;
  helix_fraction: number | null;
  sheet_fraction: number | null;
  coil_fraction: number | null;
  ss_category: 'alpha' | 'beta' | 'alpha_beta' | 'coil' | string | null;
  rg: number | null;
  rg_expected: number | null;
  rg_ratio: number | null;
  rg_category: 'compact' | 'normal' | 'extended' | string | null;
}

// ============================================
// Curation Types
// ============================================

export type NoveltyCategory = 'dark' | 'sequence-orphan' | 'divergent' | 'known';

export type PriorityCategory =
  | 'priority_1_dark_singleton'
  | 'priority_2_dark_unified'
  | 'priority_3_orphan'
  | 'priority_4_divergent'
  | 'priority_medium_dark'
  | 'priority_medium_orphan'
  | 'validation_known'
  | 'low_priority_dark'
  | 'low_priority_orphan'
  | 'low_priority_divergent'
  | 'low_priority_known'
  | 'low_quality_dark'
  | 'low_quality_orphan'
  | 'skip_disordered'
  | 'unclassified';

export type CurationStatus =
  | 'pending'
  | 'in_review'
  | 'classified'
  | 'deferred'
  | 'rejected'
  | 'needs_reanalysis';

export interface CurationCandidate {
  id: number;
  protein_id: string;
  novelty_category: NoveltyCategory;
  priority_category: PriorityCategory | string;
  priority_rank: number | null;
  curation_status: CurationStatus;
  structural_cluster_id: number | null;
  structural_cluster_rep: string | null;
  structural_cluster_size: number | null;
  unified_by_structure: boolean | null;
  ecod_x_group: number | null;
  ecod_h_group: number | null;
  ecod_t_group: number | null;
  ecod_f_group: number | null;
  is_novel_fold: boolean | null;
  is_novel_topology: boolean | null;
  curator_notes: string | null;
  assigned_curator: string | null;
}

// ============================================
// Queue Types (from v_curation_queue_full)
// ============================================

export interface CurationQueueItem {
  id: number;
  protein_id: string;
  novelty_category: NoveltyCategory;
  priority_category: string;
  priority_rank: number | null;
  curation_status: CurationStatus;
  structural_cluster_id: number | null;
  structural_cluster_rep: string | null;
  structural_cluster_size: number | null;
  unified_by_structure: boolean | null;
  is_novel_fold: boolean | null;
  ecod_x_group: number | null;
  assigned_curator: string | null;
  // From target_proteins
  uniprot_acc: string | null;
  sequence_length: number;
  source: string;
  cif_file: string | null;
  has_structure: boolean;
  // From structure_quality_metrics
  mean_plddt: number | null;
  ptm: number | null;
  quality_score: number | null;
  af3_quality_category: string | null;
  ss_category: string | null;
  rg_category: string | null;
  fraction_disordered: number | null;
  // From target_classes
  taxonomy_class: string | null;
  phylum: string | null;
  major_group: string | null;
}

// ============================================
// Protein Detail (from v_protein_detail)
// ============================================

export interface ArchaeaProteinDetail {
  // From target_proteins
  protein_table_id: number;
  protein_id: string;
  uniprot_acc: string | null;
  uniparc_id: string | null;
  sequence_length: number;
  source: string;
  cif_file: string | null;
  pae_file: string | null;
  has_structure: boolean;
  has_pae: boolean;
  // From protein_sequences
  sequence: string | null;
  // From target_classes
  class_name: string | null;
  phylum: string | null;
  major_group: string | null;
  organism_name: string | null;
  genome_accession: string | null;
  // From structure_quality_metrics
  mean_plddt: number | null;
  ptm: number | null;
  quality_score: number | null;
  af3_quality_category: string | null;
  fraction_disordered: number | null;
  helix_fraction: number | null;
  sheet_fraction: number | null;
  coil_fraction: number | null;
  ss_category: string | null;
  rg: number | null;
  rg_expected: number | null;
  rg_ratio: number | null;
  rg_category: string | null;
  // From curation_candidates
  novelty_category: NoveltyCategory | null;
  priority_category: string | null;
  priority_rank: number | null;
  curation_status: CurationStatus | null;
  structural_cluster_id: number | null;
  structural_cluster_rep: string | null;
  structural_cluster_size: number | null;
  is_novel_fold: boolean | null;
  is_novel_topology: boolean | null;
  ecod_x_group: number | null;
  ecod_h_group: number | null;
  ecod_t_group: number | null;
  ecod_f_group: number | null;
  curator_notes: string | null;
  // From structural_clusters
  actual_cluster_size: number | null;
  is_representative: boolean | null;
}

// ============================================
// Cluster Types
// ============================================

export interface ArchaeaCluster {
  cluster_id: number;
  cluster_rep_id: string;
  cluster_size: number;
  clustering_method: string;
  tm_threshold: number;
  member_count: number;
  avg_plddt: number | null;
  avg_quality_score: number | null;
  dark_count: number;
  pending_count: number;
}

export interface ClusterMember {
  protein_id: string;
  uniprot_acc: string | null;
  sequence_length: number;
  is_representative: boolean;
  mean_plddt: number | null;
  quality_score: number | null;
  novelty_category: string | null;
  curation_status: string | null;
}

// ============================================
// Statistics Types
// ============================================

export interface ArchaeaStats {
  total_proteins: number;
  with_structure: number;
  with_quality_metrics: number;
  total_clusters: number;
  curation_candidates: number;
  status_breakdown: {
    pending: number;
    in_review: number;
    classified: number;
    deferred: number;
    rejected: number;
    needs_reanalysis: number;
  };
  novelty_breakdown: {
    dark: number;
    'sequence-orphan': number;
    divergent: number;
    known: number;
  };
  priority_breakdown: Record<string, number>;
  source_breakdown: Record<string, number>;
}

export interface CurationProgress {
  novelty_category: string;
  priority_category: string;
  curation_status: string;
  count: number;
  novel_fold_count: number;
}

// ============================================
// Curation Decision Types
// ============================================

export type DecisionType = 'approve' | 'flag_novel' | 'defer' | 'reject' | 'skip' | 'classify';

export interface ArchaeaCurationDecision {
  protein_id: string;
  curator: string;
  decision_type: DecisionType;
  ecod_x_group?: number;
  ecod_h_group?: number;
  ecod_t_group?: number;
  ecod_f_group?: number;
  is_novel_fold?: boolean;
  is_novel_topology?: boolean;
  confidence_level?: number; // 1-5
  notes?: string;
}

export interface CurationResponse {
  success: boolean;
  protein_id: string;
  new_status: string;
  next_protein?: string;
  error?: string;
}

// ============================================
// API Response Types
// ============================================

export interface QueueResponse {
  items: CurationQueueItem[];
  total: number;
  limit: number;
  offset: number;
  filters: {
    novelty?: string;
    priority?: string;
    status?: string;
    has_structure?: boolean;
  };
}

export interface ProteinDetailResponse {
  protein: ArchaeaProteinDetail;
  cluster_members?: ClusterMember[];
}

export interface ClusterResponse {
  cluster: ArchaeaCluster;
  members: ClusterMember[];
}
