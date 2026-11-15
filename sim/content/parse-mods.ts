import type { SkillTarget } from './chart-types.ts';
import type { Fields } from './read.ts';
import { choice, ContentError, fields, numeric } from './read.ts';
import type { SkillMod, StatMod } from './types.ts';
import { MOD_OPS, SKILL_MOD_FIELDS, STAT_IDS } from './types.ts';

export function statMod(value: unknown, where: string): StatMod {
  const source: Fields = fields(value, where);
  return { stat: choice(source, 'stat', STAT_IDS, where), op: choice(source, 'op', MOD_OPS, where), value: numeric(source, 'value', where) };
}

export function skillTarget(source: Fields, where: string): SkillTarget {
  const skill: unknown = source['skill'];
  const group: unknown = source['group'];
  if (typeof skill === 'string' && group === undefined) return { type: 'skill', skill };
  if (typeof group === 'string' && skill === undefined) return { type: 'group', group };
  throw new ContentError(where, 'expected exactly one of skill or group');
}

export function skillMod(value: unknown, where: string): SkillMod {
  const source: Fields = fields(value, where);
  return { target: skillTarget(source, where), field: choice(source, 'field', SKILL_MOD_FIELDS, where), value: numeric(source, 'value', where) };
}
