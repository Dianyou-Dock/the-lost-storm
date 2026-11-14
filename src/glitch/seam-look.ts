import type { SeamMoment, SeamPhase } from '../../sim/world/seam.ts';

export const SEAM_LOOK = {
  buildCurve: 1.5,
  buildSplit: 0.012,
  buildSlip: 0.035,
  buildDensityFloor: 0.05,
  buildDensity: 0.22,
  buildBlocksFrom: 0.86,
  buildBlocks: 0.18,
  tearSplit: 0.032,
  tearSlip: 0.05,
  tearDensity: 0.65,
  tearStrength: 1,
  tearBlocksPeak: 0.55,
  tearBlocksWidth: 0.32,
  whiteFrom: 0.3,
  mistReveal: 0.22,
  mistVeil: 0.18,
  settleSplit: 0.014,
  settleSlip: 0.012,
  settleDensity: 0.2,
  hudSplitPixels: 6,
  hudTearPixels: 46,
} as const;

export interface SeamLook {
  readonly split: number;
  readonly slip: number;
  readonly density: number;
  readonly tear: number;
  readonly blocks: number;
  readonly white: number;
  readonly banded: boolean;
  readonly held: boolean;
  readonly swapped: boolean;
}

export interface HudTear {
  readonly split: number;
  readonly tear: number;
}

export const CALM_LOOK: SeamLook = { split: 0, slip: 0, density: 0, tear: 0, blocks: 0, white: 0, banded: true, held: false, swapped: false };

function smooth(edge0: number, edge1: number, value: number): number {
  const t: number = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function bump(centre: number, width: number, value: number): number {
  const d: number = Math.abs(value - centre) / width;
  return d >= 1 ? 0 : (1 - d * d) * (1 - d * d);
}

function whiteOnly(value: number, swapped: boolean, banded: boolean): SeamLook {
  return { ...CALM_LOOK, white: value, swapped, banded };
}

const TORN: Readonly<Record<SeamPhase, (p: number) => SeamLook>> = {
  build_up: (p: number): SeamLook => {
    const rise: number = Math.pow(p, SEAM_LOOK.buildCurve);
    return { split: SEAM_LOOK.buildSplit * rise, slip: SEAM_LOOK.buildSlip * rise, density: SEAM_LOOK.buildDensityFloor * smooth(0, 0.2, p) + SEAM_LOOK.buildDensity * rise, tear: 0, blocks: SEAM_LOOK.buildBlocks * smooth(SEAM_LOOK.buildBlocksFrom, 1, p), white: 0, banded: true, held: false, swapped: false };
  },
  tear: (p: number): SeamLook => ({ split: SEAM_LOOK.tearSplit * (0.5 + 0.5 * p), slip: SEAM_LOOK.tearSlip, density: SEAM_LOOK.tearDensity, tear: SEAM_LOOK.tearStrength * (0.55 + 0.45 * smooth(0, 0.4, p)), blocks: bump(SEAM_LOOK.tearBlocksPeak, SEAM_LOOK.tearBlocksWidth, p), white: smooth(SEAM_LOOK.whiteFrom, 1, p), banded: true, held: true, swapped: false }),
  mist: (p: number): SeamLook => whiteOnly(Math.max(1 - smooth(0, SEAM_LOOK.mistReveal, p), smooth(1 - SEAM_LOOK.mistVeil, 1, p)), true, true),
  tear_back: (p: number): SeamLook => ({ split: SEAM_LOOK.tearSplit * (1 - 0.5 * p), slip: SEAM_LOOK.tearSlip, density: SEAM_LOOK.tearDensity, tear: SEAM_LOOK.tearStrength * (1 - 0.45 * smooth(0.6, 1, p)), blocks: bump(1 - SEAM_LOOK.tearBlocksPeak, SEAM_LOOK.tearBlocksWidth, p), white: 1 - smooth(0, 1 - SEAM_LOOK.whiteFrom, p), banded: true, held: true, swapped: false }),
  settle: (p: number): SeamLook => {
    const fade: number = (1 - p) * (1 - p);
    return { split: SEAM_LOOK.settleSplit * fade, slip: SEAM_LOOK.settleSlip * fade, density: SEAM_LOOK.settleDensity * fade, tear: 0, blocks: 0, white: 0, banded: true, held: false, swapped: false };
  },
};

const GENTLE: Readonly<Record<SeamPhase, (p: number) => SeamLook>> = {
  build_up: (): SeamLook => whiteOnly(0, false, false),
  tear: (p: number): SeamLook => whiteOnly(smooth(0, 1, p), false, false),
  mist: (p: number): SeamLook => whiteOnly(Math.max(1 - smooth(0, SEAM_LOOK.mistReveal * 2, p), smooth(1 - SEAM_LOOK.mistVeil * 2, 1, p)), true, false),
  tear_back: (p: number): SeamLook => whiteOnly(1 - smooth(0, 1, p), false, false),
  settle: (): SeamLook => whiteOnly(0, false, false),
};

export function seamLook(moment: SeamMoment, soft: boolean): SeamLook {
  return (soft ? GENTLE : TORN)[moment.phase](moment.progress);
}

export function hudTear(look: SeamLook): HudTear {
  return { split: (look.split / SEAM_LOOK.tearSplit) * SEAM_LOOK.hudSplitPixels, tear: Math.min(1, look.tear + look.slip / SEAM_LOOK.tearSlip * 0.3) * SEAM_LOOK.hudTearPixels };
}
