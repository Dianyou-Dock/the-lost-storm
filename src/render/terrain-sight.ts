import { PerspectiveCamera, Ray, Vector3 } from 'three';
import { heightAt } from '../../sim/nav/terrain.ts';
import type { ZoneDef } from '../../sim/content/types.ts';
import type { Field } from './ground-terrain.ts';
import { GROUND_TERRAIN, sampleField, shownTiles } from './ground-terrain.ts';
import { CAMERA } from './iso-camera.ts';
import { CUTAWAY, frontWeight, highWeight, ringWeight, terrainHides, throughWindow } from './prop-cutaway.ts';
import type { PassThrough } from './terrain-lift.ts';
import { liftAt, rayToSurface } from './terrain-lift.ts';

export const TERRAIN_SIGHT = {
  march: 0.1,
  nearTarget: 0.4,
  reach: 2,
  heights: [0.15, 0.95, 1.75],
  aspect: 16 / 9,
  near: 1,
  far: 220,
} as const;

export interface Point3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type CrossingCut = (x: number, y: number, z: number) => boolean;

export interface TerrainSight {
  drawnHeight(x: number, z: number): number | null;
  blocks(eye: Point3, target: Point3, cut: CrossingCut | null): boolean;
}

export function drawsTerrain(zone: ZoneDef): boolean {
  return zone.terrain !== null && zone.terrain.rough !== null;
}

interface Drawn {
  readonly field: Field;
  readonly shown: Uint8Array;
  readonly columns: number;
  readonly cellSize: number;
}

function heightIn(drawn: Drawn, x: number, z: number): number | null {
  const { field } = drawn;
  const fx: number = x / GROUND_TERRAIN.step;
  const fz: number = z / GROUND_TERRAIN.step;
  const column: number = Math.floor(fx);
  const row: number = Math.floor(fz);
  if (column < 0 || row < 0 || column >= field.columns - 1 || row >= field.rows - 1) return null;
  if (drawn.shown[Math.floor(z / drawn.cellSize) * drawn.columns + Math.floor(x / drawn.cellSize)] !== 1) return null;
  const tx: number = fx - column;
  const tz: number = fz - row;
  const at = (c: number, r: number): number => field.heights[r * field.columns + c] ?? 0;
  const top: number = at(column, row) + (at(column + 1, row) - at(column, row)) * tx;
  const bottom: number = at(column, row + 1) + (at(column + 1, row + 1) - at(column, row + 1)) * tx;
  return top + (bottom - top) * tz;
}

const made: WeakMap<ZoneDef, TerrainSight> = new WeakMap<ZoneDef, TerrainSight>();

export function createTerrainSight(zone: ZoneDef): TerrainSight | null {
  if (!drawsTerrain(zone)) return null;
  const known: TerrainSight | undefined = made.get(zone);
  if (known !== undefined) return known;
  const drawn: Drawn = {
    field: sampleField(zone),
    shown: shownTiles(zone, Math.ceil(zone.outside?.reach ?? TERRAIN_SIGHT.reach)),
    columns: zone.tiles[0]?.length ?? 0,
    cellSize: zone.cellSize,
  };
  const sight: TerrainSight = {
    drawnHeight: (x: number, z: number): number | null => heightIn(drawn, x, z),
    blocks(eye: Point3, target: Point3, cut: CrossingCut | null): boolean {
      const length: number = Math.hypot(target.x - eye.x, target.y - eye.y, target.z - eye.z);
      const steps: number = Math.floor((length - TERRAIN_SIGHT.nearTarget) / TERRAIN_SIGHT.march);
      const start: number | null = heightIn(drawn, eye.x, eye.z);
      let above: boolean | null = start === null ? null : eye.y > start;
      for (let step: number = 1; step <= steps; step += 1) {
        const t: number = (step * TERRAIN_SIGHT.march) / length;
        const x: number = eye.x + (target.x - eye.x) * t;
        const y: number = eye.y + (target.y - eye.y) * t;
        const z: number = eye.z + (target.z - eye.z) * t;
        const ground: number | null = heightIn(drawn, x, z);
        const now: boolean | null = ground === null ? null : y > ground;
        if (above === true && now === false && (cut === null || !cut(x, y, z))) return true;
        above = now;
      }
      return false;
    },
  };
  made.set(zone, sight);
  return sight;
}

