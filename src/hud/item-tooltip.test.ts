import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadContent } from '../../sim/content/content.ts';
import type { Content, ItemBaseDef } from '../../sim/content/types.ts';
import { USE_WORDS } from './item-tooltip.ts';

const content: Content = loadContent();

void test('every item that can be used says in its tooltip what it does', (): void => {
  const usable: ItemBaseDef[] = [...content.itemBases.values()].filter((base: ItemBaseDef): boolean => base.use !== null);
  assert.ok(usable.length > 0);
  for (const base of usable) {
    if (base.use === null) continue;
    assert.ok(USE_WORDS[base.use.type].length > 0, base.id);
  }
});
