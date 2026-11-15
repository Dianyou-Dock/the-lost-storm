import type { PitchRange } from '../../sim/content/audio.ts';

export const VARIATION = {
  pitchCents: 70,
  volumeSpread: 0.12,
  centsPerOctave: 1200,
  recentBarred: 2,
} as const;

export interface VariantBag {
  next(sound: string, count: number): number;
}

function barredCount(count: number): number {
  return Math.min(VARIATION.recentBarred, count - 1);
}

export function pickVariant(count: number, recent: readonly number[], random: () => number): number {
  if (count <= 1) return 0;
  const barred: ReadonlySet<number> = new Set<number>(recent.slice(-barredCount(count)));
  const open: number[] = [];
  for (let index: number = 0; index < count; index += 1) {
    if (!barred.has(index)) open.push(index);
  }
  const chosen: number | undefined = open[Math.min(open.length - 1, Math.floor(random() * open.length))];
  return chosen ?? 0;
}

export function createVariantBag(random: () => number): VariantBag {
  const recent: Map<string, readonly number[]> = new Map<string, readonly number[]>();
  return {
    next(sound: string, count: number): number {
      const history: readonly number[] = (recent.get(sound) ?? []).filter((index: number): boolean => index < count);
      const variant: number = pickVariant(count, history, random);
      recent.set(sound, [...history, variant].slice(-VARIATION.recentBarred));
      return variant;
    },
  };
}

export function pitchRate(random: () => number, range: PitchRange | null = null): number {
  if (range !== null) return range.min + random() * (range.max - range.min);
  const cents: number = (random() * 2 - 1) * VARIATION.pitchCents;
  return 2 ** (cents / VARIATION.centsPerOctave);
}

export function volumeScale(random: () => number, jitter: number | null = null): number {
  return 1 + (random() * 2 - 1) * (jitter ?? VARIATION.volumeSpread);
}

export function delayBetween(minimum: number, maximum: number, random: () => number): number {
  return minimum + random() * (maximum - minimum);
}
