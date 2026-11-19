import React, { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Map as MapIcon,
  Play,
  Share2,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  BIOME_PRESETS,
  BiomeId,
  CurveIntensity,
  HighScoreEntry,
  HillIntensity,
  ROAD_SWATCHES,
  TrafficDensity,
  TrackConfig,
  VIBRANT_SWATCHES,
  WeatherMode,
} from '../types/game';

interface CustomizeDockProps {
  track: TrackConfig;
  highScores: HighScoreEntry[];
  muted: boolean;
  shareCopied: boolean;
  onChangeTrack: (next: TrackConfig) => void;
  onStartRace: () => void;
  onToggleMute: () => void;
  onShare: () => void;
  onPlayClick: () => void;
}

type DockTab = 'track' | 'records';

export const CustomizeDock: React.FC<CustomizeDockProps> = ({
  track,
  highScores,
  muted,
  shareCopied,
  onChangeTrack,
  onStartRace,
  onToggleMute,
  onShare,
  onPlayClick,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<DockTab>('track');

  const selectBiome = (biomeId: BiomeId) => {
    onPlayClick();
    const preset = BIOME_PRESETS[biomeId];
    onChangeTrack({
      ...track,
      biome: biomeId,
      name: preset.label,
      roadColor: preset.defaultRoad,
      curbColorA: preset.defaultCurbA,
      curbColorB: preset.defaultCurbB,
    });
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between">
      {/* Top Bar */}
      <header className="pointer-events-auto flex items-start justify-between gap-4 px-5 py-3 bg-slate-950/90 border-b border-white/10">
        <div className="flex items-baseline gap-3 min-w-0 pt-1">
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white whitespace-nowrap shrink-0">
            Voxel Enduro
          </h1>
          <span className="hidden sm:inline text-xs text-slate-400 whitespace-nowrap truncate">
            Clássico Arcade em Voxels
          </span>
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="text-[11px] font-medium text-slate-300 tracking-wide whitespace-nowrap">
            Criado por Marcelo Toma
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onPlayClick();
                onShare();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-medium border border-white/10 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Compartilhar jogo com amigos"
            >
              {shareCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Link copiado!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Compartilhar</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Ativar som' : 'Silenciar som'}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 transition-colors shrink-0 cursor-pointer"
            >
              {muted ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                onPlayClick();
                onStartRace();
              }}
              className="inline-flex items-center gap-2 px-5 py-1.5 min-h-[38px] rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-display font-bold text-sm tracking-wide shadow-lg transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>Correr Agora</span>
            </button>
          </div>
        </div>
      </header>

      {/* Bottom Collapsible Track Customization Dock */}
      <div className="flex flex-col items-center px-3 pb-3 sm:pb-4">
        <button
          type="button"
          onClick={() => {
            onPlayClick();
            setCollapsed((prev) => !prev);
          }}
          className="pointer-events-auto inline-flex items-center gap-1.5 px-4 py-1.5 rounded-t-xl bg-slate-950/92 border border-b-0 border-white/15 text-xs font-medium text-slate-200 hover:text-white transition-colors cursor-pointer"
        >
          {collapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-cyan-400" />
              <span>Personalizar Pista</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
              <span>Ocultar Painel</span>
            </>
          )}
        </button>

        {!collapsed && (
          <section
            aria-label="Personalização de Pista"
            className="pointer-events-auto w-full max-w-[920px] rounded-xl bg-slate-950/92 border border-white/15 shadow-2xl overflow-hidden"
          >
            {/* Dock Tabs */}
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-white/10 bg-slate-900/70">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onPlayClick();
                    setActiveTab('track');
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === 'track'
                      ? 'bg-cyan-400 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <MapIcon className="w-3.5 h-3.5" />
                  <span>Pista e Bioma</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onPlayClick();
                    setActiveTab('records');
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === 'records'
                      ? 'bg-emerald-400 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Recordes</span>
                </button>
              </div>

              <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 whitespace-nowrap">
                <span>{BIOME_PRESETS[track.biome].label}</span>
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-4 max-h-[245px] sm:max-h-[230px] overflow-y-auto voxel-scroll">
              {activeTab === 'track' && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  {/* Biomes & Colors */}
                  <div className="md:col-span-6 space-y-3">
                    <div>
                      <span className="block text-xs font-medium text-slate-300 mb-1.5">
                        Bioma da Pista
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {(Object.keys(BIOME_PRESETS) as BiomeId[]).map((bId) => {
                          const b = BIOME_PRESETS[bId];
                          const active = track.biome === bId;
                          return (
                            <button
                              key={bId}
                              type="button"
                              onClick={() => selectBiome(bId)}
                              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                                active
                                  ? 'bg-cyan-500/20 border-cyan-400 text-white'
                                  : 'bg-slate-900/80 border-white/10 text-slate-300 hover:border-white/25'
                              }`}
                            >
                              <span
                                className="w-3.5 h-3.5 rounded-sm shrink-0 border border-white/30"
                                style={{ backgroundColor: b.groundColor }}
                              />
                              <span className="text-xs font-semibold truncate">
                                {b.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="block text-xs font-medium text-slate-300 mb-1.5">
                          Cor da Estrada
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {ROAD_SWATCHES.map((sw) => (
                            <button
                              key={`rd-${sw.id}`}
                              type="button"
                              title={sw.label}
                              onClick={() => {
                                onPlayClick();
                                onChangeTrack({ ...track, roadColor: sw.hex });
                              }}
                              className={`w-6 h-6 rounded-md border-2 transition-transform cursor-pointer ${
                                track.roadColor === sw.hex
                                  ? 'border-white scale-110'
                                  : 'border-white/20 hover:scale-105'
                              }`}
                              style={{ backgroundColor: sw.hex }}
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="block text-xs font-medium text-slate-300 mb-1.5">
                          Zebras da Pista
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {VIBRANT_SWATCHES.slice(0, 6).map((sw) => (
                            <button
                              key={`cb-${sw.id}`}
                              type="button"
                              title={sw.label}
                              onClick={() => {
                                onPlayClick();
                                onChangeTrack({
                                  ...track,
                                  curbColorA: sw.hex,
                                });
                              }}
                              className={`w-6 h-6 rounded-md border-2 transition-transform cursor-pointer ${
                                track.curbColorA === sw.hex
                                  ? 'border-white scale-110'
                                  : 'border-white/20 hover:scale-105'
                              }`}
                              style={{ backgroundColor: sw.hex }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Geometry & Weather Controls */}
                  <div className="md:col-span-6 space-y-2.5">
                    <div>
                      <span className="block text-xs font-medium text-slate-300 mb-1">
                        Ciclo e Clima
                      </span>
                      <div className="grid grid-cols-5 gap-1">
                        {(
                          [
                            { id: 'dynamic', label: 'Enduro' },
                            { id: 'day', label: 'Dia' },
                            { id: 'night', label: 'Noite' },
                            { id: 'fog', label: 'Neblina' },
                            { id: 'snow', label: 'Neve' },
                          ] as { id: WeatherMode; label: string }[]
                        ).map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => {
                              onPlayClick();
                              onChangeTrack({ ...track, weatherMode: w.id });
                            }}
                            className={`px-2 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                              track.weatherMode === w.id
                                ? 'bg-white text-slate-950 border-white'
                                : 'bg-slate-900 text-slate-300 border-white/10 hover:border-white/30'
                            }`}
                          >
                            {w.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="block text-xs font-medium text-slate-300 mb-1">
                          Curvas
                        </span>
                        <div className="flex flex-col gap-1">
                          {(
                            [
                              { id: 'gentle', label: 'Suaves' },
                              { id: 'classic', label: 'Clássico' },
                              { id: 'winding', label: 'Sinuosa' },
                            ] as { id: CurveIntensity; label: string }[]
                          ).map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                onPlayClick();
                                onChangeTrack({ ...track, curves: c.id });
                              }}
                              className={`px-2 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                                track.curves === c.id
                                  ? 'bg-cyan-400 text-slate-950 border-cyan-400'
                                  : 'bg-slate-900 text-slate-300 border-white/10'
                              }`}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="block text-xs font-medium text-slate-300 mb-1">
                          Relevo
                        </span>
                        <div className="flex flex-col gap-1">
                          {(
                            [
                              { id: 'flat', label: 'Plano' },
                              { id: 'rolling', label: 'Colinas' },
                              { id: 'mountain', label: 'Serra' },
                            ] as { id: HillIntensity; label: string }[]
                          ).map((h) => (
                            <button
                              key={h.id}
                              type="button"
                              onClick={() => {
                                onPlayClick();
                                onChangeTrack({ ...track, hills: h.id });
                              }}
                              className={`px-2 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                                track.hills === h.id
                                  ? 'bg-cyan-400 text-slate-950 border-cyan-400'
                                  : 'bg-slate-900 text-slate-300 border-white/10'
                              }`}
                            >
                              {h.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="block text-xs font-medium text-slate-300 mb-1">
                          Tráfego
                        </span>
                        <div className="flex flex-col gap-1">
                          {(
                            [
                              { id: 'light', label: 'Leve' },
                              { id: 'arcade', label: 'Arcade' },
                              { id: 'intense', label: 'Intenso' },
                            ] as { id: TrafficDensity; label: string }[]
                          ).map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                onPlayClick();
                                onChangeTrack({ ...track, traffic: t.id });
                              }}
                              className={`px-2 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                                track.traffic === t.id
                                  ? 'bg-cyan-400 text-slate-950 border-cyan-400'
                                  : 'bg-slate-900 text-slate-300 border-white/10'
                              }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'records' && (
                <div>
                  {highScores.length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-400">
                      Nenhuma corrida concluída ainda. Clique em Correr Agora e
                      registre seu primeiro recorde.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-white/10 text-slate-400">
                            <th className="py-2 pr-3 font-medium">Posição</th>
                            <th className="py-2 pr-3 font-medium">Bioma</th>
                            <th className="py-2 pr-3 font-medium">Dia</th>
                            <th className="py-2 pr-3 font-medium">Distância</th>
                            <th className="py-2 text-right font-medium">
                              Pontos
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {highScores.map((entry, idx) => (
                            <tr key={entry.id} className="text-slate-200">
                              <td className="py-2 pr-3 font-mono-tabular text-amber-400 font-bold">
                                #{idx + 1}
                              </td>
                              <td className="py-2 pr-3 text-slate-300">
                                {BIOME_PRESETS[entry.biome].label}
                              </td>
                              <td className="py-2 pr-3 font-mono-tabular">
                                Dia {entry.day}
                              </td>
                              <td className="py-2 pr-3 font-mono-tabular">
                                {entry.distanceKm.toFixed(2)} km
                              </td>
                              <td className="py-2 text-right font-mono-tabular font-bold text-white">
                                {entry.score.toLocaleString('pt-BR')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
