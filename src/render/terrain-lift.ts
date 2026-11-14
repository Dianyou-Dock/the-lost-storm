import type { IUniform, Texture, Vector3 } from 'three';
import { ClampToEdgeWrapping, DataTexture, DataUtils, HalfFloatType, LinearFilter, RedFormat, Vector4 } from 'three';
import type { ZoneDef } from '../../sim/content/types.ts';
import { heightAt, terrainMap, tileHeight } from '../../sim/nav/terrain.ts';

export const TERRAIN_LIFT = {
  texel: 0.5,
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

export const LIFT_VERTEX: readonly string[] = [
  'uniform sampler2D uLiftMap;',
  'uniform vec4 uLiftArea;',
  'uniform float uLiftOn;',
  'vec4 liftedWorld(vec3 local) {',
  '  vec4 world = modelMatrix * vec4(local, 1.0);',
  '  if (uLiftOn > 0.5) world.y += texture2D(uLiftMap, (world.xz - uLiftArea.xy) / uLiftArea.zw).r;',
  '  return world;',
  '}',
];

let shownZone: ZoneDef | null = null;

export function liftHere(x: number, z: number): number {
  return shownZone === null ? 0 : liftAt(shownZone, x, z);
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

export function rayToSurface(ray: RayLike, heightOf: (x: number, z: number) => number, out: Vector3): Vector3 | null {
  const { origin, direction } = ray;
  const above = (t: number): boolean => origin.y + direction.y * t > heightOf(origin.x + direction.x * t, origin.z + direction.z * t);
  if (!above(0)) return null;
  let low: number = 0;
  let high: number = -1;
  for (let t: number = RAY_MARCH.step; t <= RAY_MARCH.reach; t += RAY_MARCH.step) {
    if (above(t)) {
      low = t;
      continue;
    }
    high = t;
    break;
  }
  if (high < 0) return null;
  for (let pass: number = 0; pass < RAY_MARCH.refine; pass += 1) {
    const middle: number = (low + high) / 2;
    if (above(middle)) low = middle;
    else high = middle;
  }
  const t: number = (low + high) / 2;
  const x: number = origin.x + direction.x * t;
  const z: number = origin.z + direction.z * t;
  return out.set(x, heightOf(x, z), z);
}
