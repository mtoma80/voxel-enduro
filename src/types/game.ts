export type ChassisId = 'formula' | 'muscle' | 'pickup' | 'buggy' | 'truck';

export type LiveryId = 'solid' | 'stripe' | 'checker' | 'blocks' | 'flames';

export type BiomeId = 'emerald' | 'desert' | 'tundra' | 'neon' | 'sakura';

export type WeatherMode = 'dynamic' | 'day' | 'night' | 'fog' | 'snow';

export type CurveIntensity = 'gentle' | 'classic' | 'winding';

export type HillIntensity = 'flat' | 'rolling' | 'mountain';

export type TrafficDensity = 'light' | 'arcade' | 'intense';

export type WeatherPhase =
  | 'morning'
  | 'sunset'
  | 'night'
  | 'fog'
  | 'snow'
  | 'dawn';

export type GameMode = 'garage' | 'racing' | 'paused' | 'day_clear' | 'gameover';

export type CameraMode = 'chase' | 'hood';

export interface VehicleConfig {
  name: string;
  chassis: ChassisId;
  primaryColor: string;
  secondaryColor: string;
  wheelColor: string;
  livery: LiveryId;
  spoiler: boolean;
  roofLights: boolean;
  twinExhaust: boolean;
  antenna: boolean;
}

export interface TrackConfig {
  name: string;
  biome: BiomeId;
  roadColor: string;
  curbColorA: string;
  curbColorB: string;
  weatherMode: WeatherMode;
  curves: CurveIntensity;
  hills: HillIntensity;
  traffic: TrafficDensity;
}

export interface HudTelemetry {
  speedKmh: number;
  maxSpeedKmh: number;
  day: number;
  passedInDay: number;
  targetInDay: number;
  dayProgress: number; // 0 to 1 (0 = morning, 1 = dawn end)
  phase: WeatherPhase;
  score: number;
  distanceKm: number;
  turbo: number; // 0 to 100
  isTurboActive: boolean;
  nearMissFlash: number; // timestamp or counter
  crashFlash: number;
  overtakeStreak: number;
}

export interface HighScoreEntry {
  id: string;
  score: number;
  day: number;
  distanceKm: number;
  vehicleName: string;
  biome: BiomeId;
  date: string;
}

export interface ColorSwatch {
  id: string;
  label: string;
  hex: string;
}

export const VIBRANT_SWATCHES: ColorSwatch[] = [
  { id: 'ruby', label: 'Rubi', hex: '#EF4444' },
  { id: 'diamond', label: 'Diamante', hex: '#06B6D4' },
  { id: 'emerald', label: 'Esmeralda', hex: '#22C55E' },
  { id: 'gold', label: 'Ouro', hex: '#FACC15' },
  { id: 'lava', label: 'Lava', hex: '#F97316' },
  { id: 'amethyst', label: 'Ametista', hex: '#A855F7' },
  { id: 'magenta', label: 'Rosa', hex: '#EC4899' },
  { id: 'cobalt', label: 'Lápis', hex: '#2563EB' },
  { id: 'snow', label: 'Neve', hex: '#F1F5F9' },
  { id: 'obsidian', label: 'Obsidiana', hex: '#1E293B' },
];

export const ROAD_SWATCHES: ColorSwatch[] = [
  { id: 'asphalt', label: 'Asfalto', hex: '#2B303A' },
  { id: 'basalt', label: 'Basalto', hex: '#374151' },
  { id: 'sandstone', label: 'Arenito', hex: '#A16207' },
  { id: 'ice', label: 'Gelo', hex: '#38BDF8' },
  { id: 'obsidian', label: 'Obsidiana', hex: '#111827' },
  { id: 'brick', label: 'Terracota', hex: '#7C2D12' },
];

export interface BiomeMeta {
  id: BiomeId;
  label: string;
  subtitle: string;
  groundColor: string;
  groundAccent: string;
  defaultRoad: string;
  defaultCurbA: string;
  defaultCurbB: string;
  skyDay: string;
  fogDay: string;
  mountainColor: string;
  propType: 'oak' | 'cactus' | 'pine' | 'crystal' | 'sakura';
}

