import type { Fields } from './read.ts';
import { byId, ContentError, each, fields, numeric, positive, text, textList } from './read.ts';
import { conditions } from './parse-conditions.ts';
import { storyFlags } from './parse-story.ts';
import { conditionProblems } from './road.ts';
import type { SceneDef, SceneLead } from './scene-types.ts';
import type { Content, LineDef, ZoneDef } from './types.ts';

function lead(value: unknown, where: string): SceneLead {
  const source: Fields = fields(value, where);
  const walk: number = positive(source, 'walk', where);
  const run: number = positive(source, 'run', where);
  if (run < walk) throw new ContentError(`${where}.run`, 'a run cannot be slower than a walk');
  return { exit: text(source, 'exit', where), x: numeric(source, 'x', where), z: numeric(source, 'z', where), ahead: positive(source, 'ahead', where), walk, run, through: source['through'] === undefined ? null : positive(source, 'through', where) };
}

function scene(value: unknown, where: string): SceneDef {
  const source: Fields = fields(value, where);
  const lines: string[] = textList(source, 'lines', where);
  if (lines.length === 0) throw new ContentError(`${where}.lines`, 'a scene needs at least one line');
  return {
    id: text(source, 'id', where),
    npc: text(source, 'npc', where),
    when: conditions(source, 'when', where),
    x: numeric(source, 'x', where),
    z: numeric(source, 'z', where),
    radius: positive(source, 'radius', where),
    moment: text(source, 'moment', where),
    fight: positive(source, 'fight', where),
    arrive: positive(source, 'arrive', where),
    strike: text(source, 'strike', where),
    lines,
    lead: lead(source['lead'], `${where}.lead`),
    sets: storyFlags(source['sets'], `${where}.sets`),
  };
}

export function zoneScenes(value: unknown, where: string): SceneDef[] {
  if (value === undefined) return [];
  return [...byId(each(value, where, scene), where).values()];
}

function oneSceneProblems(content: Content, flags: ReadonlySet<string>, zone: ZoneDef, def: SceneDef): string[] {
  const at: string = `zone ${zone.id} scene ${def.id}`;
  const problems: string[] = conditionProblems(content, flags, at, def.when);
  if (!content.npcs.has(def.npc)) problems.push(`${at} names unknown npc ${def.npc}`);
  if (!content.moments.defs.has(def.moment)) problems.push(`${at} brings unknown moment ${def.moment}`);
  if (!content.skills.has(def.strike)) problems.push(`${at} strikes with unknown skill ${def.strike}`);
  if (!zone.exits.some((exit): boolean => exit.id === def.lead.exit)) problems.push(`${at} leads to unknown exit ${def.lead.exit}`);
  for (const lineId of def.lines) {
    const spoken: LineDef | undefined = content.lines.get(lineId);
    if (spoken === undefined) problems.push(`${at} uses unknown line ${lineId}`);
    else if (spoken.speaker !== def.npc) problems.push(`${at} uses line ${lineId}, which is spoken by ${spoken.speaker}`);
  }
  return problems;
}

export function sceneProblems(content: Content, flags: ReadonlySet<string>): string[] {
  return [...content.zones.values()].flatMap((zone: ZoneDef): string[] => zone.scenes.flatMap((def: SceneDef): string[] => oneSceneProblems(content, flags, zone, def)));
}
