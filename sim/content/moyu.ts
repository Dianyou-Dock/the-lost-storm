import graph from '../../data/moyu-graph.json' with { type: 'json' };
import type { Content, LineDef, MonsterDef, NpcDef, SkillTreeNodeDef, ZoneDef, ZonePack, ZonePoint } from './types.ts';

export const MOYU_TITLE: string = '摸鱼 · 五行天赋图';
export const MOYU_MAPS: readonly string[] = ['hall_of_time', 'keepers_gate', 'under_hall', 'under_hall_2', 'under_hall_3', 'lava_depths', 'lava_depths_2', 'ledger_hall', 'ledger_hall_2', 'ledger_hall_3'];

const ELEMENTS = [
  { id: '金', name: '金', tint: '#e2b86f' },
  { id: '木', name: '木', tint: '#88c6a2' },
  { id: '水', name: '水', tint: '#7eb9dc' },
  { id: '火', name: '火', tint: '#e4967f' },
  { id: '土', name: '土', tint: '#c3ad8d' },
] as const;
const COORDS: ReadonlyMap<string, { readonly x: number; readonly y: number }> = new Map(Object.entries(graph.coords));
const BOSS_TEMPLATES: readonly string[] = ['stormcaller_rival', 'timekeeper_gatekeeper', 'unfinished_colossus'];
const BOSS_NAMES: readonly string[] = ['时厅巡守', '门庭裁决者', '下层回响', '洞窟回响', '深窟回响', '熔渊斗士', '熔渊巨像', '账厅守卫', '账厅裁决者', '终厅巨像'];

export function isMoyu(content: Content): boolean {
  return content.chart.title === MOYU_TITLE;
}

export function moyuBossFlag(zoneId: string): string {
  return `moyu_boss_${zoneId}_active`;
}

export function moyuNode(id: string): (typeof graph.nodes)[number] | null {
  return graph.nodes.find((node): boolean => node.id === id) ?? null;
}

export function hotWeapon(id: string): boolean {
  const node = moyuNode(id);
  return node !== null && ['手枪', '冲锋枪', '霰弹枪', '步枪', '狙击枪'].includes(node.weapon ?? '');
}

export function moyuRequirements(allocated: readonly string[], id: string): boolean {
  const node = moyuNode(id);
  if (node === null || hotWeapon(id) || node.type === 'socket' || allocated.length >= 50) return false;
  if (!node.prereq.every((required: string): boolean => allocated.includes(required))) return false;
  if (node.type === 'key' && allocated.some((held: string): boolean => moyuNode(held)?.type === 'key')) return false;
  if (node.type === 'socket' && allocated.some((held: string): boolean => moyuNode(held)?.type === 'socket')) return false;
  if (node.type === 'special') {
    const dual: boolean = node.route === '双持';
    const bare: boolean = ['拳法', '腿法', '掌法'].includes(node.route ?? '');
    if (dual && allocated.some((held: string): boolean => ['拳法', '腿法', '掌法'].includes(moyuNode(held)?.route ?? ''))) return false;
    if (bare && allocated.some((held: string): boolean => moyuNode(held)?.route === '双持')) return false;
  }
  return true;
}

function graphNodes(): SkillTreeNodeDef[] {
  return graph.nodes.map((node): SkillTreeNodeDef => {
    const point = COORDS.get(node.id);
    const links: string[] = graph.links.flatMap((link): string[] => link.b === node.id && link.a !== 'root' ? [link.a] : []);
    const hot: boolean = hotWeapon(node.id);
    const path: string = node.element ?? ELEMENTS[Math.max(0, Math.floor(graph.nodes.filter((entry): boolean => entry.type === 'armament').findIndex((entry): boolean => entry.weapon === node.weapon) / 6)) % 5]?.id ?? '金';
    return {
      id: node.id,
      name: node.name,
      description: `${node.desc}${hot ? ' · 热兵器尚未开放，暂不分配天赋点。' : node.type === 'socket' ? ' · 连脉石尚未接入，暂不开放此插槽。' : ''}`,
      icon: 'focus',
      kind: node.type === 'key' ? 'keystone' : ['word', 'variant', 'special', 'gate', 'socket', 'hub', 'armament'].includes(node.type) ? 'notable' : 'minor',
      path,
      column: (point?.x ?? 1000) / 72 - 1000 / 72,
      row: (point?.y ?? 950) / 72 - 950 / 72,
      requires: [...new Set<string>(links)],
      statMods: [],
      skillMods: [],
      variants: [],
      unlock: null,
      weapon: null,
      triggers: [],
    };
  });
}

