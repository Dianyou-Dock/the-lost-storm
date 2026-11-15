import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadContent } from '../../sim/content/content.ts';
import type { Content, ZoneDef } from '../../sim/content/types.ts';
import type { TerrainSight } from './terrain-sight.ts';
import { cameraEye, createTerrainSight, drawsTerrain } from './terrain-sight.ts';
import { liftAt } from './terrain-lift.ts';

const content: Content = loadContent();

function caves(): ZoneDef {
  const zone: ZoneDef | undefined = content.zones.get('under_hall');
  assert.ok(zone !== undefined);
  return zone;
}

void test('a sight line over open floor is clear, and one into a rock shelf is blocked unless the cutaway clears that crossing', (): void => {
  const zone: ZoneDef = caves();
  const sight: TerrainSight | null = createTerrainSight(zone);
  assert.ok(sight !== null);
  const start = zone.playerStart;
  const eye = cameraEye(zone, start.x, start.z);
  const target = { x: start.x, y: liftAt(zone, start.x, start.z) + 1.3, z: start.z };
  assert.equal(sight.blocks(eye, target, null), false);
  const low = { x: target.x, y: target.y - 60, z: target.z };
  assert.equal(sight.blocks(eye, low, null), true);
  assert.equal(sight.blocks(eye, low, (): boolean => true), false);
});

void test('a zone drawn without a terrain heightfield has no terrain sight', (): void => {
  for (const zone of content.zones.values()) assert.equal(createTerrainSight(zone) === null, !drawsTerrain(zone));
});
