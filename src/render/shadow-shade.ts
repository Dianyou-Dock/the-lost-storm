import type { Material } from 'three';
import type { VfxShadow } from '../../sim/content/vfx-types.ts';
import { isInvulnerable } from '../../sim/world/dash.ts';
import type { ActorState } from '../../sim/world/types.ts';

export const SHADOW_SHADE = {
  floor: 0.06,
  luma: 0.3,
  see: 0.45,
  rim: 1,
  rimPower: 2,
  stiffness: 260,
  damping: 30,
  settle: 0.002,
} as const;

export const SHADOW_UNIFORMS: string = 'uniform vec3 uShade;\nuniform float uShadeMix;';

export const SHADOW_BODY: readonly string[] = [
  'float shadeLuma = dot( diffuseColor.rgb, vec3( 0.299, 0.587, 0.114 ) );',
  `diffuseColor.rgb = mix( diffuseColor.rgb, uShade * ( ${SHADOW_SHADE.floor.toFixed(2)} + shadeLuma * ${SHADOW_SHADE.luma.toFixed(2)} ), uShadeMix );`,
  `diffuseColor.a *= 1.0 - uShadeMix * ${SHADOW_SHADE.see.toFixed(2)};`,
  'totalEmissiveRadiance *= 1.0 - uShadeMix;',
];

export const SHADOW_LIGHT: string = 'reflectedLight.directSpecular *= 1.0 - uShadeMix;\nreflectedLight.indirectSpecular *= 1.0 - uShadeMix;';

export function shadowRim(facing: string): string {
  return `uShade * pow( ${facing}, ${SHADOW_SHADE.rimPower.toFixed(2)} ) * ${SHADOW_SHADE.rim.toFixed(2)} * uShadeMix`;
}

export interface ShadeMotion {
  value: number;
  speed: number;
}

export function stepShade(motion: ShadeMotion, target: number, dt: number): void {
  const pull: number = SHADOW_SHADE.stiffness * (target - motion.value) - SHADOW_SHADE.damping * motion.speed;
  motion.speed += pull * dt;
  motion.value += motion.speed * dt;
  if (Math.abs(target - motion.value) < SHADOW_SHADE.settle && Math.abs(motion.speed) < SHADOW_SHADE.settle) {
    motion.value = target;
    motion.speed = 0;
  }
  motion.value = Math.min(1, Math.max(0, motion.value));
}

export function seeThrough(materials: readonly Material[], see: boolean): void {
  for (const material of materials) {
    if (material.transparent === see) continue;
    material.transparent = see;
    material.needsUpdate = true;
  }
}

export function shadowOf(actor: ActorState): VfxShadow | null {
  if (actor.action === null || !isInvulnerable(actor)) return null;
  return actor.action.skill.vfx.shadow;
}
