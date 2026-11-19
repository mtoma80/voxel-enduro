import { useCallback, useEffect, useRef, useState } from 'react';
import { CustomizeDock } from './components/CustomizeDock';
import { RaceHud } from './components/RaceHud';
import { ArcadeAudio } from './engine/audio';
import { EnduroWorld, InputState } from './engine/EnduroWorld';
import {
  CameraMode,
  DEFAULT_TRACK,
  DEFAULT_VEHICLE,
  GameMode,
  HighScoreEntry,
  HudTelemetry,
  TrackConfig,
} from './types/game';

const STORAGE_TRACK_KEY = 'voxel_enduro_track_v1';
const STORAGE_SCORES_KEY = 'voxel_enduro_scores_v1';

function loadSaved<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

function loadScores(): HighScoreEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_SCORES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const INITIAL_HUD: HudTelemetry = {
  speedKmh: 0,
  maxSpeedKmh: 295,
  day: 1,
  passedInDay: 0,
  targetInDay: 28,
  dayProgress: 0,
  phase: 'morning',
  score: 0,
  distanceKm: 0,
  turbo: 100,
  isTurboActive: false,
  nearMissFlash: 0,
  crashFlash: 0,
  overtakeStreak: 0,
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<EnduroWorld | null>(null);
  const audioRef = useRef<ArcadeAudio | null>(null);

  const [track, setTrack] = useState<TrackConfig>(() =>
    loadSaved(STORAGE_TRACK_KEY, DEFAULT_TRACK)
  );
  const [highScores, setHighScores] = useState<HighScoreEntry[]>(loadScores);

  const [mode, setMode] = useState<GameMode>('garage');
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [hud, setHud] = useState<HudTelemetry>(INITIAL_HUD);
  const [muted, setMuted] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  const latestHudRef = useRef(hud);
  latestHudRef.current = hud;
  const latestTrackRef = useRef(track);
  latestTrackRef.current = track;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const saveScore = useCallback((finalHud: HudTelemetry) => {
    if (finalHud.score <= 0) return;
    const entry: HighScoreEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      score: finalHud.score,
      day: finalHud.day,
      distanceKm: finalHud.distanceKm,
      vehicleName: DEFAULT_VEHICLE.name,
      biome: latestTrackRef.current.biome,
      date: new Date().toISOString(),
    };
    setHighScores((prev) => {
      const next = [...prev, entry]
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
      try {
        localStorage.setItem(STORAGE_SCORES_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });
  }, []);

  // Initialize WebGL World once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const audio = new ArcadeAudio();
    audioRef.current = audio;

    const world = new EnduroWorld(
      container,
      DEFAULT_VEHICLE,
      latestTrackRef.current,
      audio,
      {
        onHudUpdate: (nextHud) => {
          setHud(nextHud);
        },
        onModeChange: (nextMode) => {
          setMode(nextMode);
          if (nextMode === 'gameover') {
            saveScore(latestHudRef.current);
          }
        },
        onContextLost: (lost) => {
          setContextLost(lost);
        },
      }
    );
    worldRef.current = world;

    return () => {
      world.dispose();
      audio.dispose();
      worldRef.current = null;
      audioRef.current = null;
    };
  }, [saveScore]);

  // Persist & apply track changes
  const handleTrackChange = useCallback((next: TrackConfig) => {
    setTrack(next);
    worldRef.current?.updateTrackConfig(next);
    try {
      localStorage.setItem(STORAGE_TRACK_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    if (!audioRef.current) return;
    const isNowMuted = audioRef.current.toggleMute();
    setMuted(isNowMuted);
  }, []);

  const handleToggleCamera = useCallback(() => {
    setCameraMode((prev) => {
      const next: CameraMode = prev === 'chase' ? 'hood' : 'chase';
      worldRef.current?.setCameraMode(next);
      return next;
    });
  }, []);

  const handlePlayClick = useCallback(() => {
    audioRef.current?.playClick();
  }, []);

  const handleShare = useCallback(async () => {
    const shareUrl = window.location.href;
    const shareTitle = 'Voxel Enduro — Corrida Arcade';
    const shareText = `Jogue Voxel Enduro! Corrida arcade inspirada no clássico Enduro do Atari, criado por Marcelo Toma.`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // Fallback to clipboard copy if user cancels or share fails
      }
    }

    try {
      await navigator.clipboard.writeText(`${shareTitle}\n${shareUrl}`);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2400);
    } catch {
      setShareCopied(false);
    }
  }, []);

  // Keyboard Arcade Controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement &&
        document.activeElement.tagName === 'INPUT'
      ) {
        return;
      }

      const code = e.code;
      if (
        code === 'ArrowLeft' ||
        code === 'ArrowRight' ||
        code === 'ArrowUp' ||
        code === 'ArrowDown' ||
        code === 'Space'
      ) {
        e.preventDefault();
      }

      if (code === 'ArrowLeft' || code === 'KeyA') {
        worldRef.current?.setInput({ left: true });
      } else if (code === 'ArrowRight' || code === 'KeyD') {
        worldRef.current?.setInput({ right: true });
      } else if (code === 'ArrowUp' || code === 'KeyW') {
        worldRef.current?.setInput({ accel: true });
      } else if (code === 'ArrowDown' || code === 'KeyS') {
        worldRef.current?.setInput({ brake: true });
      } else if (code === 'Space') {
        worldRef.current?.setInput({ turbo: true });
      } else if (code === 'KeyC' && !e.repeat) {
        handleToggleCamera();
      } else if (code === 'KeyM' && !e.repeat) {
        handleToggleMute();
      } else if ((code === 'KeyP' || code === 'Escape') && !e.repeat) {
        if (modeRef.current === 'racing' || modeRef.current === 'paused') {
          worldRef.current?.togglePause();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'ArrowLeft' || code === 'KeyA') {
        worldRef.current?.setInput({ left: false });
      } else if (code === 'ArrowRight' || code === 'KeyD') {
        worldRef.current?.setInput({ right: false });
      } else if (code === 'ArrowUp' || code === 'KeyW') {
        worldRef.current?.setInput({ accel: false });
      } else if (code === 'ArrowDown' || code === 'KeyS') {
        worldRef.current?.setInput({ brake: false });
      } else if (code === 'Space') {
        worldRef.current?.setInput({ turbo: false });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [handleToggleCamera, handleToggleMute]);

  const handleTouchInput = useCallback((patch: Partial<InputState>) => {
    worldRef.current?.setInput(patch);
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950">
      {/* Dedicated Isolated WebGL Canvas Container */}
      <div ref={mountRef} className="w-full h-full cursor-default" />

      {/* Graceful WebGL Context Loss Fallback */}
      {contextLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-6 text-center">
          <div className="max-w-sm rounded-2xl bg-slate-900 border border-white/15 p-6">
            <h2 className="font-display text-xl font-bold text-white">
              Contexto 3D Interrompido
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              A renderização WebGL foi pausada pelo navegador. Recarregue a
              página para retomar a corrida.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 px-5 py-2 rounded-lg bg-amber-500 text-slate-950 font-bold text-sm cursor-pointer"
            >
              Recarregar Jogo
            </button>
          </div>
        </div>
      )}

      {/* Track Customizer & Start Lobby */}
      {mode === 'garage' && (
        <CustomizeDock
          track={track}
          highScores={highScores}
          muted={muted}
          shareCopied={shareCopied}
          onChangeTrack={handleTrackChange}
          onStartRace={() => worldRef.current?.startRace()}
          onToggleMute={handleToggleMute}
          onShare={handleShare}
          onPlayClick={handlePlayClick}
        />
      )}

      {/* Racing, Pause, Day Clear & Game Over HUD */}
      {mode !== 'garage' && (
        <RaceHud
          mode={mode}
          hud={hud}
          cameraMode={cameraMode}
          muted={muted}
          onToggleCamera={handleToggleCamera}
          onToggleMute={handleToggleMute}
          onTogglePause={() => worldRef.current?.togglePause()}
          onNextDay={() => worldRef.current?.continueNextDay()}
          onRestart={() => worldRef.current?.startRace()}
          onReturnGarage={() => worldRef.current?.returnToGarage()}
          onTouchInput={handleTouchInput}
        />
      )}
    </main>
  );
}
