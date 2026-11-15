import type { IUniform, Texture, Vector3 } from 'three';
import { ClampToEdgeWrapping, DataTexture, DataUtils, HalfFloatType, LinearFilter, RedFormat, Vector4 } from 'three';
import type { ZoneDef } from '../../sim/content/types.ts';
import { heightAt, TERRAIN, terrainMap, tileHeight } from '../../sim/nav/terrain.ts';

export const TERRAIN_LIFT = {
  texel: 0.5,
  hold: 1.7,
  stepFrom: 1.05,
  stepTo: 1.6,
  slopeFrom: TERRAIN.slope,
  slopeTo: TERRAIN.slope * 2,
  feel: 0.6,
  breakScale: 0.9,
  breakDepth: 0.3,
  flightGlide: 7,
} as const;

export interface LiftUniforms {
  readonly uLiftMap: IUniform<Texture | null>;
  readonly uLiftArea: IUniform<Vector4>;
  readonly uLiftOn: IUniform<number>;
}

export const LIFT_UNIFORMS: LiftUniforms = {
  uLiftMap: { value: null },
  uLiftArea: { value: new Vector4(0, 0, 1, 1) },
  uLiftOn: { value: 0 },
};

const liftGlsl = (value: number): string => value.toFixed(4);

export const LIFT_COMMON: readonly string[] = [
  'uniform sampler2D uLiftMap;',
  'uniform vec4 uLiftArea;',
  'uniform float uLiftOn;',
  'varying vec3 vLiftWorld;',
  'varying float vLiftBase;',
  'float liftOf(vec2 xz) { return texture2D(uLiftMap, (xz - uLiftArea.xy) / uLiftArea.zw).r; }',
];

export const LIFT_VERTEX: readonly string[] = [
  ...LIFT_COMMON,
  'vec4 liftedWorld(vec3 local) {',
  '  vec4 world = modelMatrix * vec4(local, 1.0);',
  '  vLiftBase = 0.0;',
  '  if (uLiftOn > 0.5) {',
  '    vLiftBase = liftOf((modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz);',
  '    float rise = liftOf(world.xz) - vLiftBase;',
  `    world.y += abs(rise) < ${liftGlsl(TERRAIN_LIFT.hold)} ? rise : 0.0;`,
  '  }',
  '  vLiftWorld = world.xyz;',
  '  return world;',
  '}',
];

export const LIFT_FRAGMENT: readonly string[] = [
  ...LIFT_COMMON,
  'float liftFade(float grain) {',
  '  if (uLiftOn < 0.5) return 1.0;',
  '  vec2 p = vLiftWorld.xz;',
  `  float s = ${liftGlsl(TERRAIN_LIFT.feel)};`,
  '  float c = liftOf(p);',
  '  float e = liftOf(p + vec2(s, 0.0));',
  '  float w = liftOf(p - vec2(s, 0.0));',
  '  float n = liftOf(p + vec2(0.0, s));',
  '  float b = liftOf(p - vec2(0.0, s));',
  '  float step = (abs(c - vLiftBase) * 2.0 + abs(e - vLiftBase) + abs(w - vLiftBase) + abs(n - vLiftBase) + abs(b - vLiftBase)) / 6.0;',
  '  float slope = length(vec2(e - w, n - b)) / (2.0 * s);',
  `  float broken = 1.0 + (grain - 0.5) * ${liftGlsl(TERRAIN_LIFT.breakDepth * 2)};`,
  `  return (1.0 - smoothstep(${liftGlsl(TERRAIN_LIFT.stepFrom)}, ${liftGlsl(TERRAIN_LIFT.stepTo)}, step * broken)) * (1.0 - smoothstep(${liftGlsl(TERRAIN_LIFT.slopeFrom)}, ${liftGlsl(TERRAIN_LIFT.slopeTo)}, slope * broken));`,
  '}',
];

let shownZone: ZoneDef | null = null;

export function liftHere(x: number, z: number): number {
  return shownZone === null ? 0 : liftAt(shownZone, x, z);
}

export function floorUp(x: number, up: number, z: number): number {
  return up + liftHere(x, z);
}

export function glideFloor(current: number | undefined, x: number, z: number, dt: number): number {
  const below: number = liftHere(x, z);
  if (current === undefined) return below;
  return current + (below - current) * (1 - Math.exp(-TERRAIN_LIFT.flightGlide * dt));
}

