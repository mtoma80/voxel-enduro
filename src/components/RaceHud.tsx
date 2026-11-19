import React, { useEffect, useState } from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  CloudFog,
  Flag,
  Flame,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Snowflake,
  Sun,
  Sunrise,
  Sunset,
  Volume2,
  VolumeX,
  Wrench,
} from 'lucide-react';
import { InputState } from '../engine/EnduroWorld';
import {
  CameraMode,
  GameMode,
  HudTelemetry,
  PHASE_LABELS,
  WeatherPhase,
} from '../types/game';

interface RaceHudProps {
  mode: GameMode;
  hud: HudTelemetry;
  cameraMode: CameraMode;
  muted: boolean;
  onToggleCamera: () => void;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onNextDay: () => void;
  onRestart: () => void;
  onReturnGarage: () => void;
  onTouchInput: (patch: Partial<InputState>) => void;
}

function PhaseIcon({ phase }: { phase: WeatherPhase }) {
  switch (phase) {
    case 'morning':
      return <Sun className="w-4 h-4 text-amber-300" />;
    case 'sunset':
      return <Sunset className="w-4 h-4 text-orange-400" />;
    case 'night':
      return <Moon className="w-4 h-4 text-indigo-300" />;
    case 'fog':
      return <CloudFog className="w-4 h-4 text-slate-300" />;
    case 'snow':
      return <Snowflake className="w-4 h-4 text-cyan-300" />;
    case 'dawn':
      return <Sunrise className="w-4 h-4 text-pink-300" />;
  }
}

