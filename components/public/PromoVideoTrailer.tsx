'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Sparkles,
  Layers,
  Building2,
  TrendingUp,
  ShieldCheck,
  Zap,
  Copy,
  Check,
  Download,
  Film,
  Subtitles,
  ChevronRight,
  Radio,
  Sliders,
  Share2
} from 'lucide-react';

export interface Scene {
  id: number;
  title: string;
  subtitle: string;
  duration: number; // in seconds
  voiceover: string;
  visualDescription: string;
  sfx: string;
  badge: string;
  badgeColor: string;
  bgGradient: string;
}

const COMMERCIAL_SCENES: Scene[] = [
  {
    id: 1,
    title: "The Fragmented Enterprise Chaos",
    subtitle: "Drowning in siloed tools, manual payroll errors, and broken audit logs?",
    duration: 10,
    voiceover: "In modern business, speed is everything. Yet enterprises waste hundreds of hours switching between disconnected spreadsheets, legacy accounting systems, and untracked approvals.",
    visualDescription: "Dark moody cinematic glitch aesthetic. Scattered data tables, red security warnings, broken balance sheets dissolving into digital noise.",
    sfx: "Sub-bass tension drone, static crackle, digital alarm heartbeat",
    badge: "ACT I: THE CHALLENGE",
    badgeColor: "bg-red-500/20 text-red-400 border-red-500/30",
    bgGradient: "from-slate-950 via-red-950/20 to-slate-900"
  },
  {
    id: 2,
    title: "Meet MiraTech Business Suite",
    subtitle: "The unified operational engine for forward-thinking enterprises.",
    duration: 12,
    voiceover: "Introducing MiraTech Business Suite. One single, cryptographically secure platform unifying executive financial ledgers, automated payroll, multi-warehouse inventory, and real-time project sprints.",
    visualDescription: "Sleek 3D glowing glassmorphism dashboard assembling seamlessly. Blue neon light passes through financial metrics, active workforce roster, and project Kanban boards.",
    sfx: "Whoosh transition, futuristic ambient synth riser, crisp mechanical lock chime",
    badge: "ACT II: THE REVELATION",
    badgeColor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    bgGradient: "from-slate-950 via-blue-950/30 to-slate-900"
  },
  {
    id: 3,
    title: "Real-Time Intelligence & Speed",
    subtitle: "Instant double-entry reconciliation and automated invoice conversion.",
    duration: 12,
    voiceover: "Transform raw transactions into live executive P&L intelligence. Draft client quotations in seconds and automatically convert them into tax-compliant invoices with full Paddle merchant integration.",
    visualDescription: "Interactive animated graphs curving sharply upward. Dynamic invoice generation animation with digital signature, tax calculation, and instant payment receipt badge.",
    sfx: "High-frequency data chime, digital pulse, success chime chord",
    badge: "ACT III: SPEED & INTEL",
    badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    bgGradient: "from-slate-950 via-emerald-950/30 to-slate-900"
  },
  {
    id: 4,
    title: "Uncompromising Governance & SecOps",
    subtitle: "Cryptographically tamper-proof audit trails and granular RBAC.",
    duration: 12,
    voiceover: "Security isn't an afterthought—it's built into every byte. Protect your organization with military-grade role-based access control, IP subnet whitelisting, and immutable security audit trails.",
    visualDescription: "Interactive 3D security shield pulse with animated encryption keys. Live audit log streaming user actions with millisecond cryptographic timestamps.",
    sfx: "Cybernetic pulse, heavy vault lock engagement, low rumble bass drop",
    badge: "ACT IV: SECOPS GOVERNANCE",
    badgeColor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    bgGradient: "from-slate-950 via-purple-950/30 to-slate-900"
  },
  {
    id: 5,
    title: "Scale Without Limits",
    subtitle: "Empower your workforce. Elevate your bottom line.",
    duration: 14,
    voiceover: "Join hundreds of industry leaders driving frictionless growth with MiraTech. Start your 14-day full-feature corporate trial today—no setup fees, no complex migrations, complete clarity.",
    visualDescription: "Panoramic 4K showcase of the complete MiraTech ecosystem. Glowing headline 'MiraTech Business Suite: Operate at the Speed of Thought' with CTA button lighting up.",
    sfx: "Inspiring orchestral synth climax, warm resolution swell, pristine bell chime",
    badge: "ACT V: THE FUTURE",
    badgeColor: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    bgGradient: "from-slate-950 via-cyan-950/30 to-slate-900"
  }
];