function freshPack(pack: ZonePack): ZonePack {
  const fresh: ZonePack = { ...pack, when: [] };
  Reflect.deleteProperty(fresh, 'level');
  return fresh;
}

function squaredDistance(point: ZonePack, origin: ZonePoint): number {
  return (point.x - origin.x) ** 2 + (point.z - origin.z) ** 2;
}

function bossPack(zone: ZoneDef, bossId: string): ZonePack[] {
  const packs: ZonePack[] = zone.packs.map(freshPack);
  if (packs.length === 0) return packs;
  const start = zone.playerStart;
  const farthest = packs.reduce((chosen: number, pack: ZonePack, index: number): number => {
    const previous: ZonePack | undefined = packs[chosen];
    return previous === undefined || squaredDistance(pack, start) > squaredDistance(previous, start) ? index : chosen;
  }, 0);
  const site: ZonePack | undefined = packs[farthest];
  if (site === undefined) return packs;
  const boss: ZonePack = { ...site, members: [{ monster: bossId, count: 1, mods: [] }], when: [{ type: 'flag', flag: moyuBossFlag(zone.id), is: 'active', not: false }], waits: { near: 12 } };
  Reflect.deleteProperty(boss, 'rank');
  packs[farthest] = boss;
  return packs;
}

export function moyuContent(content: Content): Content {
  const monsters: Map<string, MonsterDef> = new Map(content.monsters);
  const npcs: Map<string, NpcDef> = new Map(content.npcs);
  const lines: Map<string, LineDef> = new Map(content.lines);
  const zones: Map<string, ZoneDef> = new Map<string, ZoneDef>([...content.zones].map(([id, zone]: [string, ZoneDef]): [string, ZoneDef] => {
    const index: number = MOYU_MAPS.indexOf(id);
    if (index < 0) return [id, zone];
    const templateId: string | undefined = BOSS_TEMPLATES[index % BOSS_TEMPLATES.length];
    const template: MonsterDef | undefined = templateId === undefined ? undefined : content.monsters.get(templateId);
    if (template === undefined || template.boss === null) throw new Error(`Missing boss template for ${id}`);
    const bossId = `moyu_boss_${id}`;
    const name: string = BOSS_NAMES[index] ?? '地图守卫';
    monsters.set(bossId, { ...template, id: bossId, name, boss: { ...template.boss, title: name, firstKill: null, drop: { items: 1, rarity: 'magic', goldMin: 10 + zone.level * 2, goldMax: 18 + zone.level * 2 } } });
    const packs: ZonePack[] = bossPack(zone, bossId);
    const site: ZonePack | undefined = packs.find((pack: ZonePack): boolean => pack.members.some((member): boolean => member.monster === bossId));
    const npcId = `moyu_challenger_${id}`;
    const lineId = `${npcId}_challenge`;
    const guide: NpcDef | undefined = content.npcs.get('warden_guide');
    if (guide === undefined || site === undefined) throw new Error(`Missing challenger for ${id}`);
    npcs.set(npcId, { ...guide, id: npcId, name: '首领挑战', title: name, service: null, talks: [{ id: lineId, once: false, when: [], lines: [lineId] }] });
    lines.set(lineId, { id: lineId, speaker: npcId, text: `这里的首领是${name}。准备好后继续对话，战斗才会开始。` });
    return [id, { ...zone, levelUpTo: 41, packs, npcs: [...zone.npcs, { npc: npcId, x: site.x, z: site.z, facingDegrees: 180, when: [{ type: 'flag', flag: moyuBossFlag(id), is: null, not: true }] }], exits: zone.exits.map((exit) => ({ ...exit, requires: [] })) }];
  }));
  return {
    ...content,
    monsters,
    npcs,
    lines,
    skillTree: graphNodes(),
    chart: {
      ...content.chart,
      title: MOYU_TITLE,
      revision: content.chart.revision + 1,
      pointsPerLevel: 1,
      paths: ELEMENTS.map((element) => ({ id: element.id, name: element.name, tint: element.tint, description: `${element.name}属性与武器联动` })),
      grants: [{ id: 'moyu_start', when: [], points: 1 }, ...MOYU_MAPS.filter((zone: string): boolean => zone !== 'hall_of_time').map((zone: string) => ({ id: `moyu_visit_${zone}`, when: [{ type: 'visited' as const, zone, not: false }], points: 1 }))],
    },
    player: { ...content.player, xp: { ...content.player.xp, maxLevel: 41 } },
    quests: new Map(),
    zones,
    world: { ...content.world, start: 'hideout', opening: null, acts: [] },
  };
}
