import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadContent } from '../../sim/content/content.ts';
import type { Content, ZoneDef } from '../../sim/content/types.ts';
import { buildNavGrid, isWalkable } from '../../sim/nav/grid.ts';
import type { NavGrid } from '../../sim/nav/grid.ts';
import type { TerrainSight } from './terrain-sight.ts';
import { cameraEye, createTerrainSight, drawsTerrain, heroHidden } from './terrain-sight.ts';
import { liftAt } from './terrain-lift.ts';

const content: Content = loadContent();

interface Tally {
  readonly walkable: number;
  readonly hidden: number;
  readonly cutHidden: readonly string[];
}

function sweep(zone: ZoneDef, sight: TerrainSight): Tally {
  const grid: NavGrid = buildNavGrid(zone, content.props, content.surfaces, content.player.radius);
  const width: number = (zone.tiles[0]?.length ?? 0) * zone.cellSize;
  const depth: number = zone.tiles.length * zone.cellSize;
  let walkable: number = 0;
  let hidden: number = 0;
  const cutHidden: string[] = [];
  for (let z: number = 0.5; z < depth; z += 1) {
    for (let x: number = 0.5; x < width; x += 1) {
      if (!isWalkable(grid, x, z)) continue;
      walkable += 1;
      if (!heroHidden(sight, zone, x, z, false)) continue;
      hidden += 1;
      if (heroHidden(sight, zone, x, z, true)) cutHidden.push(`${x},${z}`);
    }
  }
  return { walkable, hidden, cutHidden };
}

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

void test('the cave rock hides the hero somewhere on the cave floor, and with the terrain cutaway it hides him nowhere in any zone', (): void => {
  let hiddenWithout: number = 0;
  for (const zone of content.zones.values()) {
    const sight: TerrainSight | null = createTerrainSight(zone);
    if (sight === null) continue;
    const tally: Tally = sweep(zone, sight);
    hiddenWithout += tally.hidden;
    assert.deepEqual(tally.cutHidden, [], `${zone.id}: hero hidden at ${tally.cutHidden.slice(0, 12).join(' ')} of ${tally.walkable} m²`);
  }
  assert.ok(hiddenWithout > 0);
});
