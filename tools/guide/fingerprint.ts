import { createHash } from 'node:crypto';
import policyFile from '../simulate-policies.json' with { type: 'json' };
import buildFile from './builds.json' with { type: 'json' };
import { RAW_CONTENT } from '../../sim/content/content.ts';
import type { RawContent } from '../../sim/content/parse.ts';
import { isFields } from '../../sim/content/read.ts';

export const BALANCE_PARTS: readonly (keyof RawContent)[] = ['skills', 'monsters', 'monsterMods', 'factions', 'items', 'skillTree', 'chart', 'player', 'flasks', 'packRanks', 'moments', 'world', 'quests', 'trade'];

export const ZONE_BALANCE: readonly string[] = ['id', 'kind', 'level', 'levelUpTo', 'packs', 'packReturn', 'moments', 'ranks', 'surge', 'exits'];

function zoneBalance(zone: unknown): unknown {
  if (!isFields(zone)) return zone;
  return Object.fromEntries(ZONE_BALANCE.map((key: string): [string, unknown] => [key, zone[key] ?? null]));
}

export function balanceFingerprint(raw: RawContent, policies: unknown, builds: unknown): string {
  const hash = createHash('sha256');
  for (const part of BALANCE_PARTS) hash.update(`${part}:${JSON.stringify(raw[part])}\n`);
  hash.update(`zones:${JSON.stringify(raw.zones.map(zoneBalance))}\n`);
  hash.update(`policies:${JSON.stringify(policies)}\n`);
  hash.update(`guide:${JSON.stringify(builds)}\n`);
  return hash.digest('hex').slice(0, 16);
}

export function currentFingerprint(): string {
  return balanceFingerprint(RAW_CONTENT, policyFile, buildFile);
}
