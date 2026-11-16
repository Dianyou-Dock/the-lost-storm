import assert from 'node:assert/strict';
import { test } from 'node:test';
import hourfall from '../../data/kits/hourfall.json' with { type: 'json' };
import { loadContent } from '../content/content.ts';
import { TERRAIN_MARKS } from '../content/terrain-types.ts';
import type { Content, ZoneDef } from '../content/types.ts';
import { distance } from '../math.ts';
import { screenLoad } from './checks.ts';
import type { CaveLayout, CaveRequest, CaveResult, ScreenLimit } from './generate.ts';
import { CAVE_GEN, generateCave } from './generate.ts';
import type { CaveKit } from './kit.ts';
import { readKit } from './kit.ts';

const content: Content = loadContent();
const kit: CaveKit = readKit(hourfall, 'hourfall');
const reference: ZoneDef | undefined = content.zones.get('under_hall');
assert.ok(reference !== undefined);
const limit: ScreenLimit = screenLoad(content, reference);
const SEEDS: readonly number[] = [1, 2, 3, 4, 5, 6];

function request(seed: number): CaveRequest {
  return { seed, columns: 110, rows: 110, chambers: 10, levels: { from: 14, to: 17 }, packs: 20, packScale: 1, screen: limit };
}

function made(seed: number): CaveLayout {
  const result: CaveResult = generateCave(request(seed), { kit, defs: content.props, judge: null });
  assert.ok(result.ok, result.ok ? '' : `seed ${seed}: ${result.problem}`);
  return result.layout;
}

const layouts: readonly CaveLayout[] = SEEDS.map(made);

void test('the same seed makes the same cave and another seed makes a different one', (): void => {
  assert.deepEqual(made(1), layouts[0]);
  assert.notDeepEqual(layouts[0]?.tiles, layouts[1]?.tiles);
});

void test('packs stand the cave spacing apart, at the band level for their depth, and the waypoint sits near the entrance', (): void => {
  for (const layout of layouts) {
    assert.equal(layout.packs.length, 20);
    layout.packs.forEach((pack, at: number): void => {
      assert.ok(pack.level >= 14 && pack.level <= 17);
      for (const other of layout.packs.slice(at + 1)) assert.ok(distance(pack, other) >= CAVE_GEN.packApart);
    });
    assert.ok(distance(layout.waypoint, layout.start) <= CAVE_GEN.waypointAway.most);
    assert.ok(distance(layout.descent, layout.entrance) > distance(layout.waypoint, layout.entrance));
  }
});

void test('each level change is one ramp with level ground at both ends and two stairs on it, and the level map marks it', (): void => {
  for (const layout of layouts) {
    assert.equal(layout.passages.length, layout.chambers.length - 1);
    assert.equal(layout.props.filter((placed): boolean => placed.prop === kit.stairs.prop).length, layout.passages.length * 2);
    for (const passage of layout.passages) {
      const { ramp } = passage;
      const step: number = ramp.start;
      const mark: string | undefined = ramp.axis === 'z' ? layout.levels[step]?.charAt(ramp.line) : layout.levels[ramp.line]?.charAt(step);
      assert.equal(mark, TERRAIN_MARKS.ramp);
    }
    assert.equal(layout.levels.length, layout.tiles.length);
  }
});

void test('more chambers than the terraces can hold, no packs, or a kit naming a prop the game lacks are refused with the reason', (): void => {
  const deep: CaveResult = generateCave({ ...request(1), chambers: 16 }, { kit, defs: content.props, judge: null });
  assert.ok(!deep.ok && deep.problem.includes('chambers'));
  const empty: CaveResult = generateCave({ ...request(1), packs: 0 }, { kit, defs: content.props, judge: null });
  assert.ok(!empty.ok && empty.problem.includes('pack'));
  const typo: CaveResult = generateCave(request(1), { kit: { ...kit, caches: [...kit.caches, 'no_such_cache'] }, defs: content.props, judge: null });
  assert.ok(!typo.ok && typo.problem.includes('no_such_cache'));
  const plain: CaveResult = generateCave(request(1), { kit: { ...kit, caches: [kit.stairs.prop] }, defs: content.props, judge: null });
  assert.ok(!plain.ok && plain.problem.includes('not caches'));
});

void test('a cave too small for its chambers is refused, not squeezed', (): void => {
  const result: CaveResult = generateCave({ ...request(1), columns: 40, rows: 40 }, { kit, defs: content.props, judge: null });
  assert.equal(result.ok, false);
});
