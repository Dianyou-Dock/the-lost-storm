import assert from 'node:assert/strict';
import { test } from 'node:test';
import hourfall from '../../data/kits/hourfall.json' with { type: 'json' };
import { loadContent } from '../content/content.ts';
import { ContentError, fields } from '../content/read.ts';
import type { Content } from '../content/types.ts';
import type { CaveKit } from './kit.ts';
import { readKit } from './kit.ts';

const content: Content = loadContent();
const kit: CaveKit = readKit(hourfall, 'hourfall');

void test('the Hourfall kit names only props, caches, monsters and surfaces the game has', (): void => {
  for (const cluster of kit.clusters) for (const piece of cluster) assert.ok(content.props.has(piece.prop), piece.prop);
  for (const cache of kit.caches) assert.ok(content.props.get(cache)?.cache !== null, cache);
  assert.ok(content.props.has(kit.stairs.prop));
  for (const family of kit.families) for (const member of family.members) assert.ok(content.monsters.has(member.monster), member.monster);
  const floors = fields(kit.zone['floors'], 'floors');
  for (const surface of Object.values(floors)) assert.ok(typeof surface === 'string' && content.surfaces.has(surface), String(surface));
});

void test('a kit whose letters are not its floors, or that brings its own levels, is refused', (): void => {
  assert.throws((): CaveKit => readKit({ ...hourfall, letters: { ...hourfall.letters, passage: 'q' } }, 'bad'), ContentError);
  assert.throws((): CaveKit => readKit({ ...hourfall, zone: { ...hourfall.zone, terrain: { ...hourfall.zone.terrain, levels: [] } } }, 'bad'), ContentError);
  assert.throws((): CaveKit => readKit({ ...hourfall, families: [] }, 'bad'), ContentError);
  assert.throws((): CaveKit => readKit({ ...hourfall, shape: { ...hourfall.shape, radiusMost: 1 } }, 'bad'), ContentError);
});
