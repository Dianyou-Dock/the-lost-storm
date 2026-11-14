import assert from 'node:assert/strict';
import { test } from 'node:test';
import { must, zoneOf } from '../../test/support.ts';
import { loadContent } from './content.ts';
import type { Content, ZoneDef, ZoneExit } from './types.ts';
import { exitWithheld, withheldZones } from './withheld.ts';

const content: Content = loadContent();

void test('the cave under the Hall is withheld: every way into it needs a flag nothing in the data sets', (): void => {
  assert.deepEqual([...withheldZones(content)], ['under_hall']);
  const into: ZoneExit[] = [...content.zones.values()].flatMap((zone: ZoneDef): ZoneExit[] => zone.exits.filter((exit: ZoneExit): boolean => exit.to === 'under_hall'));
  assert.ok(into.length > 0);
  for (const exit of into) {
    assert.ok(exitWithheld(content, exit), exit.id);
    assert.equal(exit.hiddenWhenLocked, true, exit.id);
  }
});

void test('with nothing withheld every zone is open, and the lair keeps its own ways out unwithheld', (): void => {
  const opened: Content = { ...content, world: { ...content.world, withheld: [] } };
  assert.deepEqual([...withheldZones(opened)], []);
  const lair: ZoneDef = zoneOf(content, 'keepers_gate');
  const back: ZoneExit = must(lair.exits.find((exit: ZoneExit): boolean => exit.to === 'hall_of_time'), 'back to the hall');
  assert.equal(exitWithheld(content, back), false);
});
