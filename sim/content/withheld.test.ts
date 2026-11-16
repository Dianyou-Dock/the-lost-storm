import assert from 'node:assert/strict';
import { test } from 'node:test';
import { must, zoneOf } from '../../test/support.ts';
import { loadContent } from './content.ts';
import type { Content, ZoneDef, ZoneExit } from './types.ts';
import { exitWithheld, withheldZones } from './withheld.ts';

const content: Content = loadContent();

void test('the shipped world withholds only the columned hall, and holding back the flag on the way down withholds the cave and hides every way into it', (): void => {
  assert.deepEqual(content.world.withheld, ['columned_hall_open']);
  assert.deepEqual([...withheldZones(content)], ['ledger_hall']);
  for (const exit of [...content.zones.values()].flatMap((zone: ZoneDef): ZoneExit[] => zone.exits.filter((entry: ZoneExit): boolean => entry.to === 'ledger_hall'))) assert.equal(exit.hiddenWhenLocked, true, exit.id);
  const held: Content = { ...content, world: { ...content.world, withheld: ['keeper_defeated'] } };
  assert.deepEqual([...withheldZones(held)], ['under_hall']);
  const into: ZoneExit[] = [...content.zones.values()].flatMap((zone: ZoneDef): ZoneExit[] => zone.exits.filter((exit: ZoneExit): boolean => exit.to === 'under_hall'));
  assert.ok(into.length > 0);
  for (const exit of into) {
    assert.ok(exitWithheld(held, exit), exit.id);
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