export const BIOME_PRESETS: Record<BiomeId, BiomeMeta> = {
  emerald: {
    id: 'emerald',
    label: 'Planície Esmeralda',
    subtitle: 'Grama vibrante e carvalhos',
    groundColor: '#3BB143',
    groundAccent: '#2E8B57',
    defaultRoad: '#2B303A',
    defaultCurbA: '#EF4444',
    defaultCurbB: '#F8FAFC',
    skyDay: '#38BDF8',
    fogDay: '#7DD3FC',
    mountainColor: '#3B6E5C',
    propType: 'oak',
  },
  desert: {
    id: 'desert',
    label: 'Deserto Canyon',
    subtitle: 'Areia dourada, cactos e mesas',
    groundColor: '#EAB308',
    groundAccent: '#D97706',
    defaultRoad: '#44403C',
    defaultCurbA: '#F97316',
    defaultCurbB: '#FEF08A',
    skyDay: '#60A5FA',
    fogDay: '#FDE68A',
    mountainColor: '#C2410C',
    propType: 'cactus',
  },
  tundra: {
    id: 'tundra',
    label: 'Tundra Glacial',
    subtitle: 'Blocos de neve e pinheiros',
    groundColor: '#E2E8F0',
    groundAccent: '#93C5FD',
    defaultRoad: '#334155',
    defaultCurbA: '#06B6D4',
    defaultCurbB: '#FFFFFF',
    skyDay: '#7DD3FC',
    fogDay: '#E0F2FE',
    mountainColor: '#64748B',
    propType: 'pine',
  },
  neon: {
    id: 'neon',
    label: 'Circuito Prismarina',
    subtitle: 'Obsidiana e cristais luminosos',
    groundColor: '#1E1B4B',
    groundAccent: '#312E81',
    defaultRoad: '#111827',
    defaultCurbA: '#06B6D4',
    defaultCurbB: '#EC4899',
    skyDay: '#4C1D95',
    fogDay: '#7C3AED',
    mountainColor: '#3730A3',
    propType: 'crystal',
  },
  sakura: {
    id: 'sakura',
    label: 'Bosque Cerejeira',
    subtitle: 'Musgo vivo e pétalas rosa',
    groundColor: '#65A30D',
    groundAccent: '#4D7C0F',
    defaultRoad: '#3F3F46',
    defaultCurbA: '#EC4899',
    defaultCurbB: '#FDF2F8',
    skyDay: '#60A5FA',
    fogDay: '#FBCFE8',
    mountainColor: '#9D174D',
    propType: 'sakura',
  },
};

export const CHASSIS_LIST: { id: ChassisId; label: string; desc: string }[] = [
  { id: 'formula', label: 'Fórmula Voxel', desc: 'Ágil estilo Enduro' },
  { id: 'muscle', label: 'Muscle Block', desc: 'Esportivo robusto' },
  { id: 'pickup', label: 'Picape 4x4', desc: 'Suspensão elevada' },
  { id: 'buggy', label: 'Cyber Buggy', desc: 'Leve e radical' },
  { id: 'truck', label: 'Caminhão Turbo', desc: 'Peso pesado' },
];

export const LIVERY_LIST: { id: LiveryId; label: string }[] = [
  { id: 'stripe', label: 'Faixa Dupla' },
  { id: 'solid', label: 'Sólido' },
  { id: 'checker', label: 'Xadrez' },
  { id: 'blocks', label: 'Mosaico' },
  { id: 'flames', label: 'Chamas' },
];

export const PHASE_LABELS: Record<WeatherPhase, string> = {
  morning: 'Manhã Ensolarada',
  sunset: 'Pôr do Sol',
  night: 'Noite Estrelada',
  fog: 'Neblina Densa',
  snow: 'Tempestade Glacial',
  dawn: 'Alvorada Final',
};

export const DEFAULT_VEHICLE: VehicleConfig = {
  name: 'Enduro Rubi',
  chassis: 'formula',
  primaryColor: '#EF4444',
  secondaryColor: '#FACC15',
  wheelColor: '#1E293B',
  livery: 'stripe',
  spoiler: true,
  roofLights: false,
  twinExhaust: true,
  antenna: true,
};

export const DEFAULT_TRACK: TrackConfig = {
  name: 'Rota Esmeralda',
  biome: 'emerald',
  roadColor: BIOME_PRESETS.emerald.defaultRoad,
  curbColorA: BIOME_PRESETS.emerald.defaultCurbA,
  curbColorB: BIOME_PRESETS.emerald.defaultCurbB,
  weatherMode: 'dynamic',
  curves: 'classic',
  hills: 'rolling',
  traffic: 'arcade',
};
