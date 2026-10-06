export type MapViewMode = 'explore' | 'driving' | 'transit' | 'satellite';

export interface MapViewSettings {
  mode: MapViewMode;
  traffic: boolean;
  labels: boolean;
}

export interface MapModeOption {
  id: MapViewMode;
  label: string;
  description: string;
  previewClass: string;
}

export const MAP_MODE_OPTIONS: MapModeOption[] = [
  {
    id: 'explore',
    label: 'Explorer',
    description: 'Plan détaillé',
    previewClass: 'preview-explore',
  },
  {
    id: 'driving',
    label: 'Conduite',
    description: 'Routes mises en avant',
    previewClass: 'preview-driving',
  },
  {
    id: 'transit',
    label: 'Transports',
    description: 'Lignes et axes',
    previewClass: 'preview-transit',
  },
  {
    id: 'satellite',
    label: 'Satellite',
    description: 'Vue aérienne',
    previewClass: 'preview-satellite',
  },
];