export function liftAt(zone: ZoneDef, x: number, z: number): number {
  return heightAt(zone, x, z) - zone.floorHeight;
}

export function tileLift(zone: ZoneDef, column: number, row: number, x: number, z: number): number {
  return tileHeight(zone, column, row, x, z) - zone.floorHeight;
}

export function liftSamples(zone: ZoneDef, texel: number): { readonly width: number; readonly depth: number; readonly values: Float32Array } {
  const width: number = Math.max(1, Math.ceil(((zone.tiles[0]?.length ?? 0) * zone.cellSize) / texel));
  const depth: number = Math.max(1, Math.ceil((zone.tiles.length * zone.cellSize) / texel));
  const values: Float32Array = new Float32Array(width * depth);
  for (let row: number = 0; row < depth; row += 1) {
    for (let column: number = 0; column < width; column += 1) values[row * width + column] = liftAt(zone, (column + 0.5) * texel, (row + 0.5) * texel);
  }
  return { width, depth, values };
}

export function useTerrain(zone: ZoneDef): void {
  const old: Texture | null = LIFT_UNIFORMS.uLiftMap.value;
  shownZone = terrainMap(zone) === null ? null : zone;
  if (shownZone === null) {
    LIFT_UNIFORMS.uLiftOn.value = 0;
    LIFT_UNIFORMS.uLiftMap.value = null;
    old?.dispose();
    return;
  }
  const { width, depth, values } = liftSamples(zone, TERRAIN_LIFT.texel);
  const half: Uint16Array = Uint16Array.from(values, (value: number): number => DataUtils.toHalfFloat(value));
  const texture: DataTexture = new DataTexture(half, width, depth, RedFormat, HalfFloatType);
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.needsUpdate = true;
  LIFT_UNIFORMS.uLiftMap.value = texture;
  LIFT_UNIFORMS.uLiftArea.value.set(0, 0, width * TERRAIN_LIFT.texel, depth * TERRAIN_LIFT.texel);
  LIFT_UNIFORMS.uLiftOn.value = 1;
  old?.dispose();
}

export interface RayLike {
  readonly origin: { readonly x: number; readonly y: number; readonly z: number };
  readonly direction: { readonly x: number; readonly y: number; readonly z: number };
}

export const RAY_MARCH = {
  step: 0.25,
  reach: 600,
  refine: 12,
} as const;

export type PassThrough = (x: number, y: number, z: number) => boolean;

export function rayToSurface(ray: RayLike, heightOf: (x: number, z: number) => number, out: Vector3, through: PassThrough | null = null): Vector3 | null {
  const { origin, direction } = ray;
  const side = (t: number): boolean | null => {
    const height: number = heightOf(origin.x + direction.x * t, origin.z + direction.z * t);
    return Number.isNaN(height) ? null : origin.y + direction.y * t > height;
  };
  let low: number = side(0) === true ? 0 : -1;
  for (let t: number = RAY_MARCH.step; t <= RAY_MARCH.reach; t += RAY_MARCH.step) {
    const now: boolean | null = side(t);
    if (now === true) {
      low = t;
      continue;
    }
    if (now === null) {
      low = -1;
      continue;
    }
    if (low < 0) continue;
    let near: number = low;
    let far: number = t;
    for (let pass: number = 0; pass < RAY_MARCH.refine; pass += 1) {
      const middle: number = (near + far) / 2;
      if (side(middle) !== false) near = middle;
      else far = middle;
    }
    const at: number = (near + far) / 2;
    const x: number = origin.x + direction.x * at;
    const z: number = origin.z + direction.z * at;
    const y: number = heightOf(x, z);
    if (through !== null && through(x, y, z)) {
      low = -1;
      continue;
    }
    return out.set(x, y, z);
  }
  return null;
}

export type FloorTest = (x: number, y: number, z: number) => boolean;

export function rayToFloor(ray: RayLike, heightOf: (x: number, z: number) => number, isFloor: FloorTest, out: Vector3, through: PassThrough | null = null): Vector3 | null {
  const rock: PassThrough = (x: number, y: number, z: number): boolean => !isFloor(x, y, z);
  const seen: PassThrough = (x: number, y: number, z: number): boolean => !isFloor(x, y, z) || (through !== null && through(x, y, z));
  return rayToSurface(ray, heightOf, out, seen) ?? (through === null ? null : rayToSurface(ray, heightOf, out, rock)) ?? rayToSurface(ray, heightOf, out, through);
}
