import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { must } from '../../test/support.ts';
import { wearModel } from '../wear.ts';
import type { BodyHolder } from './bodies.ts';
import { bodyHolders, bodyProblems } from './bodies.ts';
import { loadContent } from './content.ts';
import type { Content, MonsterDef, RigDef } from './types.ts';

const content: Content = loadContent();

function shipped(asset: string): boolean {
  return existsSync(`public/${asset}`);
}

void test('every monster and npc that ships has a body file, a look whose every piece exists for its frame, and the weapons it holds', (): void => {
  const holders: BodyHolder[] = bodyHolders(content);
  assert.ok(holders.length >= content.monsters.size);
  assert.deepEqual(bodyProblems(content, holders, shipped), []);
});

void test('a missing body, a missing piece and a missing weapon are each named', (): void => {
  const brute: MonsterDef = must(content.monsters.get('unfinished_brute'), 'unfinished_brute');
  const rig: RigDef = must(content.rigs.get(brute.rig), brute.rig);
  const mail: string = wearModel(must(content.wearables.get('salvaged_mail'), 'salvaged_mail'), rig.frame);
  const maul: string = must(content.attachments.get('raider_maul'), 'raider_maul').model;
  const gone: Set<string> = new Set<string>([rig.url, mail, maul]);
  const problems: string[] = bodyProblems(content, [brute], (asset: string): boolean => !gone.has(asset));
  assert.ok(problems.some((problem: string): boolean => problem.includes('no body')));
  assert.ok(problems.some((problem: string): boolean => problem.includes('salvaged_mail')));
  assert.ok(problems.some((problem: string): boolean => problem.includes('mismatched_gloves')), 'the gloves share the mail model');
  assert.ok(problems.some((problem: string): boolean => problem.includes('raider_maul')));
});

void test('a head-only body with nothing worn, an unknown rig and an unknown weapon are named', (): void => {
  const brute: MonsterDef = must(content.monsters.get('unfinished_brute'), 'unfinished_brute');
  const bareContent: Content = { ...content, baseLayers: new Map<string, readonly string[]>() };
  const bare: BodyHolder = { id: 'bare', rig: brute.rig, wear: [], gear: ['no_such_weapon'] };
  const lost: BodyHolder = { id: 'lost', rig: 'no_such_rig', wear: [], gear: [] };
  const problems: string[] = bodyProblems(bareContent, [bare, lost], (): boolean => true);
  assert.deepEqual(problems, [`bare wears nothing over the head-only body of frame ${must(content.rigs.get(brute.rig), brute.rig).frame}`, 'bare holds unknown attachment no_such_weapon', 'lost uses unknown rig no_such_rig']);
});
