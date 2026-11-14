import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FlaskDef } from './flasks.ts';
import { parseFlasks } from './flasks.ts';
import { ContentError } from './read.ts';

const GOOD = { id: 'red', name: 'Red', resource: 'life', amount: 50, share: 0.3, duration: 2, cooldown: 0.5, maxCharges: 20, chargesPerUse: 10, chargesPerKill: 2 } as const;

void test('a flask definition is read with every field', (): void => {
  const [red]: FlaskDef[] = parseFlasks([GOOD], 'flasks');
  assert.deepEqual(red, GOOD);
});

void test('bad flask definitions are rejected with where they went wrong', (): void => {
  assert.throws((): FlaskDef[] => parseFlasks([{ ...GOOD, resource: 'rage' }], 'flasks'), ContentError);
  assert.throws((): FlaskDef[] => parseFlasks([{ ...GOOD, duration: 0 }], 'flasks'), ContentError);
  assert.throws((): FlaskDef[] => parseFlasks([{ ...GOOD, chargesPerUse: 30 }], 'flasks'), ContentError);
  assert.throws((): FlaskDef[] => parseFlasks([{ ...GOOD, chargesPerKill: -1 }], 'flasks'), ContentError);
  assert.throws((): FlaskDef[] => parseFlasks([GOOD, GOOD], 'flasks'), /duplicate id red/);
  assert.throws((): FlaskDef[] => parseFlasks({}, 'flasks'), ContentError);
  assert.throws((): FlaskDef[] => parseFlasks([{ ...GOOD, share: 1.5 }], 'flasks'), /share: expected a number from 0 to 1/);
  assert.throws((): FlaskDef[] => parseFlasks([{ ...GOOD, amount: -1 }], 'flasks'), /amount: expected a number of zero or more/);
  assert.throws((): FlaskDef[] => parseFlasks([{ ...GOOD, amount: 0, share: 0 }], 'flasks'), /amount: expected an amount or a share above zero/);
});

void test('a flask may restore only a share of the maximum, with no flat amount', (): void => {
  assert.deepEqual(parseFlasks([{ ...GOOD, amount: 0, share: 0.4 }], 'flasks'), [{ ...GOOD, amount: 0, share: 0.4 }]);
});

void test('flask charges are whole numbers, since a save keeps whole charges', (): void => {
  assert.throws((): FlaskDef[] => parseFlasks([{ ...GOOD, chargesPerKill: 0.5 }], 'flasks'), /chargesPerKill: expected a whole number/);
  assert.throws((): FlaskDef[] => parseFlasks([{ ...GOOD, maxCharges: 20.5 }], 'flasks'), /maxCharges: expected a whole number/);
  assert.throws((): FlaskDef[] => parseFlasks([{ ...GOOD, chargesPerUse: 2.5 }], 'flasks'), /chargesPerUse: expected a whole number/);
});
