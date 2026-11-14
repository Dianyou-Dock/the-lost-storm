import type { AffixDef, FamilyDef, ItemBaseDef, ItemSlot, RarityDef, SkillDef, StatId } from '../../../sim/content/types.ts';
import { ITEM_SLOTS } from '../../../sim/content/types.ts';
import { statLabel } from '../../../sim/stat-text.ts';
import { ARMOUR_HALF_POINT, armourReduction } from '../../../sim/stats.ts';
import type { GuideData } from '../data.ts';
import { capPercent, SLOT_NAMES, statAmount, statCap } from '../facts.ts';
import { esc, link, list, para, percent, section, table } from '../html.ts';
import type { PageBody } from '../layout.ts';

const STAT_MEANINGS: Readonly<Record<StatId, string>> = {
  maxLife: 'How much you can take before you fall.',
  maxMana: 'How much you can spend on skills before you wait.',
  lifeRegen: 'Life that comes back every second, in a fight or out of it.',
  manaRegen: 'Mana that comes back every second.',
  damageMin: 'The low end of the damage range. Adds to every hit of every skill.',
  damageMax: 'The high end of the damage range. Adds to every hit of every skill.',
  damagePercent: 'A bonus on all your damage, from every skill.',
  attackSpeed: 'How quickly you swing and shoot. Spells do not cast faster for it.',
  critChance: 'The chance that a hit is a critical strike.',
  critMultiplier: 'How much harder a critical strike lands.',
  moveSpeed: 'How fast you walk.',
  armour: 'Takes a share off every hit you take.',
  goldFind: 'More gold from every pile.',
  stormResist: 'Takes a share off storm hits, after armour.',
  frostResist: 'Takes a share off frost hits, after armour.',
};

function capNote(data: GuideData, stat: StatId): string {
  if (stat === 'armour') return `Up to ${percent(data.content.player.resistance.armourCap)} off; ${ARMOUR_HALF_POINT} armour is ${percent(armourReduction(ARMOUR_HALF_POINT, data.content.player.resistance.armourCap))}`;
  if (stat === 'stormResist' || stat === 'frostResist') return `Stops at ${percent(data.content.player.resistance.cap)}`;
  const cap: number | null = statCap(data, stat);
  if (cap === null) return '';
  if (stat === 'moveSpeed') return 'Has a top speed';
  return `Stops at ${capPercent(data, stat)}`;
}

function rarityRows(data: GuideData): string[][] {
  const total: number = data.content.rarities.reduce((sum: number, rarity: RarityDef): number => sum + rarity.weight, 0);
  return data.content.rarities.map((rarity: RarityDef): string[] => [
    `<span style="color: ${esc(rarity.color)}">${esc(rarity.name)}</span>`,
    percent(rarity.weight / total),
    rarity.affixMax === 0 ? 'None' : rarity.affixMin === rarity.affixMax ? String(rarity.affixMin) : `${rarity.affixMin} to ${rarity.affixMax}`,
  ]);
}

function legendaries(data: GuideData): ItemBaseDef[] {
  return [...data.content.itemBases.values()].filter((base: ItemBaseDef): boolean => base.power !== null && base.dropWeight > 0);
}

function familyName(data: GuideData, id: string): string {
  return data.content.families.get(id)?.name ?? '';
}

function legendaryRows(data: GuideData): string[][] {
  return legendaries(data).map((base: ItemBaseDef): string[] => [esc(base.name), base.slot === null ? '' : SLOT_NAMES[base.slot], esc(familyName(data, base.power?.family ?? '')), esc(base.power?.text ?? '')]);
}

function affixRows(data: GuideData): string[][] {
  return [...data.content.affixes.values()].map((affix: AffixDef): string[] => [
    esc(affix.label),
    esc(affix.op === 'percent' ? `more ${statLabel(affix.stat)}` : statLabel(affix.stat)),
    `+${statAmount(affix.stat, affix.op, affix.min)} to ${statAmount(affix.stat, affix.op, affix.max)}`,
    esc(list(affix.slots.map((slot: ItemSlot): string => SLOT_NAMES[slot]))),
  ]);
}

function statsInPlay(data: GuideData): StatId[] {
  const seen: Set<StatId> = new Set<StatId>();
  for (const affix of data.content.affixes.values()) seen.add(affix.stat);
  for (const base of data.content.itemBases.values()) for (const mod of base.implicit) seen.add(mod.stat);
  return [...seen];
}