const TOTAL_DURATION = COMMERCIAL_SCENES.reduce((acc, scene) => acc + scene.duration, 0);

export default function PromoVideoTrailer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [enableVoiceover, setEnableVoiceover] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [qualityMode, setQualityMode] = useState<'1080p' | '4K UHD'>('4K UHD');
  const [copiedScript, setCopiedScript] = useState(false);
  const [showStoryboard, setShowStoryboard] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const isSpeakingRef = useRef<boolean>(false);

  // Compute active scene based on currentTime
  const getActiveSceneInfo = useCallback((timeSec: number) => {
    let accumulated = 0;
    for (let i = 0; i < COMMERCIAL_SCENES.length; i++) {
      const scene = COMMERCIAL_SCENES[i];
      if (timeSec >= accumulated && timeSec < accumulated + scene.duration) {
        const sceneProgress = (timeSec - accumulated) / scene.duration;
        return { sceneIndex: i, scene, sceneProgress, sceneStartTime: accumulated };
      }
      accumulated += scene.duration;
    }
    // Fallback if at the very end
    const lastIndex = COMMERCIAL_SCENES.length - 1;
    return {
      sceneIndex: lastIndex,
      scene: COMMERCIAL_SCENES[lastIndex],
      sceneProgress: 1,
      sceneStartTime: TOTAL_DURATION - COMMERCIAL_SCENES[lastIndex].duration
    };
  }, []);

  const activeSceneInfo = getActiveSceneInfo(currentTime);
  const { sceneIndex, scene, sceneProgress } = activeSceneInfo;

  // Synthesize Sound Effects & Ambient Audio Tone
  const playSceneAudioTone = useCallback((sceneId: number) => {
    if (isMuted) return;
    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          audioCtxRef.current = new AudioCtx();
        }
      }
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      // Frequencies tailored to scene tones
      const freqs: Record<number, number> = { 1: 110, 2: 220, 3: 330, 4: 176, 5: 440 };
      const freq = freqs[sceneId] || 220;

      osc.type = sceneId === 1 ? 'sawtooth' : sceneId === 4 ? 'square' : 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.3);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.start(now);
      osc.stop(now + 0.6);
    } catch {
      // Non-blocking audio fallback
    }
  }, [isMuted]);

  // Voiceover Speech Synthesis
  const speakVoiceover = useCallback((text: string) => {
    if (!enableVoiceover || isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    try {
      window.speechSynthesis.cancel(); // Stop prior
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.02 * playbackSpeed;
      utterance.pitch = 1.0;
      utterance.volume = 0.95;

      // Prefer high-quality English voice if available
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Alex')));
      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      isSpeakingRef.current = true;
      utterance.onend = () => { isSpeakingRef.current = false; };
      utterance.onerror = () => { isSpeakingRef.current = false; };

      window.speechSynthesis.speak(utterance);
    } catch {
      // Non-blocking fallback
    }
  }, [enableVoiceover, isMuted, playbackSpeed]);

  // Trigger sound/voice on scene change
  const prevSceneIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (isPlaying && prevSceneIdRef.current !== scene.id) {
      prevSceneIdRef.current = scene.id;
      playSceneAudioTone(scene.id);
      speakVoiceover(scene.voiceover);
    }
  }, [scene.id, isPlaying, playSceneAudioTone, speakVoiceover, scene.voiceover]);

  // Playback Loop
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      lastTimeRef.current = null;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return;
    }

    const updateFrame = (now: number) => {
      if (lastTimeRef.current !== null) {
        const deltaSec = (now - lastTimeRef.current) / 1000;
        setCurrentTime((prev) => {
          const next = prev + deltaSec * playbackSpeed;
          if (next >= TOTAL_DURATION) {
            setIsPlaying(false);
            return 0; // Reset to start
          }
          return next;
        });
      }
      lastTimeRef.current = now;
      animFrameRef.current = requestAnimationFrame(updateFrame);
    };

    animFrameRef.current = requestAnimationFrame(updateFrame);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, playbackSpeed]);

  const handlePlayPause = () => {
    if (!isPlaying && currentTime >= TOTAL_DURATION - 0.5) {
      setCurrentTime(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setCurrentTime(0);
    setIsPlaying(false);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (isPlaying && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const newScene = getActiveSceneInfo(newTime).scene;
      speakVoiceover(newScene.voiceover);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  const copyFullScript = () => {
    const fullText = COMMERCIAL_SCENES.map(s => (
      `=== ${s.badge}: ${s.title} (${s.duration}s) ===\n` +
      `Visual: ${s.visualDescription}\n` +
      `Voiceover: "${s.voiceover}"\n` +
      `SFX: ${s.sfx}\n`
    )).join('\n\n');

    navigator.clipboard.writeText(fullText);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 3000);
  };

  const formatTime = (timeSec: number) => {
    const mins = Math.floor(timeSec / 60);
    const secs = Math.floor(timeSec % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 my-10">
      {/* Main Video Frame Player */}
      <div
        ref={containerRef}
        className={`relative group rounded-2xl overflow-hidden shadow-2xl border border-slate-800 bg-slate-950 transition-all duration-500 ${
          isFullscreen ? 'fixed inset-0 z-50 rounded-none max-w-none h-screen flex flex-col justify-between' : 'aspect-video w-full'
        }`}
      >
        {/* Dynamic Background Stage */}
        <div className={`absolute inset-0 bg-gradient-to-br ${scene.bgGradient} transition-all duration-1000`}>
          {/* Animated Ambient Light Grids */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.25),rgba(255,255,255,0))]" />
          <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
        </div>

        {/* Video Watermark Header & Quality Tag */}
        <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-20 bg-gradient-to-b from-slate-950/90 via-slate-950/40 to-transparent">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold tracking-tight text-white">MiraTech Business Suite</span>
                <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase">
                  Official Commercial
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">4K Ultra HD Commercial Trailer (60s)</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Live Indicator */}
            {isPlaying && (
              <div className="flex items-center space-x-2 px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-semibold animate-pulse">
                <Radio className="w-3.5 h-3.5 animate-spin" />
                <span>ON AIR</span>
              </div>
            )}
            <button
              onClick={() => setQualityMode(qualityMode === '4K UHD' ? '1080p' : '4K UHD')}
              className="px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 text-xs font-mono font-medium transition"
            >
              {qualityMode}
            </button>
          </div>
        </div>

        {/* Dynamic Scene Content Render Canvas */}
        <div className="relative z-10 h-full w-full flex flex-col items-center justify-center p-8 sm:p-16 text-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={scene.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 1.05 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-3xl space-y-6"
            >
              {/* Scene Badge */}
              <div className="inline-flex items-center space-x-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold font-mono border tracking-wider uppercase ${scene.badgeColor}`}>
                  {scene.badge}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Scene {sceneIndex + 1} of {COMMERCIAL_SCENES.length}
                </span>
              </div>

              {/* Scene Animated Visual Representation Mockup */}
              <div className="relative my-4 flex justify-center">
                {scene.id === 1 && (
                  <div className="relative p-6 rounded-2xl bg-slate-900/80 border border-red-500/30 backdrop-blur-md max-w-md w-full shadow-2xl space-y-3 text-left">
                    <div className="flex items-center justify-between text-xs text-red-400 font-mono">
                      <span>SYSTEM_WARN: DATA_DISCONNECTED</span>
                      <span className="animate-ping text-red-500">●</span>
                    </div>
                    <div className="space-y-2 font-mono text-xs text-slate-400">
                      <div className="p-2 rounded bg-slate-950 border border-red-500/20 text-red-300">
                        ✖ Reconciliation mismatch: -$42,850.00
                      </div>
                      <div className="p-2 rounded bg-slate-950 border border-slate-800 text-slate-400">
                        ⚠ 14 Pending Employee Pay Slip Approvals
                      </div>
                      <div className="p-2 rounded bg-slate-950 border border-slate-800 text-slate-400">
                        ⚠ Unmapped POS Stock Discrepancy
                      </div>
                    </div>
                  </div>
                )}

                {scene.id === 2 && (
                  <div className="relative p-6 rounded-2xl bg-slate-900/90 border border-blue-500/40 backdrop-blur-md max-w-md w-full shadow-2xl space-y-4 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-400 font-mono">MIRATECH UNIFIED ENGINE</span>
                      <Zap className="w-4 h-4 text-blue-400 animate-bounce" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/30">
                        <TrendingUp className="w-5 h-5 text-blue-400 mb-1" />
                        <div className="text-[11px] text-slate-400">Ledger Growth</div>
                        <div className="text-sm font-bold text-white">+148.2% YoY</div>
                      </div>
                      <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30">
                        <ShieldCheck className="w-5 h-5 text-emerald-400 mb-1" />
                        <div className="text-[11px] text-slate-400">SecOps Status</div>
                        <div className="text-sm font-bold text-emerald-400">100% Compliant</div>
                      </div>
                    </div>
                  </div>
                )}

                {scene.id === 3 && (
                  <div className="relative p-6 rounded-2xl bg-slate-900/90 border border-emerald-500/40 backdrop-blur-md max-w-md w-full shadow-2xl space-y-3 text-left">
                    <div className="flex items-center justify-between text-xs font-mono text-emerald-400">
                      <span>AUTOMATED INVOICE GENERATOR</span>
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/20 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Invoice #INV-2026-892</span>
                        <span className="text-emerald-400 font-bold">$18,500.00 PAID</span>
                      </div>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-400 h-full rounded-full transition-all duration-1000" style={{ width: `${sceneProgress * 100}%` }} />
                      </div>
                    </div>
                  </div>
                )}

                {scene.id === 4 && (
                  <div className="relative p-6 rounded-2xl bg-slate-900/90 border border-purple-500/40 backdrop-blur-md max-w-md w-full shadow-2xl space-y-3 text-left">
                    <div className="flex items-center justify-between text-xs font-mono text-purple-400">
                      <span>SECOPS CRYPTOGRAPHIC AUDIT</span>
                      <ShieldCheck className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="space-y-1.5 text-[11px] font-mono">
                      <div className="p-1.5 rounded bg-slate-950 text-slate-300 border border-purple-500/20">
                        [03:46:07.112] AUTH_VERIFIED: miratechindustries@gmail.com
                      </div>
                      <div className="p-1.5 rounded bg-slate-950 text-slate-300 border border-purple-500/20">
                        [03:46:07.118] AUDIT_HASH: sha256:8f92a1c... [VALID]
                      </div>
                    </div>
                  </div>
                )}

                {scene.id === 5 && (
                  <div className="relative p-6 rounded-2xl bg-slate-900/90 border border-cyan-500/40 backdrop-blur-md max-w-md w-full shadow-2xl space-y-4 text-center">
                    <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg">
                      <Building2 className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-white">Start Your 14-Day Free Corporate Trial</h4>
                      <p className="text-xs text-slate-400 mt-1">Full access to all modules. Zero setup friction.</p>
                    </div>
                    <button className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold text-xs shadow-lg transition">
                      Claim Your Workspace Now →
                    </button>
                  </div>
                )}
              </div>

              {/* Main Headline */}
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                {scene.title}
              </h2>

              <p className="text-sm sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
                {scene.subtitle}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Closed Captions Subtitle Overlay */}
        {showSubtitles && (
          <div className="absolute bottom-20 left-0 right-0 z-20 px-6 text-center">
            <motion.div
              key={scene.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-block px-4 py-2 rounded-xl bg-slate-950/90 border border-slate-800 text-slate-200 text-xs sm:text-sm font-medium backdrop-blur-md shadow-xl max-w-3xl"
            >
              <span className="text-blue-400 font-bold mr-2">[VOICEOVER]:</span>
              &quot;{scene.voiceover}&quot;
            </motion.div>
          </div>
        )}

        {/* Video Control Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 z-30 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent space-y-3">
          {/* Timeline Scrubbing Bar */}
          <div className="relative group/timeline flex items-center">
            <input
              type="range"
              min={0}
              max={TOTAL_DURATION}
              step={0.1}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-slate-800 group-hover/timeline:h-2.5 rounded-lg appearance-none cursor-pointer accent-blue-500 transition-all"
            />
            {/* Scene Markers */}
            {COMMERCIAL_SCENES.map((sc, idx) => {
              let accumulated = 0;
              for (let i = 0; i < idx; i++) accumulated += COMMERCIAL_SCENES[i].duration;
              const percent = (accumulated / TOTAL_DURATION) * 100;
              return (
                <div
                  key={sc.id}
                  style={{ left: `${percent}%` }}
                  className="absolute top-0 bottom-0 w-0.5 bg-slate-600/80 pointer-events-none"
                  title={sc.title}
                />
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            {/* Left Controls */}
            <div className="flex items-center space-x-3">
              <button
                onClick={handlePlayPause}
                className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition shadow-lg flex items-center justify-center"
                title={isPlaying ? "Pause Trailer" : "Play Trailer"}
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
              </button>

              <button
                onClick={handleReset}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
                title="Replay from Start"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Time Display */}
              <div className="text-xs font-mono text-slate-400">
                <span className="text-white font-semibold">{formatTime(currentTime)}</span>
                <span className="mx-1">/</span>
                <span>{formatTime(TOTAL_DURATION)}</span>
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Voiceover Speech Toggle */}
              <button
                onClick={() => setEnableVoiceover(!enableVoiceover)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition flex items-center space-x-1.5 ${
                  enableVoiceover
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
                title="Toggle AI Voiceover Narration"
              >
                <Subtitles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Voiceover</span>
              </button>

              {/* Mute Audio */}
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
                title={isMuted ? "Unmute Sound" : "Mute Sound"}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>

              {/* Playback Speed */}
              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs font-mono cursor-pointer"
              >
                <option value={0.75}>0.75x</option>
                <option value={1}>1.0x</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
              </select>

              {/* Subtitles Toggle */}
              <button
                onClick={() => setShowSubtitles(!showSubtitles)}
                className={`p-2 rounded-lg border transition ${
                  showSubtitles ? 'bg-slate-800 text-blue-400 border-blue-500/40' : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}
                title="Toggle Captions"
              >
                <Subtitles className="w-4 h-4" />
              </button>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
                title="Toggle Theater Mode"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Production Script & Storyboard Studio Toolbar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Commercial Storyboard & Production Director Script</h3>
              <p className="text-xs text-slate-400">
                Full 60-second video production breakdown with timecodes, voiceover script, and SFX cues.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowStoryboard(!showStoryboard)}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center space-x-2"
            >
              <Sliders className="w-4 h-4" />
              <span>{showStoryboard ? "Hide Storyboard" : "Inspect Scene Cues"}</span>
            </button>

            <button
              onClick={copyFullScript}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg transition flex items-center space-x-2"
            >
              {copiedScript ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              <span>{copiedScript ? "Script Copied!" : "Copy Production Script"}</span>
            </button>
          </div>
        </div>

        {/* Storyboard Scene Breakdown */}
        {showStoryboard && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2"
          >
            {COMMERCIAL_SCENES.map((sc) => (
              <div
                key={sc.id}
                onClick={() => {
                  let accumulated = 0;
                  for (let i = 0; i < sc.id - 1; i++) accumulated += COMMERCIAL_SCENES[i].duration;
                  setCurrentTime(accumulated);
                }}
                className={`p-4 rounded-xl border transition cursor-pointer space-y-2 ${
                  scene.id === sc.id
                    ? 'bg-slate-800/90 border-blue-500/60 ring-1 ring-blue-500/40'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${sc.badgeColor}`}>
                    {sc.badge}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">{sc.duration} Seconds</span>
                </div>
                <h4 className="text-xs font-bold text-white">{sc.title}</h4>
                <p className="text-[11px] text-slate-400 line-clamp-2">{sc.voiceover}</p>
                <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 font-mono">
                  SFX: {sc.sfx}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
