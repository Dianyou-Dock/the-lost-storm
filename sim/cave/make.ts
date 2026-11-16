import { zone as readZone } from '../content/parse-world.ts';
import type { Content, ZoneDef } from '../content/types.ts';
import { caveProblems } from './checks.ts';
import type { CaveLayout, CaveRequest, CaveResult } from './generate.ts';
import { generateCave } from './generate.ts';
import type { CaveKit } from './kit.ts';
import type { CaveNaming } from './zone.ts';
import { caveZoneRecord } from './zone.ts';

export interface MadeCave {
  readonly layout: CaveLayout;
  readonly record: Record<string, unknown>;
  readonly zone: ZoneDef;
  readonly attempts: number;
}

export type MadeResult = { readonly ok: true; readonly cave: MadeCave } | { readonly ok: false; readonly problem: string };

export function caveZone(layout: CaveLayout, naming: CaveNaming, kit: CaveKit): { readonly record: Record<string, unknown>; readonly zone: ZoneDef } {
  const record: Record<string, unknown> = caveZoneRecord(layout, naming, kit);
  return { record, zone: readZone(record, naming.id) };
}

export function makeCave(content: Content, kit: CaveKit, request: CaveRequest, naming: CaveNaming): MadeResult {
  const strangers: readonly string[] = [...new Set(kit.families.flatMap((family): string[] => family.members.map((member): string => member.monster)).filter((monster: string): boolean => !content.monsters.has(monster)))];
  if (strangers.length > 0) return { ok: false, problem: `kit ${kit.id} names monsters the game does not have: ${strangers.join(', ')}` };
  const judge = (layout: CaveLayout): readonly string[] => caveProblems(content, caveZone(layout, naming, kit).zone, request.screen);
  const result: CaveResult = generateCave(request, { kit, defs: content.props, judge });
  if (!result.ok) return result;
  const { record, zone } = caveZone(result.layout, naming, kit);
  return { ok: true, cave: { layout: result.layout, record, zone, attempts: result.attempts } };
}
