import graph from '../../data/moyu-graph.json' with { type: 'json' };
import zh from '../../src/i18n/zh.json' with { type: 'json' };
import type { AffixDef, Content, ItemBaseDef, LineDef, MonsterDef, NpcDef, RarityDef, SkillDef, SkillMod, SkillTreeNodeDef, ZoneDef, ZonePack, ZonePoint } from './types.ts';

export const MOYU_TITLE: string = '摸鱼 · 五行天赋图';
export const MOYU_MAPS: readonly string[] = ['under_hall', 'under_hall_2', 'under_hall_3', 'lava_depths', 'lava_depths_2', 'ledger_hall', 'ledger_hall_2', 'ledger_hall_3'];

const ELEMENTS = [
  { id: '金', name: '金', tint: '#e2b86f' },
  { id: '木', name: '木', tint: '#88c6a2' },
  { id: '水', name: '水', tint: '#7eb9dc' },
  { id: '火', name: '火', tint: '#e4967f' },
  { id: '土', name: '土', tint: '#c3ad8d' },
] as const;
const COORDS: ReadonlyMap<string, { readonly x: number; readonly y: number }> = new Map(Object.entries(graph.coords));
const BOSS_TEMPLATES: readonly string[] = ['stormcaller_rival', 'timekeeper_gatekeeper', 'unfinished_colossus'];
const BOSS_NAMES: readonly string[] = ['下层回响', '洞窟回响', '深窟回响', '熔渊斗士', '熔渊巨像', '账厅守卫', '账厅裁决者', '终厅巨像'];
const MOYU_NODE_TYPES: ReadonlySet<string> = new Set(['base', 'word', 'synergy', 'variant', 'confluence']);
const MOYU_SKILLS: readonly string[] = ['cleave', 'thunderclap', 'storm_bolt', 'dodge_roll'];
const WEAPON_ACTIONS: Readonly<Record<string, readonly [string, string, string]>> = {
  刀: ['斩', '横扫', '重斩'],
  剑: ['突刺', '连斩', '格挡反击'],
  斧: ['劈砍', '旋斩', '断势'],
  棍: ['点', '扫', '砸'],
  匕首: ['刺', '连刺', '背袭'],
};
const WEAPON_DESCRIPTIONS: Readonly<Record<string, readonly [string, string, string]>> = {
  刀: ['近距离斩击单个目标。', '横扫身前多个目标。', '蓄力重斩，造成高伤害。'],
  剑: ['沿直线突刺单个目标。', '连续攻击同一目标，重复施放推进连斩。', '举剑格挡，成功挡住攻击后立即反刺。'],
  斧: ['近距离劈砍单个目标。', '旋斩攻击周围目标。', '蓄力重击，可以打断目标的防御姿态。'],
  棍: ['快速点击单个目标。', '横扫周围目标。', '蓄力砸击，可以打断目标蓄力。'],
  匕首: ['快速刺击单个目标。', '短时间内连续刺击同一目标。', '从目标背后袭击时造成额外伤害。'],
};

function weaponName(base: ItemBaseDef): string | null {
  if (base.weaponKind === 'axe') return '斧';
  if (base.weaponKind === 'staff') return '棍';
  if (/sabre|tidecut/i.test(base.id)) return '刀';
  if (/knife|dirk/i.test(base.id)) return '匕首';
  if (base.weaponKind === 'blade' || base.weaponKind === 'greatsword') return '剑';
  return null;
}

