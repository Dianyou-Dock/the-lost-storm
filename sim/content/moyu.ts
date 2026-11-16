import graph from '../../data/moyu-graph.json' with { type: 'json' };
import type { Content, SkillTreeNodeDef, ZoneDef } from './types.ts';

export const MOYU_TITLE: string = '摸鱼 · 五行天赋图';
export const MOYU_MAPS: readonly string[] = ['keepers_gate', 'under_hall', 'ledger_hall', 'under_hall_2', 'under_hall_3', 'ledger_hall_2', 'ledger_hall_3', 'lava_depths', 'lava_depths_2'];

const ELEMENTS = [
  { id: '金', name: '金', tint: '#e2b86f' },
  { id: '木', name: '木', tint: '#88c6a2' },
  { id: '水', name: '水', tint: '#7eb9dc' },
  { id: '火', name: '火', tint: '#e4967f' },
  { id: '土', name: '土', tint: '#c3ad8d' },
] as const;
const COORDS: ReadonlyMap<string, { readonly x: number; readonly y: number }> = new Map(Object.entries(graph.coords));

export function isMoyu(content: Content): boolean {
  return content.chart.title === MOYU_TITLE;
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

export function moyuContent(content: Content): Content {
  const zones: Map<string, ZoneDef> = new Map<string, ZoneDef>([...content.zones].map(([id, zone]: [string, ZoneDef]): [string, ZoneDef] => [id, MOYU_MAPS.includes(id) ? { ...zone, packs: zone.packs.map((pack) => ({ ...pack, when: [] })), exits: zone.exits.map((exit) => ({ ...exit, requires: [] })) } : zone]));
  return {
    ...content,
    skillTree: graphNodes(),
    chart: {
      ...content.chart,
      title: MOYU_TITLE,
      revision: content.chart.revision + 1,
      pointsPerLevel: 1,
      paths: ELEMENTS.map((element) => ({ id: element.id, name: element.name, tint: element.tint, description: `${element.name}属性与武器联动` })),
      grants: [{ id: 'moyu_start', when: [], points: 1 }, ...MOYU_MAPS.map((zone: string) => ({ id: `moyu_visit_${zone}`, when: [{ type: 'visited' as const, zone, not: false }], points: 1 }))],
    },
    player: { ...content.player, xp: { ...content.player.xp, maxLevel: 41 } },
    quests: new Map(),
    zones,
    world: { ...content.world, start: 'hideout', opening: null, acts: [] },
  };
}
