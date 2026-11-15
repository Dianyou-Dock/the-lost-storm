import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3 } from 'three';
import { roadZone } from '../../test/road-support.ts';
import type { Content, ZoneDef } from '../../sim/content/types.ts';
import { loadContent } from '../../sim/content/content.ts';
import { TERRAIN_MARKS } from '../../sim/content/terrain-types.ts';
import { isFloorCell } from '../../sim/nav/layout.ts';
import { heightAt } from '../../sim/nav/terrain.ts';
import { floorUp, glideFloor, liftAt, liftHere, liftSamples, rayToSurface, tileLift, useTerrain } from './terrain-lift.ts';

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

function caveTerraces(zone: ZoneDef): readonly { readonly x: number; readonly z: number; readonly height: number }[] {
  const levels: readonly string[] = zone.terrain?.levels ?? [];
  const rise: number = zone.terrain?.rise ?? 0;
  const found: Map<string, { readonly x: number; readonly z: number; readonly height: number }> = new Map();
  for (let row: number = 1; row < levels.length - 1; row += 1) {
    const line: string = levels[row] ?? '';
    for (let column: number = 1; column < line.length - 1; column += 1) {
      const mark: string = line.charAt(column);
      const level: number = TERRAIN_MARKS.levels.indexOf(mark);
      if (level < 0 || found.has(mark)) continue;
      let interior: boolean = true;
      for (let dr: number = -1; dr <= 1; dr += 1) {
        for (let dc: number = -1; dc <= 1; dc += 1) {
          if ((levels[row + dr] ?? '').charAt(column + dc) !== mark || !isFloorCell(zone, column + dc, row + dr)) interior = false;
        }
      }
      if (interior) found.set(mark, { x: (column + 0.5) * zone.cellSize, z: (row + 0.5) * zone.cellSize, height: zone.floorHeight + level * rise });
    }
  }
  return [...found.values()];
}

void test('every effect height on a cave terrace stands on that terrace, and a flat zone keeps it as given', (): void => {
  const content: Content = loadContent();
  const cave: ZoneDef | undefined = content.zones.get('under_hall');
  const hall: ZoneDef | undefined = content.zones.get('hall_of_time');
  assert.ok(cave !== undefined && hall !== undefined);
  const terraces = caveTerraces(cave);
  assert.ok(terraces.length >= 3, `found ${terraces.length} terraces`);
  useTerrain(cave);
  for (const terrace of terraces) {
    assert.ok(Math.abs(floorUp(terrace.x, 1.25, terrace.z) - (terrace.height + 1.25)) < 1e-6, `terrace at ${terrace.height}`);
    assert.ok(Math.abs(floorUp(terrace.x, 0, terrace.z) - heightAt(cave, terrace.x, terrace.z)) < 1e-6);
  }
  useTerrain(hall);
  for (const terrace of terraces) assert.equal(floorUp(terrace.x, 1.25, terrace.z), 1.25);
});

void test('a bolt flying off a terrace glides down to the lower floor instead of dropping in one frame', (): void => {
  useTerrain(STAIR);
  let flight: number = glideFloor(undefined, 22, 2, 1 / 60);
  assert.equal(flight, 2);
  flight = glideFloor(flight, 2, 2, 1 / 60);
  assert.ok(flight > 1.7 && flight < 2, `after one frame ${flight}`);
  for (let frame: number = 0; frame < 120; frame += 1) flight = glideFloor(flight, 2, 2, 1 / 60);
  assert.ok(flight < 0.01, `after two seconds ${flight}`);
  useTerrain(FLAT);
});
