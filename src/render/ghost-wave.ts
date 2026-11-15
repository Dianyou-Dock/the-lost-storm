import type { Color, Object3D } from 'three';
import { Group } from 'three';
import type { VfxRipple, VfxWave } from '../../sim/content/vfx-types.ts';
import type { Vec2 } from '../../sim/math.ts';
import { facingOf } from '../../sim/math.ts';
import { curveAt } from './gather-orb.ts';
import type { GroundLight, GroundLightForm, GroundLightLook } from './ground-light.ts';
import { createGroundLight, GROUND_LIGHT } from './ground-light.ts';
import type { BurstOptions } from './particles.ts';
import { floorUp } from './terrain-lift.ts';

export const GHOST_WAVE = {
  height: GROUND_LIGHT.height + 0.03,
  glow: 1.2,
  crest: 2.6,
  cover: 1.15,
  band: 0.4,
  wobble: 0.3,
  grain: 0.55,
  shadeWidth: 1.1,
  shadeGap: 0.9,
  shadeStrength: 0.7,
  rise: 0.06,
  settle: 0.18,
  rippleDim: 0.55,
  hush: 0.4,
  mistSizeMin: 0.35,
  mistSizeMax: 0.75,
  mistLifeMin: 0.45,
  mistLifeMax: 0.9,
  mistLiftMin: 0.5,
  mistLiftMax: 1.6,
  mistHeight: 0.25,
  mistCap: 8,
} as const;

export function riseIn(age: number): number {
  const t: number = Math.min(1, Math.max(0, age / GHOST_WAVE.rise));
  return t * t * (3 - 2 * t);
}

export function rippleReach(ripple: VfxRipple, age: number, speed: number): number {
  return (age - ripple.delay) * speed;
}

export function rippleLevel(ripple: VfxRipple, age: number, speed: number, reach: number): number {
  const travelled: number = rippleReach(ripple, age, speed);
  if (travelled <= 0 || reach <= 0) return 0;
  const share: number = travelled / reach;
  if (share >= 1) return ripple.strength * Math.max(0, 1 - (travelled - reach) / (speed * GHOST_WAVE.settle)) * (1 - GHOST_WAVE.rippleDim);
  return ripple.strength * riseIn(age - ripple.delay) * (1 - GHOST_WAVE.rippleDim * share);
}

export function hushed(look: VfxWave, age: number): number {
  const t: number = Math.min(1, Math.max(0, (age - (look.quiet - GHOST_WAVE.hush)) / GHOST_WAVE.hush));
  return 1 - t * t * (3 - 2 * t);
}

export function finished(look: VfxWave, age: number, speed: number, reach: number): boolean {
  const last: VfxRipple | undefined = look.ripples.at(-1);
  const leaves: number = last === undefined ? 0 : last.delay;
  return age >= look.quiet || age > leaves + reach / Math.max(speed, 0.001) + GHOST_WAVE.settle;
}

export interface GhostWaveKit {
  readonly parent: Object3D;
  readonly spray: (x: number, y: number, z: number, color: Color, count: number, overrides: Partial<BurstOptions>) => void;
}

export interface GhostWaves {
  launch(id: number, from: Vec2, direction: Vec2, look: VfxWave, color: Color, speed: number, range: number): void;
  carry(id: number, pos: Vec2): void;
  end(id: number, pos: Vec2): void;
  update(dt: number): void;
  clear(): void;
}

interface Front {
  readonly light: GroundLight;
  readonly shade: GroundLight;
}

interface Wave {
  readonly group: Group;
  readonly from: Vec2;
  readonly direction: Vec2;
  readonly look: VfxWave;
  readonly color: Color;
  readonly speed: number;
  readonly main: Front;
  readonly ripples: readonly Front[];
  range: number;
  front: number;
  age: number;
  ended: number | null;
  mistOwed: number;
}

export function crestArc(halfWidth: number): number {
  const radius: number = halfWidth * GHOST_WAVE.crest;
  return 2 * Math.asin(Math.min(1, (halfWidth * GHOST_WAVE.cover) / radius));
}

function frontOf(color: Color, look: VfxWave): Front {
  const radius: number = look.halfWidth * GHOST_WAVE.crest;
  const form: GroundLightForm = { kind: 'round', radius, inner: 0, arc: crestArc(look.halfWidth) };
  const glow: GroundLightLook = { fill: 0, band: 1, width: look.depth * GHOST_WAVE.band, wobble: look.halfWidth * GHOST_WAVE.wobble, grain: GHOST_WAVE.grain };
  const light: GroundLight = createGroundLight(color, form, glow);
  const shade: GroundLight = createGroundLight(color.clone().multiplyScalar(0.02), form, { ...glow, width: look.depth * GHOST_WAVE.shadeWidth }, 'shade');
  for (const ground of [light, shade]) {
    ground.mesh.rotation.z = Math.PI;
    ground.setNow(0);
  }
  return { light, shade };
}

