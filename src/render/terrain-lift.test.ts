import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3 } from 'three';
import { roadZone } from '../../test/road-support.ts';
import type { ZoneDef } from '../../sim/content/types.ts';
import { liftAt, liftHere, liftSamples, rayToSurface, tileLift, useTerrain } from './terrain-lift.ts';

const SIZE = 4;
const STAIR: ZoneDef = roadZone({
  id: 'stair_lift_test',
  cellSize: SIZE,
  floorHeight: 0.5,
  tiles: ['wwwwww', 'wwwwww'],
  terrain: { rise: 1, levels: ['000/22', '000/22'], cliff: 'road_firm', rough: null, blends: [], cliffs: [] },
});
function heightOf(x: number, z: number): number {
  return liftAt(STAIR, x, z);
}

const FLAT: ZoneDef = roadZone({ id: 'flat_lift_test', cellSize: SIZE, tiles: ['ww'] });

void test('the lift is the terrain height above the zone floor, and a flat zone lifts nothing', (): void => {
  assert.equal(liftAt(STAIR, 2, 2), 0);
  assert.equal(liftAt(STAIR, 22, 2), 2);
  assert.equal(liftAt(STAIR, 3 * SIZE + SIZE / 2, 2), 1);
  assert.equal(liftAt(FLAT, 2, 2), 0);
});

void test('each tile keeps its own height at a shared edge, so a cliff has a top and a foot', (): void => {
  const edge: number = 3 * SIZE + SIZE;
  assert.equal(tileLift(STAIR, 3, 0, edge, 2), 2);
  assert.equal(tileLift(STAIR, 2, 0, 3 * SIZE, 2), 0);
});

void test('the lift map samples every texel of the zone, high on the upper terrace and low on the lower', (): void => {
  const texel: number = 1;
  const { width, depth, values } = liftSamples(STAIR, texel);
  assert.equal(width, 6 * SIZE);
  assert.equal(depth, 2 * SIZE);
  assert.equal(values[0], 0);
  assert.equal(values[width - 1], 2);
  const middle: number | undefined = values[3 * SIZE + SIZE / 2];
  assert.ok(middle !== undefined && middle > 0 && middle < 2);
});

void test('a ground effect drawn on the stair rises with it, and stops rising when a flat zone is shown', (): void => {
  useTerrain(STAIR);
  assert.equal(liftHere(22, 2), 2);
  assert.equal(liftHere(3 * SIZE + SIZE / 2, 2), 1);
  useTerrain(FLAT);
  assert.equal(liftHere(22, 2), 0);
});

void test('a click ray finds the upper terrace before the floor beneath it', (): void => {
  const ray = { origin: { x: 22, y: 10, z: 2 }, direction: { x: -0.2, y: -1, z: 0 } };
  const hit: Vector3 | null = rayToSurface(ray, heightOf, new Vector3());
  assert.ok(hit !== null);
  assert.ok(Math.abs(hit.y - 2) < 0.01, `hit at ${hit.y}`);
  assert.ok(Math.abs(hit.x - 20.4) < 0.05, `hit at ${hit.x}`);
  const below = { origin: { x: 22, y: -1, z: 2 }, direction: { x: 0, y: -1, z: 0 } };
  assert.equal(rayToSurface(below, heightOf, new Vector3()), null);
});