const view: PerspectiveCamera = new PerspectiveCamera(CAMERA.fov, TERRAIN_SIGHT.aspect, TERRAIN_SIGHT.near, TERRAIN_SIGHT.far);
const centre: Vector3 = new Vector3();
const projected: Vector3 = new Vector3();
const toView: Vector3 = new Vector3();

export function cameraEye(zone: ZoneDef, x: number, z: number): Vector3 {
  const yaw: number = (CAMERA.yawDegrees * Math.PI) / 180;
  const pitch: number = (CAMERA.pitchDegrees * Math.PI) / 180;
  const lookY: number = liftAt(zone, x, z) + CAMERA.lookHeight;
  return new Vector3(x + Math.sin(yaw) * Math.cos(pitch) * CAMERA.distance, lookY + Math.sin(pitch) * CAMERA.distance, z + Math.cos(yaw) * Math.cos(pitch) * CAMERA.distance);
}

function depthOf(x: number, y: number, z: number): number {
  return -toView.set(x, y, z).applyMatrix4(view.matrixWorldInverse).z;
}

export function heroHidden(sight: TerrainSight, zone: ZoneDef, x: number, z: number, cutaway: boolean): boolean {
  const floor: number = liftAt(zone, x, z);
  const eye: Vector3 = cameraEye(zone, x, z);
  view.position.copy(eye);
  view.lookAt(x, floor + CAMERA.lookHeight, z);
  view.updateMatrixWorld(true);
  const heroDepth: number = depthOf(x, floor + CUTAWAY.heroHeight, z);
  centre.set(x, floor + CUTAWAY.heroHeight, z).project(view);
  return TERRAIN_SIGHT.heights.every((height: number): boolean => {
    projected.set(x, floor + height, z).project(view);
    const ring: number = ringWeight(((projected.x - centre.x) * TERRAIN_SIGHT.aspect) / 2, (projected.y - centre.y) / 2);
    const cut: CrossingCut | null = cutaway ? (px: number, py: number, pz: number): boolean => ring * frontWeight(heroDepth, depthOf(px, py, pz)) * highWeight(py - floor) >= CUTAWAY.cleared : null;
    return sight.blocks(eye, { x, y: floor + height, z }, cut);
  });
}

export function clickHeight(zone: ZoneDef): (x: number, z: number) => number {
  const sight: TerrainSight | null = createTerrainSight(zone);
  if (sight === null) return (x: number, z: number): number => heightAt(zone, x, z);
  return (x: number, z: number): number => sight.drawnHeight(x, z) ?? Number.NaN;
}

const clickRay: Ray = new Ray();
const landed: Vector3 = new Vector3();

export function clickMiss(sight: TerrainSight, zone: ZoneDef, x: number, z: number, window: boolean): number {
  const floor: number = liftAt(zone, x, z);
  const eye: Vector3 = cameraEye(zone, x, z);
  view.position.copy(eye);
  view.lookAt(x, floor + CAMERA.lookHeight, z);
  view.updateMatrixWorld(true);
  const opened: boolean = window && terrainHides(sight, { x, z, floor }, eye);
  centre.set(x, floor + CUTAWAY.heroHeight, z).project(view);
  projected.set(x, floor, z).project(view);
  const through: PassThrough | null = opened
    ? throughWindow({ level: 1, depth: depthOf(x, floor + CUTAWAY.heroHeight, z), floor, across: ((projected.x - centre.x) / 2) * TERRAIN_SIGHT.aspect, up: (projected.y - centre.y) / 2, inverse: view.matrixWorldInverse })
    : null;
  clickRay.origin.copy(eye);
  clickRay.direction.set(x - eye.x, floor - eye.y, z - eye.z).normalize();
  const hit: Vector3 | null = rayToSurface(clickRay, clickHeight(zone), landed, through);
  return hit === null ? Number.POSITIVE_INFINITY : Math.hypot(hit.x - x, hit.z - z);
}
