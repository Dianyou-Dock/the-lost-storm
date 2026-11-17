import graph from '../../data/moyu-graph.json' with { type: 'json' };
import zh from '../../src/i18n/zh.json' with { type: 'json' };
import type { AffixDef, Content, ItemBaseDef, LineDef, MonsterDef, NpcDef, RarityDef, SkillDef, SkillTreeNodeDef, ZoneDef, ZonePack, ZonePoint } from './types.ts';

export const MOYU_TITLE: string = '摸鱼之路 · 五行天赋图';
export const MOYU_MAPS: readonly string[] = ['under_hall', 'under_hall_2', 'under_hall_3', 'lava_depths', 'lava_depths_2', 'ledger_hall', 'ledger_hall_2', 'ledger_hall_3'];

const ELEMENTS = [
  { id: '金', name: '金', tint: '#f4c44f' },
  { id: '木', name: '木', tint: '#51c878' },
  { id: '水', name: '水', tint: '#429fe8' },
  { id: '火', name: '火', tint: '#ef6047' },
  { id: '土', name: '土', tint: '#9d7957' },
] as const;
const ELEMENT_ORDER: string = '金木水火土';
const ELEMENT_COLORS: ReadonlyMap<string, string> = new Map(ELEMENTS.map((element): [string, string] => [element.id, element.tint]));
const MOYU_LAYOUT = {
  centreX: 1000,
  centreY: 950,
  baseStart: 130,
  baseStep: 82,
  wordRadius: 850,
  synergyRadius: 950,
  synergyStep: 85,
  variantRadius: 1250,
  variantStep: 85,
  confluenceRadius: 1435,
  pairSpread: 78,
  tripleSpread: 100,
} as const;
type MoyuGraphNode = (typeof graph.nodes)[number];

function nodeElements(node: MoyuGraphNode): string[] {
  return [node.element, node.support, node.third].filter((part): part is string => part !== undefined).toSorted((a: string, b: string): number => ELEMENT_ORDER.indexOf(a) - ELEMENT_ORDER.indexOf(b));
}

function elementAngle(element: string): number {
  return -Math.PI / 2 + ELEMENT_ORDER.indexOf(element) * Math.PI * 2 / ELEMENT_ORDER.length;
}

function comboAngle(elements: readonly string[]): number {
  const x: number = elements.reduce((sum: number, element: string): number => sum + Math.cos(elementAngle(element)), 0);
  const y: number = elements.reduce((sum: number, element: string): number => sum + Math.sin(elementAngle(element)), 0);
  return Math.atan2(y, x);
}

function layoutPoint(angle: number, radius: number, tangent: number = 0): { readonly x: number; readonly y: number } {
  return { x: MOYU_LAYOUT.centreX + Math.cos(angle) * radius - Math.sin(angle) * tangent, y: MOYU_LAYOUT.centreY + Math.sin(angle) * radius + Math.cos(angle) * tangent };
}

function layoutCoords(): ReadonlyMap<string, { readonly x: number; readonly y: number }> {
  const placed: Map<string, { readonly x: number; readonly y: number }> = new Map();
  for (const element of ELEMENT_ORDER) {
    const bases = graph.nodes.filter((node): boolean => node.type === 'base' && node.element === element);
    bases.forEach((node, index: number): void => { placed.set(node.id, layoutPoint(elementAngle(element), MOYU_LAYOUT.baseStart + index * MOYU_LAYOUT.baseStep)); });
  }
  const groups: Map<string, MoyuGraphNode[]> = new Map();
  for (const node of graph.nodes) {
    if (!['word', 'synergy', 'variant', 'confluence'].includes(node.type)) continue;
    const key: string = nodeElements(node).join('');
    const group: MoyuGraphNode[] = groups.get(key) ?? [];
    group.push(node);
    groups.set(key, group);
  }
  for (const [key, group] of groups) {
    const angle: number = comboAngle(key.split(''));
    for (const type of ['word', 'synergy', 'variant', 'confluence']) {
      const tier = group.filter((node): boolean => node.type === type);
      tier.forEach((node, index: number): void => {
        const triple: boolean = key.length === 3;
        const radius: number = type === 'word' ? MOYU_LAYOUT.wordRadius : type === 'synergy' ? MOYU_LAYOUT.synergyRadius + Math.floor(index / 2) * MOYU_LAYOUT.synergyStep : type === 'variant' ? MOYU_LAYOUT.variantRadius + Math.floor(index / 3) * MOYU_LAYOUT.variantStep : MOYU_LAYOUT.confluenceRadius;
        const across: number = type === 'synergy' ? index % 2 : type === 'variant' ? index % 3 : index;
        const width: number = type === 'synergy' ? Math.min(2, tier.length) : type === 'variant' || type === 'confluence' ? Math.min(3, tier.length) : tier.length;
        placed.set(node.id, layoutPoint(angle, radius, (across - (width - 1) / 2) * (triple ? MOYU_LAYOUT.tripleSpread : MOYU_LAYOUT.pairSpread)));
      });
    }
  }
  return placed;
}

