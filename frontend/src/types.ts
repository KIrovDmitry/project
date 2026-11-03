export interface NetworkCharacteristics {
  avg_link_length: number | null;
  avg_degree: number | null;
  avg_path_length: number | null;
  diameter: number | null;
  clustering_coef: number | null;
  straightness: number | null;
  closeness: number | null;
  efficiency: number | null;
  info_significance: number | null;
  connected_components: number | null;
}

export interface Network {
  id: number;
  name: string;
  N: number;
  C: number;
  alpha: number;
  lambda: number;
  space_type: string;
  distribution_type: string;
  nodes_count: number;
  links_count: number;
  created_at: string;
  characteristics: NetworkCharacteristics;
  model_type?: string;
  er_p?: number;
  ba_m?: number;
  m_phys?: number | null;
  m_max?: number | null;
  l_total?: number | null;
}

export interface ExperimentRunResult {
  lambda: number;
  space_type: string;
  distribution_type: string;
  model_type?: string;
  m_phys_list: number[];
  m_max_list: number[];
  m_phys_avg: number;
  m_max_avg: number;
  m_vs_length_edges: number[];
  m_vs_length_values: number[];
}

export interface Experiment {
  id: number;
  name: string;
  N: number;
  lambdas: number[];
  spaces: string[];
  distributions: string[];
  repetitions: number;
  results: ExperimentRunResult[];
  created_at: string;
}

export interface ComparisonProfile {
  id: string;
  name: string;
  color: string;
  enabled: boolean;
  selection_type: 'formula' | 'manual';
  space_type: 'all' | 'cube' | 'sphere';
  distribution_type: 'all' | 'random' | 'gaussian' | 'grid' | 'fractal_tetrahedron' | 'fractal_tetrahedron_cropped' | 'fractal_octahedron' | 'fractal_octahedron_cropped' | 'fractal_menger' | 'fractal_cube';
  lambdaVal: 'all' | number;
  alphaVal: 'all' | number;
  model_type: 'all' | 'lpn' | 'er' | 'ba';
  er_pVal: 'all' | number;
  ba_mVal: 'all' | number;
  selectedNetworkIds: number[];
}

export const matchNetworkWithProfile = (net: Network, prof: ComparisonProfile): boolean => {
  if (prof.selection_type === 'manual') {
    return prof.selectedNetworkIds.includes(net.id);
  }

  if (prof.space_type !== 'all' && net.space_type !== prof.space_type) return false;
  if (prof.distribution_type !== 'all' && net.distribution_type !== prof.distribution_type) return false;

  const netModel = net.model_type || 'lpn';
  const profModel = prof.model_type || 'all';
  if (profModel !== 'all' && netModel !== profModel) return false;

  if (prof.lambdaVal !== 'all') {
    const l1 = net.lambda ? parseFloat(net.lambda.toFixed(5)) : 0;
    const l2 = typeof prof.lambdaVal === 'string' ? parseFloat(prof.lambdaVal) : prof.lambdaVal;
    if (Math.abs(l1 - l2) > 1e-5) return false;
  }

  if (prof.alphaVal !== 'all') {
    const a1 = net.alpha ? parseFloat(net.alpha.toFixed(5)) : 0;
    const a2 = typeof prof.alphaVal === 'string' ? parseFloat(prof.alphaVal) : prof.alphaVal;
    if (Math.abs(a1 - a2) > 1e-5) return false;
  }

  if (prof.er_pVal && prof.er_pVal !== 'all') {
    const p1 = net.er_p ?? 0;
    const p2 = typeof prof.er_pVal === 'string' ? parseFloat(prof.er_pVal) : prof.er_pVal;
    if (Math.abs(p1 - p2) > 1e-5) return false;
  }

  if (prof.ba_mVal && prof.ba_mVal !== 'all') {
    const m1 = net.ba_m ?? 0;
    const m2 = typeof prof.ba_mVal === 'string' ? parseInt(prof.ba_mVal) : prof.ba_mVal;
    if (m1 !== m2) return false;
  }

  return true;
};
