import type { SeamTimes } from '../content/glitches.ts';

export const SEAM_PHASES = ['build_up', 'tear', 'mist', 'tear_back', 'settle'] as const;
export type SeamPhase = (typeof SEAM_PHASES)[number];

export interface SeamPlan {
  readonly times: SeamTimes;
  readonly mist: number;
}

export interface SeamMoment {
  readonly phase: SeamPhase;
  readonly progress: number;
  readonly left: number;
}

const HIDES: Readonly<Record<SeamPhase, boolean>> = { build_up: false, tear: true, mist: true, tear_back: true, settle: false };

export function hidesWorld(phase: SeamPhase): boolean {
  return HIDES[phase];
}

export function phaseLength(plan: SeamPlan, phase: SeamPhase): number {
  const lengths: Readonly<Record<SeamPhase, number>> = { build_up: plan.times.buildUp, tear: plan.times.tear, mist: plan.mist, tear_back: plan.times.tearBack, settle: plan.times.settle };
  return lengths[phase];
}

export function seamLength(plan: SeamPlan): number {
  return SEAM_PHASES.reduce((sum: number, phase: SeamPhase): number => sum + phaseLength(plan, phase), 0);
}

export function guardStart(plan: SeamPlan): number {
  return plan.times.buildUp - plan.times.guard;
}

export function seamAt(plan: SeamPlan, elapsed: number): SeamMoment {
  let start: number = 0;
  for (const phase of SEAM_PHASES) {
    const length: number = phaseLength(plan, phase);
    if (elapsed < start + length) {
      const into: number = Math.max(0, elapsed - start);
      return { phase, progress: into / length, left: length - into };
    }
    start += length;
  }
  return { phase: 'settle', progress: 1, left: 0 };
}