export const RaceHud: React.FC<RaceHudProps> = ({
  mode,
  hud,
  cameraMode,
  muted,
  onToggleCamera,
  onToggleMute,
  onTogglePause,
  onNextDay,
  onRestart,
  onReturnGarage,
  onTouchInput,
}) => {
  const [showNearMiss, setShowNearMiss] = useState(false);

  useEffect(() => {
    if (!hud.nearMissFlash) return;
    setShowNearMiss(true);
    const id = window.setTimeout(() => setShowNearMiss(false), 1100);
    return () => window.clearTimeout(id);
  }, [hud.nearMissFlash]);

  const remaining = Math.max(0, hud.targetInDay - hud.passedInDay);
  const quotaPct = Math.min(100, (hud.passedInDay / hud.targetInDay) * 100);
  const dayTimePct = Math.min(100, hud.dayProgress * 100);

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-3 sm:p-5">
      {/* Top HUD Bar */}
      <div className="flex items-start justify-between gap-3">
        {/* Left: Enduro Day & Overtake Quota */}
        <div className="pointer-events-auto min-w-[210px] sm:min-w-[260px] rounded-xl bg-slate-950/88 border border-white/15 px-3.5 py-2.5 shadow-xl">
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-display text-base sm:text-lg font-bold text-amber-400">
              DIA {hud.day}
            </span>
            <span className="font-mono-tabular text-xs sm:text-sm font-bold text-white">
              {hud.score.toLocaleString('pt-BR')} pts
            </span>
          </div>

          <div className="mt-1.5 flex items-center justify-between text-xs text-slate-300">
            <span>Ultrapassagens</span>
            <span className="font-mono-tabular font-semibold text-white">
              {remaining === 0 ? 'Meta batida!' : `Faltam ${remaining}`}
            </span>
          </div>

          <div className="mt-1 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-400 transition-all duration-150"
              style={{ width: `${quotaPct}%` }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>Tempo do dia</span>
            <span className="font-mono-tabular">
              {Math.max(0, Math.round(100 - dayTimePct))}% restante
            </span>
          </div>
          <div className="mt-0.5 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-150 ${
                dayTimePct > 80 ? 'bg-rose-500' : 'bg-amber-400'
              }`}
              style={{ width: `${dayTimePct}%` }}
            />
          </div>
        </div>

        {/* Right: Author Credit + Phase + Action Controls */}
        <div className="pointer-events-auto flex flex-col items-end gap-1.5">
          <span className="px-2.5 py-1 rounded-md bg-slate-950/80 border border-white/10 text-[11px] font-medium text-slate-200 tracking-wide whitespace-nowrap">
            Criado por Marcelo Toma
          </span>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950/88 border border-white/15 text-xs font-medium text-slate-200">
              <PhaseIcon phase={hud.phase} />
              <span>{PHASE_LABELS[hud.phase]}</span>
            </div>

            <button
              type="button"
              onClick={onToggleCamera}
              title="Trocar Câmera (C)"
              className="inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-xl bg-slate-950/88 hover:bg-slate-800 border border-white/15 text-xs font-medium text-slate-100 cursor-pointer"
            >
              <Camera className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">
                {cameraMode === 'chase' ? '3ª Pessoa' : 'Capô'}
              </span>
            </button>

            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Ativar som' : 'Silenciar som'}
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-950/88 hover:bg-slate-800 border border-white/15 text-slate-100 cursor-pointer"
            >
              {muted ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
            </button>

            <button
              type="button"
              onClick={onTogglePause}
              title="Pausar (P)"
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-950/88 hover:bg-slate-800 border border-white/15 text-slate-100 cursor-pointer"
            >
              {mode === 'paused' ? (
                <Play className="w-4 h-4 text-amber-400" />
              ) : (
                <Pause className="w-4 h-4 text-slate-100" />
              )}
            </button>
          </div>

          {showNearMiss && (
            <div className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-display font-bold text-xs tracking-wide shadow-lg">
              Fino! +75 pts · Turbo +18%
            </div>
          )}
        </div>
      </div>

      {/* Center Overlays (Pause / Day Clear / Game Over) */}
      {mode === 'paused' && (
        <div className="pointer-events-auto self-center w-full max-w-sm rounded-2xl bg-slate-950/95 border border-white/15 p-6 text-center shadow-2xl">
          <h2 className="font-display text-2xl font-bold text-white">
            Corrida Pausada
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Dia {hud.day} · {remaining} ultrapassagens restantes
          </p>
          <div className="mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={onTogglePause}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm cursor-pointer"
            >
              Continuar Corrida
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reiniciar do Dia 1</span>
            </button>
            <button
              type="button"
              onClick={onReturnGarage}
              className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 text-sm font-medium cursor-pointer"
            >
              <Wrench className="w-4 h-4" />
              <span>Voltar à Garagem</span>
            </button>
          </div>
        </div>
      )}

      {mode === 'day_clear' && (
        <div className="pointer-events-auto self-center w-full max-w-md rounded-2xl bg-slate-950/95 border border-emerald-400/40 p-6 text-center shadow-2xl">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 mb-3">
            <Flag className="w-6 h-6" />
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
            Dia {hud.day} Concluído!
          </h2>
          <p className="mt-1.5 text-sm text-slate-300">
            Você completou todas as ultrapassagens antes do amanhecer.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-900 p-3 border border-white/10">
            <div>
              <div className="text-[11px] text-slate-400">Bônus do Dia</div>
              <div className="font-mono-tabular text-sm font-bold text-emerald-400">
                +{500 * hud.day}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Pontuação</div>
              <div className="font-mono-tabular text-sm font-bold text-white">
                {hud.score.toLocaleString('pt-BR')}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Distância</div>
              <div className="font-mono-tabular text-sm font-bold text-cyan-300">
                {hud.distanceKm.toFixed(2)} km
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={onNextDay}
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-display font-bold text-sm cursor-pointer"
            >
              Iniciar Dia {hud.day + 1}
            </button>
            <button
              type="button"
              onClick={onReturnGarage}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium cursor-pointer"
            >
              Garagem
            </button>
          </div>
        </div>
      )}

      {mode === 'gameover' && (
        <div className="pointer-events-auto self-center w-full max-w-md rounded-2xl bg-slate-950/95 border border-rose-500/40 p-6 text-center shadow-2xl">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
            Fim do Dia {hud.day}
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            O sol nasceu antes de completar as {hud.targetInDay}{' '}
            ultrapassagens.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-900 p-3 border border-white/10">
            <div>
              <div className="text-[11px] text-slate-400">Dia Alcançado</div>
              <div className="font-mono-tabular text-sm font-bold text-amber-400">
                Dia {hud.day}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Pontuação</div>
              <div className="font-mono-tabular text-sm font-bold text-white">
                {hud.score.toLocaleString('pt-BR')}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Distância</div>
              <div className="font-mono-tabular text-sm font-bold text-cyan-300">
                {hud.distanceKm.toFixed(2)} km
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={onRestart}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Correr Novamente</span>
            </button>
            <button
              type="button"
              onClick={onReturnGarage}
              className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium cursor-pointer"
            >
              <Wrench className="w-4 h-4" />
              <span>Garagem</span>
            </button>
          </div>
        </div>
      )}

      {/* Bottom Speedometer + Touch Arcade Controls */}
      <div className="flex items-end justify-between gap-3">
        {/* Touch Steering Left/Right (visible on mobile/tablet) */}
        <div className="pointer-events-auto flex md:hidden items-center gap-2">
          <button
            type="button"
            aria-label="Virar à esquerda"
            onPointerDown={() => onTouchInput({ left: true })}
            onPointerUp={() => onTouchInput({ left: false })}
            onPointerLeave={() => onTouchInput({ left: false })}
            onPointerCancel={() => onTouchInput({ left: false })}
            className="w-14 h-14 rounded-2xl bg-slate-950/85 active:bg-amber-500 active:text-slate-950 border border-white/20 flex items-center justify-center text-white"
          >
            <ChevronLeft className="w-7 h-7" />
          </button>
          <button
            type="button"
            aria-label="Virar à direita"
            onPointerDown={() => onTouchInput({ right: true })}
            onPointerUp={() => onTouchInput({ right: false })}
            onPointerLeave={() => onTouchInput({ right: false })}
            onPointerCancel={() => onTouchInput({ right: false })}
            className="w-14 h-14 rounded-2xl bg-slate-950/85 active:bg-amber-500 active:text-slate-950 border border-white/20 flex items-center justify-center text-white"
          >
            <ChevronRight className="w-7 h-7" />
          </button>
        </div>

        {/* Center Compact Digital Dashboard */}
        <div className="mx-auto flex flex-col items-center gap-1.5">
          <div className="pointer-events-auto flex items-center gap-4 px-4 py-2 rounded-xl bg-slate-950/90 border border-white/15 shadow-xl">
            <div className="flex items-baseline gap-1">
              <span
                className={`font-mono-tabular text-2xl sm:text-3xl font-bold ${
                  hud.isTurboActive ? 'text-cyan-300' : 'text-white'
                }`}
              >
                {hud.speedKmh}
              </span>
              <span className="text-[11px] font-medium text-slate-400">
                km/h
              </span>
            </div>

            <div className="h-6 w-px bg-white/15" />

            <div className="min-w-[92px]">
              <div className="flex items-center justify-between text-[11px] text-slate-300 mb-0.5">
                <span className="inline-flex items-center gap-1">
                  <Flame className="w-3 h-3 text-cyan-400" />
                  <span>Turbo</span>
                </span>
                <span className="font-mono-tabular">{hud.turbo}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full transition-all duration-100 ${
                    hud.isTurboActive ? 'bg-amber-400' : 'bg-cyan-400'
                  }`}
                  style={{ width: `${hud.turbo}%` }}
                />
              </div>
            </div>

            <div className="hidden sm:block h-6 w-px bg-white/15" />

            <div className="hidden sm:flex flex-col text-right">
              <span className="text-[10px] text-slate-400">Distância</span>
              <span className="font-mono-tabular text-xs font-semibold text-slate-200">
                {hud.distanceKm.toFixed(2)} km
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 text-[11px] text-slate-300 bg-slate-950/75 px-3 py-0.5 rounded-md border border-white/10">
            <span>Setas ou WASD: Dirigir e Acelerar</span>
            <span aria-hidden="true">·</span>
            <span>Espaço: Turbo</span>
            <span aria-hidden="true">·</span>
            <span>C: Câmera</span>
            <span aria-hidden="true">·</span>
            <span>P: Pausar</span>
          </div>
        </div>

        {/* Touch Pedals (visible on mobile/tablet) */}
        <div className="pointer-events-auto flex md:hidden items-center gap-2">
          <button
            type="button"
            onPointerDown={() => onTouchInput({ turbo: true })}
            onPointerUp={() => onTouchInput({ turbo: false })}
            onPointerLeave={() => onTouchInput({ turbo: false })}
            onPointerCancel={() => onTouchInput({ turbo: false })}
            className="w-12 h-14 rounded-2xl bg-cyan-500/85 active:bg-cyan-400 text-slate-950 font-display font-bold text-xs flex items-center justify-center"
          >
            NITRO
          </button>
          <button
            type="button"
            onPointerDown={() => onTouchInput({ brake: true })}
            onPointerUp={() => onTouchInput({ brake: false })}
            onPointerLeave={() => onTouchInput({ brake: false })}
            onPointerCancel={() => onTouchInput({ brake: false })}
            className="w-12 h-14 rounded-2xl bg-rose-600/85 active:bg-rose-500 text-white font-display font-bold text-xs flex items-center justify-center"
          >
            FREIO
          </button>
          <button
            type="button"
            onPointerDown={() => onTouchInput({ accel: true })}
            onPointerUp={() => onTouchInput({ accel: false })}
            onPointerLeave={() => onTouchInput({ accel: false })}
            onPointerCancel={() => onTouchInput({ accel: false })}
            className="w-14 h-14 rounded-2xl bg-emerald-500/90 active:bg-emerald-400 text-slate-950 font-display font-bold text-xs flex items-center justify-center"
          >
            ACEL
          </button>
        </div>
      </div>
    </div>
  );
};