function weaponRows(data: GuideData): string[][] {
  return [...data.content.itemBases.values()]
    .filter((base: ItemBaseDef): boolean => base.slot === 'weapon' && base.dropWeight > 0 && base.power === null)
    .toSorted((a: ItemBaseDef, b: ItemBaseDef): number => a.minLevel - b.minLevel)
    .map((base: ItemBaseDef): string[] => {
      const low: number = base.implicit.find((mod): boolean => mod.stat === 'damageMin')?.value ?? 0;
      const high: number = base.implicit.find((mod): boolean => mod.stat === 'damageMax')?.value ?? 0;
      const speed: number = base.implicit.find((mod): boolean => mod.stat === 'attackSpeed')?.value ?? 0;
      const changes: string = base.variants.map((variant): string => data.content.skills.get(variant.becomes)?.name ?? '').filter((name: string): boolean => name.length > 0).join(', ');
      return [esc(base.name), String(base.minLevel), `${low} to ${high}`, speed === 0 ? '' : `${speed > 0 ? '+' : '−'}${percent(Math.abs(speed))}`, changes.length === 0 ? '' : `Cleave becomes ${esc(changes)}`];
    });
}

function powered(data: GuideData): RarityDef | undefined {
  return data.content.rarities.find((rarity: RarityDef): boolean => rarity.powers);
}

export function itemsPage(data: GuideData): PageBody {
  const legendary: RarityDef | undefined = powered(data);
  const families: readonly FamilyDef[] = [...data.content.families.values()];
  const growth: string = percent(data.content.itemScaling.implicitPerLevel);
  const quarrel: SkillDef | undefined = data.content.skills.get('quarrel');
  return {
    kicker: 'Guide',
    title: 'Items',
    lede: 'What you can wear, how rare things are, and what every line on an item does for you.',
    description: 'Items in The Lost Storm: the seven slots, rarities and how often each drops, every affix and its range, every weapon, the legendaries, and what each stat does.',
    body: [
      section(
        'slots',
        'What you wear',
        para(
          `You have ${ITEM_SLOTS.length} slots: ${esc(list(ITEM_SLOTS.map((slot: ItemSlot): string => SLOT_NAMES[slot])))}. Your weapon sets your damage range, and every skill you use starts from it, so it is the slot that matters most. Everything else adds life, armour, speed and the rest.`,
          `Every item has a level, about the level you were when it dropped. Its own lines (the ones every item of that kind has) grow by ${growth} for every level above the first, and so do its rolled lines. A level 15 sword is a much better sword than a level 2 one.`,
        ),
      ),
      section(
        'weapons',
        'Weapons',
        [
          para(`The heavier weapons swing slower and hit harder. ${quarrel === undefined ? '' : `A crossbow turns Cleave into ${esc(quarrel.name)}, a shot.`} The damage below is for a level 1 item; it grows with the item's level.`),
          table({ head: ['Weapon', 'From level', 'Damage', 'Attack speed', 'Changes'], rows: weaponRows(data), className: 'wide' }),
        ].join('\n'),
      ),
      section(
        'rarity',
        'Rarity',
        [
          para('Most of what drops is common. Magic and rare items carry extra rolled lines on top of what every item of their kind has. Magic and rare packs drop more, and a rare leader always drops something at least magic.'),
          table({ head: ['Rarity', 'Share of drops', 'Rolled lines'], rows: rarityRows(data) }),
        ].join('\n'),
      ),
      section(
        'legendary',
        'Legendaries',
        [
          para(
            `A ${esc(legendary?.name.toLowerCase() ?? 'legendary')} item is one of a handful of named pieces, each with a power no other item has. You can wear ${legendary?.wornLimit ?? 0} at once at most. They come in ${families.length} families, ${esc(list(families.map((family: FamilyDef): string => family.name)))}, whose powers work together.`,
          ),
          table({ head: ['Item', 'Slot', 'Family', 'Power'], rows: legendaryRows(data), className: 'wide' }),
        ].join('\n'),
      ),
      section(
        'affixes',
        'Rolled lines',
        [
          para('These are the lines a magic, rare or legendary item can roll. The range is for a level 1 item; higher-level items roll higher. No item rolls the same stat twice.'),
          table({ head: ['Line', 'Gives', 'Range at level 1', 'Can appear on'], rows: affixRows(data), className: 'wide' }),
        ].join('\n'),
      ),
      section(
        'stats',
        'What each stat does',
        [
          table({ head: ['Stat', 'What it does', 'Limit'], rows: statsInPlay(data).map((stat: StatId): string[] => [esc(statLabel(stat)), esc(STAT_MEANINGS[stat]), esc(capNote(data, stat))]) }),
          para(`How damage, armour and resistances work together is on the ${link('/guide/combat/', 'combat')} page.`),
        ].join('\n'),
      ),
    ].join('\n'),
  };
}