function placeFront(front: Front, look: VfxWave, reach: number, strength: number, time: number, shaded: boolean): void {
  const radius: number = look.halfWidth * GHOST_WAVE.crest;
  front.light.mesh.position.z = reach - radius;
  front.light.pose(strength * GHOST_WAVE.glow, time);
  front.shade.mesh.position.z = reach - radius - GHOST_WAVE.shadeGap;
  front.shade.pose(shaded ? strength * GHOST_WAVE.shadeStrength : 0, time);
}

function disposeFront(front: Front): void {
  front.light.dispose();
  front.shade.dispose();
}

export function createGhostWaves(kit: GhostWaveKit): GhostWaves {
  const waves: Map<number, Wave> = new Map<number, Wave>();

  const mist = (wave: Wave, reach: number, strength: number, dt: number): void => {
    wave.mistOwed += wave.look.mist * strength * dt;
    let emitted: number = 0;
    while (wave.mistOwed >= 1 && emitted < GHOST_WAVE.mistCap) {
      wave.mistOwed -= 1;
      emitted += 1;
      const across: number = (Math.random() * 2 - 1) * wave.look.halfWidth;
      const along: number = reach - Math.random() * wave.look.depth;
      const x: number = wave.from.x + wave.direction.x * along + wave.direction.z * across;
      const z: number = wave.from.z + wave.direction.z * along - wave.direction.x * across;
      kit.spray(x, GHOST_WAVE.mistHeight, z, wave.color, 1, { dirX: wave.direction.x, dirZ: wave.direction.z, spread: 0.6, speed: { min: wave.speed * 0.1, max: wave.speed * 0.3 }, lift: { min: GHOST_WAVE.mistLiftMin, max: GHOST_WAVE.mistLiftMax }, life: { min: GHOST_WAVE.mistLifeMin, max: GHOST_WAVE.mistLifeMax }, size: { min: GHOST_WAVE.mistSizeMin, max: GHOST_WAVE.mistSizeMax }, gravity: -0.4, drag: 2.4, jitter: 0.3 });
    }
    wave.mistOwed = Math.min(wave.mistOwed, 1);
  };

  const drop = (id: number, wave: Wave): void => {
    disposeFront(wave.main);
    for (const ripple of wave.ripples) disposeFront(ripple);
    wave.group.removeFromParent();
    waves.delete(id);
  };

  return {
    launch(id: number, from: Vec2, direction: Vec2, look: VfxWave, color: Color, speed: number, range: number): void {
      const group: Group = new Group();
      group.position.set(from.x, floorUp(from.x, GHOST_WAVE.height, from.z), from.z);
      group.rotation.y = facingOf(direction);
      const main: Front = frontOf(color, look);
      const ripples: Front[] = look.ripples.map((): Front => frontOf(color, look));
      for (const front of [main, ...ripples]) group.add(front.shade.mesh, front.light.mesh);
      kit.parent.add(group);
      waves.set(id, { group, from: { x: from.x, z: from.z }, direction: { x: direction.x, z: direction.z }, look, color, speed, main, ripples, range, front: 0, age: 0, ended: null, mistOwed: 0 });
    },
    carry(id: number, pos: Vec2): void {
      const wave: Wave | undefined = waves.get(id);
      if (wave === undefined || wave.ended !== null) return;
      wave.front = Math.hypot(pos.x - wave.from.x, pos.z - wave.from.z);
    },
    end(id: number, pos: Vec2): void {
      const wave: Wave | undefined = waves.get(id);
      if (wave === undefined || wave.ended !== null) return;
      wave.front = Math.hypot(pos.x - wave.from.x, pos.z - wave.from.z);
      wave.range = Math.max(wave.front, 0.001);
      wave.ended = wave.age;
    },
    update(dt: number): void {
      for (const [id, wave] of waves) {
        wave.age += dt;
        const share: number = Math.min(1, wave.front / Math.max(wave.range, 0.001));
        const fading: number = wave.ended === null ? 1 : Math.max(0, 1 - (wave.age - wave.ended) / GHOST_WAVE.settle);
        const strength: number = curveAt(wave.look.swell, share) * riseIn(wave.age) * fading * hushed(wave.look, wave.age);
        placeFront(wave.main, wave.look, wave.front, strength, wave.age, true);
        if (strength > 0) mist(wave, wave.front, strength, dt);
        wave.look.ripples.forEach((ripple: VfxRipple, index: number): void => {
          const front: Front | undefined = wave.ripples[index];
          if (front === undefined) return;
          const level: number = rippleLevel(ripple, wave.age, wave.speed, wave.range) * hushed(wave.look, wave.age);
          const reach: number = Math.min(wave.range, Math.max(0, rippleReach(ripple, wave.age, wave.speed)));
          placeFront(front, wave.look, reach, level, wave.age + index, true);
          if (level > 0) mist(wave, reach, level, dt);
        });
        if (finished(wave.look, wave.age, wave.speed, wave.range)) drop(id, wave);
      }
    },
    clear(): void {
      for (const [id, wave] of waves) drop(id, wave);
    },
  };
}
