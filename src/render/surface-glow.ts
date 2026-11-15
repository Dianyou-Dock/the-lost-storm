import type { IUniform, MeshStandardMaterial, WebGLProgramParametersWithUniforms } from 'three';
import { Color } from 'three';
import type { SurfaceGlow } from '../../sim/content/types.ts';
import { patchGroundShader, wetGroundKey } from './wet-ground.ts';

export const SURFACE_GLOW = {
  soft: 0.12,
  crustDarken: 0.45,
  pulseDepth: 0.3,
  crackFrom: 0.45,
  crackTo: 0.85,
  crackBlur: 4,
  veinWidth: 2.4,
  driftX: 0.6,
  driftZ: 0.8,
  secondScale: 1.7,
  secondDrift: -0.55,
  secondShift: 9.1,
  firstShare: 0.6,
} as const;

export const GLOW_CLOCK: IUniform<number> = { value: 0 };

export function tickGlow(time: number): void {
  GLOW_CLOCK.value = time;
}

function glsl(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : `${value}`;
}

function glslColour(hex: string, strength: number): string {
  const colour: Color = new Color(hex);
  return `vec3( ${glsl(colour.r * strength)}, ${glsl(colour.g * strength)}, ${glsl(colour.b * strength)} )`;
}

export function glowKey(glow: SurfaceGlow | null): string {
  return glow === null ? '' : `:glow-${glow.color}-${glow.strength}-${glow.cover}-${glow.cracks}-${glow.scale}-${glow.flow}-${glow.pulse}`;
}

export function glowFragment(glow: SurfaceGlow): string {
  const g = SURFACE_GLOW;
  const edge: number = 1 - glow.cover;
  const pulse: string = glow.pulse > 0 ? `1.0 - ${glsl(g.pulseDepth)} * 0.5 * ( 1.0 + sin( uGlowTime * ${glsl(glow.pulse * Math.PI * 2)} + glowFirst * 6.2832 ) )` : '1.0';
  return [
    `vec2 glowDrift = vec2( ${glsl(g.driftX)}, ${glsl(g.driftZ)} ) * uGlowTime * ${glsl(glow.flow)};`,
    `vec2 glowAt = vGroundXZ / ${glsl(glow.scale)};`,
    'float glowFirst = groundFbm( glowAt + glowDrift );',
    `float glowSecond = groundFbm( glowAt * ${glsl(g.secondScale)} + glowDrift * ${glsl(g.secondDrift)} + ${glsl(g.secondShift)} );`,
    `float glowVein = clamp( 1.0 - abs( glowFirst - glowSecond ) * ${glsl(g.veinWidth)}, 0.0, 1.0 );`,
    `float glowMolten = glowVein * ${glsl(g.firstShare)} + glowFirst * ${glsl(1 - g.firstShare)};`,
    'float glowLuma = 1.0;',
    '#ifdef USE_MAP',
    `  glowLuma = dot( texture2D( map, vMapUv ).rgb, vec3( 0.333 ) ) / max( dot( texture2D( map, vMapUv, ${glsl(g.crackBlur)} ).rgb, vec3( 0.333 ) ), 0.02 );`,
    '#endif',
    `float glowCrack = 1.0 - smoothstep( ${glsl(g.crackFrom)}, ${glsl(g.crackTo)}, glowLuma );`,
    `float glowMask = smoothstep( ${glsl(edge - g.soft)}, ${glsl(edge + g.soft)}, mix( glowMolten, glowCrack * ( 0.5 + glowMolten ), ${glsl(glow.cracks)} ) );`,
    `diffuseColor.rgb *= mix( 1.0, ${glsl(g.crustDarken)}, glowMask );`,
    `totalEmissiveRadiance += ${glslColour(glow.color, glow.strength)} * glowMask * ( ${pulse} );`,
  ].join('\n');
}

export function patchGlowShader(shader: Pick<WebGLProgramParametersWithUniforms, 'fragmentShader' | 'uniforms'>, glow: SurfaceGlow): void {
  shader.uniforms['uGlowTime'] = GLOW_CLOCK;
  shader.fragmentShader = shader.fragmentShader.replace('void main() {', 'uniform float uGlowTime;\nvoid main() {').replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${glowFragment(glow)}`);
}

export function glowingGround(material: MeshStandardMaterial, wet: number, glow: SurfaceGlow | null): void {
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms): void => {
    patchGroundShader(shader, wet);
    if (glow !== null) patchGlowShader(shader, glow);
  };
  material.customProgramCacheKey = (): string => `${wetGroundKey(wet)}${glowKey(glow)}`;
}