const COORDS: ReadonlyMap<string, { readonly x: number; readonly y: number }> = layoutCoords();
const BOSS_TEMPLATES: readonly string[] = ['stormcaller_rival', 'timekeeper_gatekeeper', 'unfinished_colossus'];
const BOSS_NAMES: readonly string[] = ['下层回响', '洞窟回响', '深窟回响', '熔渊斗士', '熔渊巨像', '账厅守卫', '账厅裁决者', '终厅巨像'];
const MOYU_NODE_TYPES: ReadonlySet<string> = new Set(['base', 'word', 'synergy', 'variant', 'confluence']);
const MOYU_SKILLS: readonly string[] = ['cleave', 'thunderclap', 'storm_bolt', 'dodge_roll'];
export const MOYU_ACTIONS: readonly string[] = MOYU_SKILLS.slice(0, 3);
export const MOYU_UNBOUND = 'none';
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
const ELEMENT_BONUS: Readonly<Record<string, string>> = {
  金: '连续命中同一目标后，下一击穿透部分防护',
  木: '连续命中积累生息，触发有间隔的生命恢复',
  水: '交替使用不同技能时返还能量并缩短本次冷却',
  火: '持续施放积累燃势，使第三次动作更快',
  土: '施放技能获得守势，抵消下一次伤害；移动会加速消散',
};
const COMBO_RULES: Readonly<Record<string, string>> = {
  'word-流血': '命中施加 3 秒流血，每秒造成少量伤害。',
  'word-破甲': '命中正在防御的敌人时，额外提高本次伤害。',
  'word-锋锐': '命中使下一次锋锐攻击获得额外伤害；剑的连斩触发破绽时额外爆发。',
  'word-毒蚀': '命中施加 5 秒毒蚀，持续造成少量伤害。',
  'word-缠绕': '命中短暂定身；同一目标 3 秒内最多一次。',
  'word-再生': '命中时恢复少量生命，每 2 秒最多一次。',
  'word-寒伤': '命中使目标的行动速度短暂降低。',
  'word-冰封': '对同一目标命中 3 次后短暂冰封，首领受控时间较短。',
  'word-净化': '命中时移除自身灼烧、定身与减速，每 5 秒最多一次；剑的格挡反击成功时额外回血并缩短冷却。',
  'word-灼烧': '命中施加灼烧，每 0.75 秒造成少量伤害。',
  'word-躁动': '命中使目标的行动与施法节奏短暂变慢。',
  'word-急速': '命中使自身短暂加速，每 3 秒最多触发一次。',
  'word-震击': '命中正在防御的敌人时造成额外伤害。',
  'word-失衡': '命中正在蓄力的敌人时打断动作；同一目标 4 秒内最多一次。',
  'word-固守': '命中获得一层守势，抵挡下一次伤害，每 2 秒最多一次。',
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

export function moyuBindingKey(skill: string): string {
  return `moyu:${skill}`;
}

export function moyuComboChoices(allocated: readonly string[]): MoyuGraphNode[] {
  return allocated.map(moyuNode).filter((node): node is MoyuGraphNode => node !== null && (node.type === 'word' || node.type === 'variant'));
}

export function moyuBoundCombo(allocated: readonly string[], changes: Readonly<Record<string, string>>, skill: string): MoyuGraphNode | null {
  if (!MOYU_ACTIONS.includes(skill)) return null;
  const chosen = changes[moyuBindingKey(skill)];
  if (chosen === MOYU_UNBOUND) return null;
  const choices = moyuComboChoices(allocated);
  return choices.find((node): boolean => node.id === chosen) ?? (chosen === undefined ? choices[0] : null) ?? null;
}

export function moyuComboRoot(node: MoyuGraphNode): string {
  if (node.type === 'word') return node.id;
  return node.prereq.find((id: string): boolean => moyuNode(id)?.type === 'word') ?? '';
}

export function moyuComboDescription(node: MoyuGraphNode): string {
  const base = COMBO_RULES[moyuComboRoot(node)] ?? node.desc;
  return node.type === 'variant' ? `${base} 第三元素使效果量提高 20%。` : base;
}

export interface MoyuSkillEffect {
  readonly label: string;
  readonly color: string;
  readonly count: number;
}

export function moyuSkillEffect(allocated: readonly string[]): MoyuSkillEffect | null {
  const nodes = allocated.toReversed().map(moyuNode).filter((node): boolean => node !== null && MOYU_NODE_TYPES.has(node.type));
  const linked = nodes.find((node): boolean => node !== null && node.type !== 'base') ?? nodes[0];
  if (linked === undefined || linked === null) return null;
  const elements = nodeElements(linked);
  const colors = elements.map((element: string): string => ELEMENT_COLORS.get(element) ?? '#ffffff');
  const rank = linked.type === 'word' || linked.type === 'variant' ? graph.nodes.filter((node): boolean => node.type === linked.type && nodeElements(node).join('') === elements.join('')).findIndex((node): boolean => node.id === linked.id) : 0;
  const offsets = [12 * rank, -7 * rank, 9 * rank];
  const channels = [1, 3, 5].map((offset: number, index: number): number => Math.max(0, Math.min(255, Math.round(colors.reduce((sum: number, color: string): number => sum + Number.parseInt(color.slice(offset, offset + 2), 16), 0) / colors.length) + (offsets[index] ?? 0))));
  return { label: elements.join('·'), color: `#${channels.map((channel: number): string => channel.toString(16).padStart(2, '0')).join('')}`, count: elements.length };
}

export function hotWeapon(id: string): boolean {
  const node = moyuNode(id);
  return node !== null && ['手枪', '冲锋枪', '霰弹枪', '步枪', '狙击枪'].includes(node.weapon ?? '');
}

export function moyuRequirements(allocated: readonly string[], id: string): boolean {
  const node = moyuNode(id);
  if (node === null || !MOYU_NODE_TYPES.has(node.type) || allocated.length >= 50) return false;
  if (node.type === 'word' || node.type === 'variant') {
    const main = allocated.filter((entry: string): boolean => entry.startsWith(`base-${node.element}-`)).length;
    if (main < 3) return false;
    if (node.support !== undefined && !allocated.some((entry: string): boolean => entry.startsWith(`base-${node.support}-`))) return false;
    if (node.third !== undefined && !allocated.some((entry: string): boolean => entry.startsWith(`base-${node.third}-`))) return false;
  }
  if (!node.prereq.every((required: string): boolean => allocated.includes(required))) return false;
  return true;
}

function graphNodes(): SkillTreeNodeDef[] {
  return graph.nodes.filter((node): boolean => MOYU_NODE_TYPES.has(node.type)).map((node): SkillTreeNodeDef => {
    const point = COORDS.get(node.id);
    const links: string[] = node.type === 'word' ? [`base-${node.element}-3`] : graph.links.flatMap((link): string[] => link.b === node.id && link.a !== 'root' && MOYU_NODE_TYPES.has(moyuNode(link.a)?.type ?? '') ? [link.a] : []);
    const path: string = node.element ?? '金';
    const active: boolean = node.type !== 'base';
    const elements: readonly string[] = [node.element, node.support, node.third].filter((entry): entry is string => entry !== undefined);
    const bonuses = elements.flatMap((element: string) => ELEMENT_BONUS[element] === undefined ? [] : [`${element}：${ELEMENT_BONUS[element]}`]);
    const baseDescription: string = node.desc.replace(/[。；]+$/, '');
    return {
      id: node.id,
      name: node.name,
      description: node.type === 'word' || node.type === 'variant' ? `${elements.join('·')}技能：${moyuComboDescription(node)}` : active ? `${elements.join('·')}联动：强化${elements.join('、')}的核心机制。${bonuses.join('；')}。` : `${baseDescription}；${bonuses.join('；')}。累计 3 点基础天赋激活，5 点与 8 点强化。`,
      icon: 'focus',
      kind: active ? 'notable' : 'minor',
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
    ['木', 'lifeRegen', 'percent', 0.02, 0.05],
    ['水', 'manaRegen', 'percent', 0.02, 0.05],
    ['火', 'attackSpeed', 'percent', 0.015, 0.05],
    ['土', 'armour', 'percent', 0.02, 0.05],
  ] as const;
  for (const [element, stat, op, min, max] of entries) affixes.set(`moyu_${element}`, { id: `moyu_${element}`, label: `${element}行`, slots, stat, op, min, max, perLevel: 0.01 });
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
