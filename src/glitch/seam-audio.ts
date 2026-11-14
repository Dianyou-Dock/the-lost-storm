import type { SoundCue } from '../../sim/audio.ts';
import type { CueDef, SeamPart, SeamPartSound, SeamSound } from '../../sim/content/audio.ts';
import type { SeamTimes } from '../../sim/content/glitches.ts';
import type { SeamPhase } from '../../sim/world/seam.ts';
import { seamHit, seamReturn, seamRiser } from '../audio/seam-synth.ts';

export const SEAM_AUDIO = {
  restoreSeconds: 0.5,
} as const;

export interface SeamAudioOut {
  playSeam(cue: SoundCue): void;
  synth(play: (context: BaseAudioContext, out: AudioNode, at: number) => void): void;
  thinWorld(level: number, seconds: number): void;
}

export interface SeamAudio {
  phase(phase: SeamPhase): void;
  end(): void;
}

const PARTS: Readonly<Record<SeamPhase, SeamPart | null>> = { build_up: 'buildUp', tear: 'tear', mist: null, tear_back: 'tearBack', settle: 'settle' };

export function seamPart(phase: SeamPhase): SeamPart | null {
  return PARTS[phase];
}

type Play = (context: BaseAudioContext, out: AudioNode, at: number) => void;

function synthFor(part: SeamPart, times: SeamTimes): Play {
  const plays: Readonly<Record<SeamPart, Play>> = {
    buildUp: (context: BaseAudioContext, out: AudioNode, at: number): void => seamRiser(context, out, at, times.buildUp),
    tear: (context: BaseAudioContext, out: AudioNode, at: number): void => seamHit(context, out, at, false),
    tearBack: (context: BaseAudioContext, out: AudioNode, at: number): void => seamHit(context, out, at, true),
    settle: (context: BaseAudioContext, out: AudioNode, at: number): void => seamReturn(context, out, at),
  };
  return plays[part];
}

function cueOf(entry: CueDef): SoundCue {
  return { ...entry, position: null };
}

export function worldLevel(phase: SeamPhase, sound: SeamSound): number {
  const levels: Readonly<Record<SeamPhase, number>> = { build_up: sound.worldFloor, tear: 0, mist: 0, tear_back: 0, settle: 1 };
  return levels[phase];
}

export function createSeamAudio(out: SeamAudioOut, sound: SeamSound, times: SeamTimes): SeamAudio {
  const thinFor: Readonly<Record<SeamPhase, number>> = { build_up: times.buildUp, tear: times.tear, mist: times.tear, tear_back: times.tearBack, settle: times.settle };
  return {
    phase(phase: SeamPhase): void {
      out.thinWorld(worldLevel(phase, sound), thinFor[phase]);
      const part: SeamPart | null = seamPart(phase);
      if (part === null) return;
      const chosen: SeamPartSound = sound.parts[part];
      if (chosen.synth) out.synth(synthFor(part, times));
      for (const entry of chosen.cues) out.playSeam(cueOf(entry));
    },
    end(): void {
      out.thinWorld(1, SEAM_AUDIO.restoreSeconds);
    },
  };
}
