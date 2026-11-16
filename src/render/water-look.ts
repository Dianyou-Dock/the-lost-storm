import { Color } from 'three';
import type { Vec2 } from '../../sim/math.ts';
import type { SkillVfx, VfxShadow } from '../../sim/content/vfx-types.ts';
import type { BurstOptions } from './particles.ts';

export const WATER_LOOK = {
  splashHeight: 0.45,
  splashDrops: 14,
  lapEvery: 0.3,
  lapReach: 0.85,
  lapDrops: 3,
  lapRingMin: 1.1,
  lapRingMax: 1.9,
  lapRingTime: 1.1,
  lapRingShine: 0.16,
  surface: 0.08,
  swellReach: 0.9,
  swellShine: 0.22,
  swellTime: 0.9,
} as const;

const SPLASH: Partial<BurstOptions> = { speed: { min: 0.6, max: 2.2 }, lift: { min: 2.5, max: 4.5 }, life: { min: 0.45, max: 0.75 }, size: { min: 0.12, max: 0.26 }, gravity: 11, drag: 0.4, jitter: 0.2 };
const LAP: Partial<BurstOptions> = { speed: { min: 0.1, max: 0.6 }, lift: { min: 0.8, max: 1.6 }, life: { min: 0.3, max: 0.5 }, size: { min: 0.1, max: 0.2 }, gravity: 9, drag: 0.5, jitter: 0.15 };

export interface WaterKit {
  readonly spray: (x: number, y: number, z: number, color: Color, count: number, overrides: Partial<BurstOptions>) => void;
  readonly ring: (x: number, z: number, radius: number, color: Color, duration: number) => void;
}

export function poolOf(vfx: SkillVfx): VfxShadow | null {
  if (vfx.shadow !== null) return vfx.shadow;
  if (vfx.water !== null) return { color: vfx.water.deep, strength: vfx.water.depth };
  return null;
}

export function splash(kit: WaterKit, at: Vec2, foam: Color): void {
  kit.spray(at.x, WATER_LOOK.splashHeight, at.z, foam, WATER_LOOK.splashDrops, SPLASH);
}

export function lapSpot(center: Vec2, radius: number, angle: number, share: number): Vec2 {
  const reach: number = Math.sqrt(share) * radius * WATER_LOOK.lapReach;
  return { x: center.x + Math.sin(angle) * reach, z: center.z + Math.cos(angle) * reach };
}

export function lap(kit: WaterKit, center: Vec2, radius: number, foam: Color, random: () => number): void {
  const spot: Vec2 = lapSpot(center, radius, random() * Math.PI * 2, random());
  kit.ring(spot.x, spot.z, WATER_LOOK.lapRingMin + random() * (WATER_LOOK.lapRingMax - WATER_LOOK.lapRingMin), new Color().copy(foam).multiplyScalar(WATER_LOOK.lapRingShine), WATER_LOOK.lapRingTime);
  kit.spray(spot.x, WATER_LOOK.surface, spot.z, foam, WATER_LOOK.lapDrops, LAP);
}

export function swell(kit: WaterKit, center: Vec2, radius: number, foam: Color): void {
  kit.ring(center.x, center.z, radius * WATER_LOOK.swellReach, new Color().copy(foam).multiplyScalar(WATER_LOOK.swellShine), WATER_LOOK.swellTime);
}
