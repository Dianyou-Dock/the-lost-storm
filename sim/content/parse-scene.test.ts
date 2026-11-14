import assert from 'node:assert/strict';
import { test } from 'node:test';
import { must } from '../../test/support.ts';
import { loadContent } from './content.ts';
import { sceneProblems, zoneScenes } from './parse-scene.ts';
import { ContentError } from './read.ts';
import type { SceneDef } from './scene-types.ts';
import { storyFlagNames } from './story.ts';
import type { Content, ZoneDef } from './types.ts';

const RAW = {
  id: 'meeting',
  npc: 'warden_guide',
  when: [{ type: 'visited', zone: 'hideout', not: true }],
  x: 10,
  z: 12,
  radius: 6,
  moment: 'campfire',
  fight: 2,
  arrive: 1.5,
  strike: 'warden_sweep',
  lines: ['warden_guide_fell'],
  lead: { exit: 'east', x: 20, z: 12, ahead: 6, walk: 3, run: 6 },
  sets: { met: 'yes' },
} as const;

void test('a scene reads who comes, where it begins, the moment it brings, the strike, the lines, the walk and the flags it sets', (): void => {
  const scenes: SceneDef[] = zoneScenes([RAW], 'zone.scenes');
  assert.deepEqual(scenes, [{ ...RAW, when: [{ type: 'visited', zone: 'hideout', not: true }], lines: [...RAW.lines], lead: { ...RAW.lead, through: null }, sets: { ...RAW.sets } }]);
  const through: SceneDef = must(zoneScenes([{ ...RAW, lead: { ...RAW.lead, through: 0.7 } }], 'zone.scenes')[0], 'a scene that ends through its exit');
  assert.equal(through.lead.through, 0.7);
  assert.deepEqual(zoneScenes(undefined, 'zone.scenes'), []);
});

void test('a scene with no lines, a run slower than its walk, a missing field or a doubled id is refused', (): void => {
  assert.throws((): unknown => zoneScenes([{ ...RAW, lines: [] }], 'zone.scenes'), ContentError);
  assert.throws((): unknown => zoneScenes([{ ...RAW, lead: { ...RAW.lead, run: 1 } }], 'zone.scenes'), ContentError);
  assert.throws((): unknown => zoneScenes([{ ...RAW, fight: 0 }], 'zone.scenes'), ContentError);
  assert.throws((): unknown => zoneScenes([{ ...RAW, lead: { ...RAW.lead, through: 0 } }], 'zone.scenes'), ContentError);
  assert.throws((): unknown => zoneScenes([RAW, RAW], 'zone.scenes'), ContentError);
});

void test('a scene naming someone, a moment, a strike, an exit or a line the content does not have is reported', (): void => {
  const shipped: Content = loadContent();
  const hall: ZoneDef = must(shipped.zones.get('hall_of_time'), 'the Hall');
  const flags: ReadonlySet<string> = storyFlagNames(shipped);
  assert.deepEqual(sceneProblems(shipped, flags), []);
  const scene: SceneDef = must(hall.scenes[0], 'the meeting');
  const broken: SceneDef = { ...scene, npc: 'nobody', moment: 'nothing', strike: 'no_skill', lines: ['warden_trader_goods', 'no_line'], lead: { ...scene.lead, exit: 'nowhere' }, when: [{ type: 'visited', zone: 'no_zone', not: false }] };
  const content: Content = { ...shipped, zones: new Map<string, ZoneDef>([...shipped.zones, [hall.id, { ...hall, scenes: [broken] }]]) };
  const problems: string[] = sceneProblems(content, flags);
  for (const part of ['unknown npc nobody', 'unknown moment nothing', 'unknown skill no_skill', 'unknown exit nowhere', 'unknown line no_line', 'spoken by warden_trader', 'unknown zone no_zone']) {
    assert.ok(problems.some((problem: string): boolean => problem.includes(part)), part);
  }
});