function actionSkill(original: SkillDef, kind: string, index: number, name: string, id: string): SkillDef {
  const quick = index === 0;
  const area = index === 1 && kind !== '剑' && kind !== '匕首';
  const combo = index === 1 && (kind === '剑' || kind === '匕首') ? { window: 0.55, steps: [{ animation: 'attack_b', windup: 0.12, recovery: 0.16, damageScale: 0.8, areaScale: 1, knockbackScale: 0, stagger: 0.1, shake: 0.08, hitStop: 0.02 }, { animation: 'attack_c', windup: 0.12, recovery: 0.18, damageScale: 1, areaScale: 1, knockbackScale: 0, stagger: 0.14, shake: 0.1, hitStop: 0.03 }] } : null;
  const reach = kind === '剑' ? 3.3 : kind === '匕首' ? 2.2 : 2.8;
  const delivery: SkillDef['delivery'] = area ? kind === '刀' ? { type: 'arc', reach: 3.5, arcDegrees: 145 } : { type: 'nova', radius: 3.2 } : { type: 'arc', reach, arcDegrees: kind === '剑' ? 28 : kind === '匕首' ? 35 : 65 };
  const style = area ? 'shockwave' : kind === '棍' ? 'claw' : 'slash';
  const color: Readonly<Record<string, string>> = { 剑: '#dbe9ff', 刀: '#e8b772', 斧: '#e47c55', 棍: '#b7d2a1', 匕首: '#b5a5df' };
  return {
    ...original,
    id,
    form: id,
    name,
    description: WEAPON_DESCRIPTIONS[kind]?.[index] ?? name,
    animation: index === 2 ? 'slam' : 'attack',
    manaCost: quick ? 0 : index === 1 ? 6 : 10,
    cooldown: quick ? 0 : index === 1 ? 0.6 : 2,
    windup: index === 2 ? 0.42 : 0.13,
    recovery: index === 2 ? 0.33 : 0.19,
    engageRange: reach,
    delivery,
    damage: { ...original.damage, type: 'physical', weaponPercent: index === 2 ? kind === '匕首' ? 1.1 : 1.8 : 1, flatMin: 0, flatMax: 0 },
    knockback: index === 2 ? 9 : 2,
    stagger: index === 2 ? 0.7 : 0.2,
    category: area ? 'area' : index === 2 ? 'charged' : 'single',
    combo,
    vfx: { ...original.vfx, style, color: color[kind] ?? '#dbe9ff', cue: area ? 'ground' : 'blade' },
    burn: null,
  };
}
const ELEMENT_BONUS: Readonly<Record<string, { readonly text: string; readonly field: SkillMod['field']; readonly value: number }>> = {
  金: { text: '伤害 +2%', field: 'damagePercent', value: 0.02 },
  木: { text: '命中回复生命 +0.3', field: 'lifeOnHit', value: 0.3 },
  水: { text: '冷却时间 -2%', field: 'cooldownPercent', value: -0.02 },
  火: { text: '范围 +2%', field: 'areaPercent', value: 0.02 },
  土: { text: '削韧 +3%', field: 'staggerPercent', value: 0.03 },
};

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
  if (node === null || !MOYU_NODE_TYPES.has(node.type) || allocated.length >= 50) return false;
  if (!node.prereq.every((required: string): boolean => allocated.includes(required))) return false;
  return true;
}

function graphNodes(): SkillTreeNodeDef[] {
  return graph.nodes.filter((node): boolean => MOYU_NODE_TYPES.has(node.type)).map((node): SkillTreeNodeDef => {
    const point = COORDS.get(node.id);
    const links: string[] = graph.links.flatMap((link): string[] => link.b === node.id && link.a !== 'root' && MOYU_NODE_TYPES.has(moyuNode(link.a)?.type ?? '') ? [link.a] : []);
    const path: string = node.element ?? '金';
    const active: boolean = node.type !== 'base';
    const elements: readonly string[] = [node.element, node.support, node.third].filter((entry): entry is string => entry !== undefined);
    const bonuses = active ? elements.flatMap((element: string) => ELEMENT_BONUS[element] === undefined ? [] : [ELEMENT_BONUS[element]]) : [];
    return {
      id: node.id,
      name: node.name,
      description: active ? `${elements.join('·')}：${bonuses.map((bonus) => bonus.text).join('，')}。装备武器后应用到技能。` : `${node.desc}；同属性装备词条效果提高 3%。`,
      icon: 'focus',
      kind: active ? 'notable' : 'minor',
      path,
      column: (point?.x ?? 1000) / 72 - 1000 / 72,
      row: (point?.y ?? 950) / 72 - 950 / 72,
      requires: [...new Set<string>(links)],
      statMods: [],
      skillMods: active ? MOYU_SKILLS.flatMap((skill: string): SkillMod[] => bonuses.map((bonus): SkillMod => ({ target: { type: 'skill', skill }, field: bonus.field, value: bonus.value }))) : [],
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

function crowdedPacks(zone: ZoneDef, bossId: string, monsters: ReadonlyMap<string, MonsterDef>): ZonePack[] {
  const packs: ZonePack[] = bossPack(zone, bossId);
  const kinds: string[] = [...new Set(zone.packs.flatMap((pack: ZonePack): string[] => pack.members.map((member): string => member.monster)))].filter((id: string): boolean => monsters.get(id)?.boss === null);
  const crowded: ZonePack[] = [];
  for (const [index, pack] of packs.entries()) {
    if (pack.members.some((member): boolean => member.monster === bossId)) {
      crowded.push(pack);
      continue;
    }
    const extra: string | undefined = kinds[(index + 1) % kinds.length];
    const members: ZonePack['members'][number][] = [];
    for (const member of pack.members) members.push({ ...member, count: Math.min(5, member.count + 1) });
    if (extra !== undefined) members.push({ monster: extra, count: 1, mods: [] });
    crowded.push({ ...pack, members });
  }
  return crowded;
}

function mapLevel(index: number): number {
  return index < 2 ? index + 1 : 2 + (index - 1) * 4;
}

function mapExits(zone: ZoneDef, zones: ReadonlyMap<string, ZoneDef>, index: number): ZoneDef['exits'] {
  const previous: string | undefined = MOYU_MAPS[index - 1];
  const next: string | undefined = MOYU_MAPS[index + 1];
  const anchors: readonly ZoneDef['exits'][number][] = zone.exits;
  const back = anchors[0];
  const forward = anchors[anchors.length - 1];
  if (back === undefined || forward === undefined) return [];
  const entrance = (id: string, at: typeof back, to: string, toExit: string): typeof back => ({ ...at, id, to, toExit, arrival: zones.get(to)?.playerStart ?? zone.playerStart, requires: [], hiddenWhenLocked: false, lockedHint: '' });
  const exits: ZoneDef['exits'][number][] = [entrance('moyu_return', { ...back, x: zone.playerStart.x + 2, z: zone.playerStart.z, radius: 1.5 }, 'hideout', 'moyu_arrive')];
  if (previous !== undefined) exits.push(entrance('moyu_previous', back, previous, 'moyu_next'));
  if (next !== undefined) exits.push({ ...entrance('moyu_next', forward, next, 'moyu_previous'), requires: [{ type: 'level', atLeast: mapLevel(index + 1), not: false }], lockedHint: `达到 ${mapLevel(index + 1)} 级后可进入`, hiddenWhenLocked: false });
  return exits;
}

function weaponSkills(content: Content): { readonly skills: Map<string, SkillDef>; readonly itemBases: Map<string, ItemBaseDef> } {
  const skills: Map<string, SkillDef> = new Map(content.skills);
  const itemBases: Map<string, ItemBaseDef> = new Map(content.itemBases);
  const originals: readonly string[] = MOYU_SKILLS.slice(0, 3);
  for (const base of content.itemBases.values()) {
    const kind: string | null = weaponName(base);
    const names: readonly [string, string, string] | undefined = kind === null ? undefined : WEAPON_ACTIONS[kind];
    if (names === undefined) continue;
    const variants = base.variants.filter((variant): boolean => !originals.includes(variant.skill));
    for (const [index, skillId] of originals.entries()) {
      const original: SkillDef | undefined = content.skills.get(skillId);
      const name: string | undefined = names[index];
      if (original === undefined || name === undefined) continue;
      const id = `moyu_${base.id}_${skillId}`;
      skills.set(id, actionSkill(original, kind ?? '剑', index, name, id));
      variants.push({ skill: skillId, becomes: id });
    }
    itemBases.set(base.id, { ...base, variants });
  }
  return { skills, itemBases };
}

function elementAffixes(content: Content): Map<string, AffixDef> {
  const names: Readonly<Record<string, string>> = { Honed: '锋利', Quick: '迅捷', Keen: '敏锐', Hale: '强健', Plated: '坚甲', Grounded: '避雷', Hearthwarm: '御寒', Fleet: '轻盈', Brimming: '充沛', Mending: '回春', Clear: '清明', Cruel: '残酷', Sturdy: '坚固', Jagged: '锯齿', Vital: '生机' };
  const affixes = new Map([...content.affixes].map(([id, def]): [string, AffixDef] => [id, { ...def, label: names[def.label] ?? def.label }]));
  const slots: AffixDef['slots'] = ['weapon', 'head', 'chest', 'hands', 'legs', 'feet', 'charm'];
  const entries = [
    ['金', 'damagePercent', 'percent', 0.015, 0.05],
    ['木', 'lifeRegen', 'add', 0.2, 0.8],
    ['水', 'manaRegen', 'add', 0.2, 0.8],
    ['火', 'attackSpeed', 'percent', 0.015, 0.05],
    ['土', 'armour', 'add', 2, 7],
  ] as const;
  for (const [element, stat, op, min, max] of entries) affixes.set(`moyu_${element}`, { id: `moyu_${element}`, label: `${element}行`, slots, stat, op, min, max, perLevel: 0.035 });
  return affixes;
}

function itemNames(items: ReadonlyMap<string, ItemBaseDef>): Map<string, ItemBaseDef> {
  const names: Readonly<Record<string, string>> = zh;
  return new Map([...items].map(([id, def]): [string, ItemBaseDef] => [id, { ...def, name: names[def.name] ?? def.name }]));
}

export function moyuContent(content: Content): Content {
  const actions = weaponSkills(content);
  const [common, magic, rare, legendary] = content.rarities;
  if (common === undefined || magic === undefined || rare === undefined || legendary === undefined) throw new Error('Missing equipment rarities');
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
    const packs: ZonePack[] = crowdedPacks(zone, bossId, content.monsters);
    for (const pack of packs) for (const member of pack.members) {
      const ordinary = monsters.get(member.monster);
      if (ordinary !== undefined && ordinary.boss === null && !ordinary.id.startsWith('moyu_')) monsters.set(ordinary.id, { ...ordinary, damageMin: Math.max(1, Math.round(ordinary.damageMin * 0.35)), damageMax: Math.max(2, Math.round(ordinary.damageMax * 0.35)), life: Math.max(3, Math.round(ordinary.life * 0.7)), aggroRadius: ordinary.aggroRadius * 0.65 });
    }
    const site: ZonePack | undefined = packs.find((pack: ZonePack): boolean => pack.members.some((member): boolean => member.monster === bossId));
    const npcId = `moyu_challenger_${id}`;
    const lineId = `${npcId}_challenge`;
    const guide: NpcDef | undefined = content.npcs.get('warden_guide');
    if (guide === undefined || site === undefined) throw new Error(`Missing challenger for ${id}`);
    npcs.set(npcId, { ...guide, id: npcId, name: '首领挑战', title: name, service: null, talks: [{ id: lineId, once: false, when: [], lines: [lineId] }] });
    lines.set(lineId, { id: lineId, speaker: npcId, text: `这里的首领是${name}。准备好后继续对话，战斗才会开始。` });
    return [id, { ...zone, level: mapLevel(index), levelUpTo: 41, packs, npcs: [...zone.npcs, { npc: npcId, x: site.x, z: site.z, facingDegrees: 180, when: [{ type: 'flag', flag: moyuBossFlag(id), is: null, not: true }] }], exits: mapExits(zone, content.zones, index) }];
  }));
  return {
    ...content,
    monsters,
    skills: actions.skills,
    itemBases: itemNames(actions.itemBases),
    affixes: elementAffixes(content),
    npcs,
    lines,
    skillTree: graphNodes(),
    rarities: [
      { ...common, name: '普通', affixMin: 1, affixMax: 1 },
      { ...magic, name: '精良', affixMin: 2, affixMax: 2 },
      { ...rare, name: '优秀', affixMin: 3, affixMax: 3 },
      { id: 'epic', name: '史诗', color: '#b982df', marker: 'shaft', weight: 3, affixMin: 4, affixMax: 4, powers: false, wornLimit: null } satisfies RarityDef,
      { ...legendary, name: '传说', affixMin: 5, affixMax: 5, weight: 1, wornLimit: null },
    ],
    trade: { ...content.trade, price: { ...content.trade.price, rarity: { ...content.trade.price.rarity, epic: 8 } } },
    chart: {
      ...content.chart,
      title: MOYU_TITLE,
      revision: content.chart.revision + 2,
      pointsPerLevel: 1,
      respec: { goldPerPoint: 0, goldPerLevel: 0 },
      paths: ELEMENTS.map((element) => ({ id: element.id, name: element.name, tint: element.tint, description: `${element.name}属性与武器联动` })),
      grants: [{ id: 'moyu_start', when: [], points: 1 }, { id: 'moyu_start_bonus', when: [], points: 1 }, ...MOYU_MAPS.map((zone: string) => ({ id: `moyu_visit_${zone}`, when: [{ type: 'visited' as const, zone, not: false }], points: 1 }))],
    },
    player: { ...content.player, skillBook: [{ skill: 'cleave', level: 1, when: [] }, { skill: 'thunderclap', level: 1, when: [] }, { skill: 'storm_bolt', level: 1, when: [] }, { skill: 'dodge_roll', level: 1, when: [] }], skillBar: content.player.skillBar.map((binding, index: number) => ({ ...binding, skill: MOYU_SKILLS[index] ?? null })), xp: { ...content.player.xp, maxLevel: 41 } },
    quests: new Map(),
    zones,
    world: { ...content.world, start: 'hideout', opening: null, acts: [] },
  };
}
