import type { GuideData } from '../data.ts';
import { guideData, item, path, place, skill } from '../data.ts';
import {
  affixLine,
  afterRouteText,
  bossLevels,
  bossSpeedRank,
  capPercent,
  carelessBossShare,
  carelessDeaths,
  deathWords,
  familyNames,
  heavyWeapons,
  legendaryLine,
  manaWeapons,
  modShare,
  placeLevel,
  quickWeapons,
  speedRank,
  steadyBossShare,
  steadyBossLife,
  steadyDeaths,
  variantName,
  variantWeapons,
  weaponNames,
} from '../facts.ts';
import { esc, percent } from '../html.ts';
import type { BuildNotes } from './build-page.ts';
import { buildName } from './build-page.ts';

function name(data: GuideData, id: string): string {
  return esc(place(data, id).name);
}

function skillName(data: GuideData, id: string): string {
  return esc(skill(data, id).name);
}

function pathName(data: GuideData, id: string): string {
  return esc(path(data, id).name);
}

function glass(data: GuideData): BuildNotes {
  const id: string = 'glass-cannon';
  const shot: string = esc(variantName(data, 'worn_crossbow', 'cleave'));
  const keystone: number = placeLevel(data, id, 'edge_without_rest');
  const lifeCut: string = percent(modShare(data, 'edge_without_rest', 'maxLife'));
  const [first = 0, second = 0] = bossLevels(data);
  return {
    id,
    ...buildName(id),
    mainSkill: skill(data, 'quarrel').name,
    forWho: 'For players who want every fight over before it reaches them, and who would rather roll out of a blow than take it.',
    plays: [
      `Hold a crossbow and ${skillName(data, 'cleave')} becomes ${shot}: a shot that costs nothing and waits for nothing. The woman wakes with the ${esc(item(data, 'worn_crossbow').name)}. Anyone else picks one up later; crossbows drop like any other weapon, and the trader sometimes has one.`,
      `The Glass Cannon walks ${pathName(data, 'blade')} for its plain Damage, critical strikes and attack speed, all of which count for your shots. ${shot} is a bolt skill, not a weapon skill, so the route also crosses into ${pathName(data, 'storm')} for the places that make bolt skills stronger. At level ${placeLevel(data, id, 'whirling_cleave')} ${name(data, 'whirling_cleave')} turns ${shot} into a fan of bolts across the way ahead. Soon after, at level ${placeLevel(data, id, 'slip_through')}, ${name(data, 'slip_through')} turns your ${skillName(data, 'dodge_roll')} into a slip through the mist to wherever you aim.`,
      'That is the whole rhythm: shoot the fan into the pack, and when something big closes in or winds up, slip out to a clear spot and keep shooting.',
      `At level ${keystone}, after your first fight with the boss, you take ${name(data, 'edge_without_rest')}. It costs you ${lifeCut} of your life and gives your critical strikes far more weight. From then on you have very little life. That trade is the point of the build: nothing should reach you.`,
    ],
    lean: [
      `${shot} is the button you hold. It swings nothing and costs nothing, so your crossbow's damage is most of your damage: a better crossbow is the biggest upgrade you can find, bigger than any one place on the tree.`,
      `Your roll is your armour. ${skillName(data, 'dodge_roll')} cuts your own attack short and nothing hits you early in it. Once you have ${name(data, 'slip_through')}, aim it at open ground, never into the pack.`,
      `${skillName(data, 'thunderhead')} is your opener on anything with a lot of life. Hold it until it is charged and let it go.`,
    ],
    lookFor: [
      `A crossbow with more damage: ${weaponNames(variantWeapons(data, 'cleave'))}.`,
      legendaryLine(data, 'quietshot'),
      affixLine(data, 'jagged'),
      affixLine(data, 'honed'),
      affixLine(data, 'keen'),
      affixLine(data, 'cruel'),
      affixLine(data, 'hale'),
    ],
    avoid: [
      `Swords, axes, maces and staves. Without a crossbow, ${shot} is ${skillName(data, 'cleave')} again, and this build has no life to stand in the crowd.`,
      `Critical strike chance past ${capPercent(data, 'critChance')}. It stops counting there.`,
      `Mana on gear. ${shot} costs nothing.`,
    ],
    strengths: [
      'Packs that come at you from the front. The fan of bolts covers them all.',
      `The boss once it has grown. At level ${second} it won ${percent(steadyBossShare(data, id, second))} of its fights played steadily and ${percent(carelessBossShare(data, id, second))} played carelessly.`,
      'Staying out of reach. Most enemies die before they get to you.',
    ],
    weakSpots: [
      `The boss at level ${first}. Played steadily it won ${percent(steadyBossShare(data, id, first))} of those fights, and played carelessly ${percent(carelessBossShare(data, id, first))}. Come back a few levels later.`,
      'The boss\'s holding lines. They stop you in place, and you have no life to spare while you are held.',
      'Enemies all around you at once. The fan only covers the front: roll out until they are on one side.',
    ],
    thin: [
      'The simulated player that made the numbers on this page never rolls, so they show the build without its best tool. A player who rolls well does better than these numbers say.',
      `Nothing on the Skill Tree is made for crossbows alone, and the places that say "weapon skills" do not count for ${shot}. What helps is plain Damage, critical strikes, attack speed and the few places for bolt skills.`,
    ],
    marks: {
      heavy_hands: 'The single biggest damage place early.',
      whirling_cleave: `With a crossbow, ${shot} now looses a fan of bolts. The build starts here.`,
      slip_through: 'Your roll now goes where you aim.',
      edge_without_rest: `This is where you give up ${lifeCut} of your life. Its extra damage is for weapon skills and does not reach ${shot}; you take it for the critical strikes. The route puts it after level ${first}, once the first boss is behind you.`,
      storm_12: `More damage for bolt skills, which ${shot} is.`,
      windborne: `A shorter wait on ${skillName(data, 'dodge_roll')}.`,
    },
    afterRoute: afterRouteText(data, id, 'Each one adds damage, speed or a shorter wait on the roll.'),
  };
}

function tank(data: GuideData): BuildNotes {
  const id: string = 'bulwark';
  const keystone: number = placeLevel(data, id, 'the_unmoved');
  const slow: string = percent(modShare(data, 'the_unmoved', 'moveSpeed'));
  const armour: string = percent(modShare(data, 'the_unmoved', 'armour'));
  const heave: number = placeLevel(data, id, 'heaving_cleave');
  const [first = 0] = bossLevels(data);
  return {
    id,
    ...buildName(id),
    mainSkill: null,
    forWho: 'For players who want a big weapon, slow heavy blows, and to walk out of every fight.',
    plays: [
      `You stand in the pack and let it come to you. The Bulwark takes ${pathName(data, 'stone')}, the path of life and armour, and spends little on damage until it is hard to kill. Later it crosses into ${pathName(data, 'echo')} for skills that hit a whole crowd.`,
      `${skillName(data, 'thunderclap')} is your first point: when the pack closes around you, slam the ground and they are thrown back and staggered. ${skillName(data, 'held_breath')} comes at level ${placeLevel(data, id, 'stone_held_breath')}. Use it when you are surrounded or a big enemy is winding up: everything near you slows to a crawl and you do not.`,
      `At level ${heave} ${name(data, 'heaving_cleave')} lets you hold ${skillName(data, 'cleave')}: let go and one heavy sweep throws everything in front of you far back. The longer you hold, the bigger and harder the sweep.`,
      `At level ${keystone} you take ${name(data, 'the_unmoved')}: ${armour} more armour, more life and more damage, and you move ${slow} slower. You stop being quick. You also stop being in danger.`,
    ],
    lean: [
      `Lean on ${skillName(data, 'cleave')}, held. A held sweep from ${name(data, 'heaving_cleave')} hits far harder than a quick swing and throws the pack off you.`,
      `${skillName(data, 'thunderclap')} is not your damage; it is how you stop being hit while the sweep is gathering. ${skillName(data, 'held_breath')} has a long wait, so keep it for the moment a fight turns.`,
    ],
    lookFor: [
      `A heavy weapon: ${weaponNames(heavyWeapons(data))}. They swing slower and hit much harder, which suits a held sweep.`,
      legendaryLine(data, 'groundbreaker'),
      affixLine(data, 'hale'),
      affixLine(data, 'vital'),
      affixLine(data, 'plated'),
      affixLine(data, 'sturdy'),
      affixLine(data, 'mending'),
    ],
    avoid: [
      `Crossbows. A crossbow turns ${skillName(data, 'cleave')} into a shot, and this build wants enemies close.`,
      'Trading life or armour for damage on gear. The tree gives you damage later; your gear keeps you standing.',
      'Chasing fast enemies across the map. Let them come.',
    ],
    strengths: [
      `Surviving. In the measurements it ${deathWords(steadyDeaths(data, id))} played steadily and ${deathWords(carelessDeaths(data, id))} played carelessly.`,
      `The boss, even with mistakes. Played carelessly it won ${percent(carelessBossShare(data, id, first))} of its fights with the boss at level ${first}.`,
    ],
    weakSpots: [
      `Quick boss fights. Against the boss at level ${first} it was ${bossSpeedRank(data, id, first)} build to win: it wins, but it takes its time.`,
      'Enemies that run or throw from far away. You walk to them slowly.',
    ],
    thin: [
      'The game has no two-handed weapons as such. The heavy weapons are simply the ones that swing slower and hit harder, and nothing on the tree rewards a slow weapon over a quick one.',
      'The simulated player wears whatever raises its damage and toughness most, not always a heavy weapon, so the numbers here are for the route, not for the weapon.',
    ],
    marks: {
      stone_thunderclap: 'Your first point. It buys you room from the first fight.',
      tempered_body: 'Life and life regeneration early. The build begins to feel sturdy here.',
      heaving_cleave: 'Hold Cleave for the big sweep. The build starts here.',
      the_unmoved: `${armour} more armour, more life, more damage, ${slow} slower.`,
      worn_groove: 'From here the route turns toward area damage.',
    },
    afterRoute: afterRouteText(data, id, 'More life and more area. Nothing past here makes you more fragile.'),
  };
}

function whirlwind(data: GuideData): BuildNotes {
  const id: string = 'whirlwind';
  const whirl: number = placeLevel(data, id, 'whirling_cleave');
  const endless: number = placeLevel(data, id, 'endless_turn');
  const wake: number = placeLevel(data, id, 'long_wake');
  const wheel: string = skillName(data, 'cleave_millwheel');
  const millwheel: string = esc(item(data, 'the_millwheel').name);
  const [first = 0, second = 0, top = 0] = bossLevels(data);
  return {
    id,
    ...buildName(id),
    mainSkill: wheel,
    forWho: 'For players who want to spin through a pack and out the other side without stopping.',
    plays: [
      `At level ${whirl} ${name(data, 'whirling_cleave')} turns ${skillName(data, 'cleave')} into a full turn that strikes everything around you. At level ${endless} ${name(data, 'endless_turn')} turns that into the ${wheel}: hold it and you keep turning while you run.`,
      `Every enemy the ${wheel} strikes builds momentum: you turn faster, reach wider and nothing knocks you off your feet. ${name(data, 'millstone')}, right after, lets the momentum climb higher and gives you life for every enemy struck.`,
      `From there it crosses into ${pathName(data, 'wind')} for speed: ${name(data, 'racing_cloud')} makes you attack and move faster, and ${name(data, 'long_wake')} at level ${wake} holds your momentum longer after the last hit, so it carries from one pack to the next.`,
    ],
    lean: [
      `The ${wheel} is the button you hold. Each hit gives back a little mana and turning through empty air only spends it, so keep it turning through enemies, not between them.`,
      `Because it swings your weapon, your weapon's damage is most of your damage. Every place on the route that says "weapon skills", "Damage" or "Attack Speed" makes each turn hit harder or come sooner.`,
      `${millwheel}, a legendary weapon, makes ${skillName(data, 'cleave')} the ${wheel} by itself. With it in hand ${name(data, 'endless_turn')} has nothing left to change, but ${name(data, 'millstone')} and ${name(data, 'long_wake')} still count.`,
    ],
    lookFor: [
      'A weapon with more damage that does not swing slower. Read the damage range first.',
      affixLine(data, 'quick'),
      affixLine(data, 'honed'),
      affixLine(data, 'fleet'),
      affixLine(data, 'hale'),
      affixLine(data, 'jagged'),
    ],
    avoid: [
      `Crossbows. A crossbow turns ${skillName(data, 'cleave')} into a shot, and this build lives in the middle of the pack.`,
      'Stopping. Momentum fades a moment after the last hit, and a turn that starts cold is a slow one.',
    ],
    strengths: [
      'Crowds. Every turn hits everything around you, and the more it hits the faster it turns.',
      `Levelling. It was ${speedRank(data, id, second)} build to reach level ${second}.`,
      'Moving. You keep turning while you run, so the pack and the next one are one fight.',
      `The boss, once it is grown. At level ${top} it won ${percent(steadyBossShare(data, id, top))} of its fights played steadily, with ${percent(steadyBossLife(data, id, top))} of its life left on average.`,
    ],
    weakSpots: [
      `The boss early on. At level ${first} it won ${percent(steadyBossShare(data, id, first))} of its fights played steadily and ${percent(carelessBossShare(data, id, first))} played carelessly: the boss is one enemy, and a turn made for crowds builds little momentum on one.`,
      `Mistakes. There is little between you and the blow: played carelessly it ${deathWords(carelessDeaths(data, id))}.`,
    ],
    thin: [],
    marks: {
      heavy_hands: 'The single biggest damage place early.',
      whirling_cleave: 'The build starts here.',
      endless_turn: `Your turn becomes the ${wheel}.`,
      millstone: 'More momentum, and life for every enemy struck.',
      racing_cloud: 'Faster attacks and faster feet.',
      long_wake: 'Momentum that lasts from one pack to the next.',
    },
    afterRoute: afterRouteText(data, id, 'More damage and more ways to move.'),
  };
}

function caster(data: GuideData): BuildNotes {
  const id: string = 'stormcaller';
  const lance: number = placeLevel(data, id, 'storm_lance');
  const keystone: number = placeLevel(data, id, 'eye_of_the_storm');
  const lifeCut: string = percent(modShare(data, 'eye_of_the_storm', 'maxLife'));
  const [first = 0, second = 0] = bossLevels(data);
  return {
    id,
    ...buildName(id),
    mainSkill: null,
    forWho: 'For players who want to fight from a distance and let the lightning do the work.',
    plays: [
      `Your first point is ${skillName(data, 'storm_bolt')}, and from then on it is the button you press. The Stormcaller walks ${pathName(data, 'storm')}, which makes lightning stronger and gives you the mana to keep casting.`,
      `${name(data, 'forked_bolt')} soon makes each cast throw more bolts. At level ${lance} ${name(data, 'storm_lance')} changes the skill: one straight line of lightning that hits everything along it at once. Step back so the pack comes at you along the line.`,
      `${skillName(data, 'squall')} comes early too. Drop it where the pack is coming: it strikes everything under it every half second while you keep casting.`,
      `At level ${keystone} you take ${name(data, 'eye_of_the_storm')}. It costs ${lifeCut} of your life and makes your lightning far stronger. After that, keep your distance.`,
    ],
    lean: [
      `${skillName(data, 'storm_bolt')} costs a little mana every cast. Mana is your limit, not waiting. The places on the route that add mana are there for this, and so is the mana flask on 2.`,
      `Your skills still add your weapon's damage, so a weapon with more damage helps. A staff that adds mana helps more early on.`,
    ],
    lookFor: [
      `A staff that adds mana: ${weaponNames(manaWeapons(data))}.`,
      `The Forkweather legendaries: ${familyNames(data, 'forkweather')}.`,
      affixLine(data, 'brimming'),
      affixLine(data, 'clear'),
      affixLine(data, 'honed'),
      affixLine(data, 'hale'),
      affixLine(data, 'grounded'),
    ],
    avoid: [
      'Attack speed on gear. Your spells do not cast faster for it.',
      'Standing in the pack. Storm Lance is a line: step back so the enemies come at you along it.',
    ],
    strengths: [
      'Packs that come at you from one side. Storm Lance hits the whole line.',
      `The boss once the build comes together. At level ${second} it was ${bossSpeedRank(data, id, second)} build to win.`,
    ],
    weakSpots: [
      'Running out of mana in a long fight. Drink the mana flask before you are empty, not after.',
      `Being caught. With ${name(data, 'eye_of_the_storm')} taken you have little life. Played carelessly it won ${percent(carelessBossShare(data, id, first))} of its fights with the boss at level ${first}.`,
      'Enemies all around you at once. Step out so they are on one side again.',
    ],
    thin: [],
    marks: {
      storm_storm_bolt: 'Your first point, and your main skill from now on.',
      storm_lance: 'The build starts here.',
      eye_of_the_storm: `This is where you give up ${lifeCut} of your life for a lot more lightning damage.`,
      rolling_thunder: `This one changes ${skillName(data, 'thunderclap')}, which this build does not have. The route passes through it on the way to the keystone.`,
      standing_thunder: `Also for ${skillName(data, 'thunderclap')}. If you never took Thunderclap, take the next place on the route instead.`,
    },
    afterRoute: afterRouteText(data, id, 'These turn toward the weapon path: worth it only if you start using Cleave as well.'),
  };
}

function echoer(data: GuideData): BuildNotes {
  const id: string = 'echo-weaver';
  const keystone: number = placeLevel(data, id, 'twice_remembered');
  const [first = 0, second = 0] = bossLevels(data);
  return {
    id,
    ...buildName(id),
    mainSkill: null,
    forWho: 'For players who like to set the ground alight and let the crowd walk into it.',
    plays: [
      `Your first point is ${skillName(data, 'forkline')}: lightning that jumps from enemy to enemy. The Echo Weaver walks ${pathName(data, 'echo')}, the path of skills that hit an area and of skills that happen twice.`,
      `At level ${placeLevel(data, id, 'twice_swung')} ${name(data, 'twice_swung')} makes your swing happen twice. Fork lightning into the pack, then cut what comes close.`,
      `At level ${placeLevel(data, id, 'echoing_fork')} ${name(data, 'echoing_fork')} makes Forkline happen twice. At level ${keystone} ${name(data, 'twice_remembered')} trades a little damage on everything for bigger, longer area skills and a shorter wait on ${skillName(data, 'held_breath')}.`,
    ],
    lean: [
      `${skillName(data, 'forkline')} is the button you press most. It is best against a crowd, where every jump finds a new enemy.`,
      `Every echo hits again for free, so a crowd is where the build is strongest.`,
    ],
    lookFor: [
      `A staff that adds mana: ${weaponNames(manaWeapons(data))}.`,
      legendaryLine(data, 'rainmaker'),
      affixLine(data, 'brimming'),
      affixLine(data, 'clear'),
      affixLine(data, 'honed'),
      affixLine(data, 'hale'),
      affixLine(data, 'vital'),
    ],
    avoid: [
      'Attack speed and critical strikes on gear. Your damage comes from your skills.',
      'Forking lightning at a single enemy. Wait a moment for the pack to come.',
    ],
    strengths: [
      `Clearing. It was ${speedRank(data, id, second)} build to reach level ${second}.`,
      `The boss. At level ${second} it was ${bossSpeedRank(data, id, second)} build to win, and played steadily it won ${percent(steadyBossShare(data, id, first))} of its fights at level ${first}.`,
    ],
    weakSpots: [
      'Mana. Forkline costs it every cast; drink the mana flask before you run dry.',
      `Mistakes at the start. Played carelessly it won ${percent(carelessBossShare(data, id, first))} of its fights with the boss at level ${first}.`,
    ],
    thin: [],
    marks: {
      echo_forkline: 'Your first point, and your main skill.',
      twice_swung: 'Your swing happens twice from here.',
      twice_remembered: 'Bigger, longer area skills for a little less damage on everything.',
      thunder_in_the_bones: `From here the route turns to ${pathName(data, 'storm')}, which makes lightning stronger. Forkline is lightning.`,
    },
    afterRoute: afterRouteText(data, id, 'More lightning damage and more mana.'),
  };
}

function windrunner(data: GuideData): BuildNotes {
  const id: string = 'windrunner';
  const keystone: number = placeLevel(data, id, 'never_still');
  const armourCut: string = percent(modShare(data, 'never_still', 'armour'));
  const [first = 0, second = 0] = bossLevels(data);
  return {
    id,
    ...buildName(id),
    mainSkill: null,
    forWho: 'For players who never want to stand still, and who like to be somewhere else when the blow lands.',
    plays: [
      `The Windrunner walks ${pathName(data, 'wind')}. Your first point is ${skillName(data, 'mist_step')}: turn to mist and reappear where you aim, throwing aside whatever stands there. It is how you get into a pack and how you get out.`,
      `${skillName(data, 'cleave')} is still your damage. ${skillName(data, 'downdraught')} comes at level ${placeLevel(data, id, 'wind_downdraught')} and pulls a scattered pack together so every swing hits more of them. At level ${placeLevel(data, id, 'slip_through')} ${name(data, 'slip_through')} turns your ${skillName(data, 'dodge_roll')} into a slip through the mist to where you aim.`,
      `At level ${keystone} you take ${name(data, 'never_still')}: faster attacks, faster feet and shorter waits on your movement skills, and ${armourCut} less armour.`,
    ],
    lean: [
      `Lean on ${skillName(data, 'cleave')} for damage and on ${skillName(data, 'mist_step')} for everything else. Step in, swing, and when a big blow is coming, step out to the other side of the pack.`,
      `${name(data, 'updraught')} later turns Downdraught into a burst that throws everything away from you. Use it when you are surrounded rather than to gather a pack.`,
    ],
    lookFor: [
      `A quick light blade: ${weaponNames(quickWeapons(data))}. Cleave is still what kills.`,
      legendaryLine(data, 'mist_treader_boots'),
      affixLine(data, 'fleet'),
      affixLine(data, 'quick'),
      affixLine(data, 'honed'),
      affixLine(data, 'hale'),
    ],
    avoid: [
      'Crossbows. They turn Cleave into a shot, and you want to be among the enemies, if only for a moment.',
      'Armour to make up for the keystone. Life does more for you.',
    ],
    strengths: [
      `Getting going. It was ${speedRank(data, id, first)} build to reach level ${first}.`,
      'Getting out of trouble. No build moves as much or as often.',
      `The boss, once it is grown. Played steadily it won ${percent(steadyBossShare(data, id, second))} of its fights at level ${second}.`,
    ],
    weakSpots: [
      `The boss at level ${first}. Played steadily it won ${percent(steadyBossShare(data, id, first))} of its fights there. Get a few more levels before you go.`,
      'Fights you cannot step out of. If you are held in place, your low armour shows.',
    ],
    thin: [],
    marks: {
      wind_mist_step: 'Your first point, and the skill the whole build moves with.',
      slip_through: 'Your roll now goes where you aim.',
      never_still: `Faster at everything, and ${armourCut} less armour.`,
      tempered_body: `From here the route turns to ${pathName(data, 'stone')} for life.`,
    },
    afterRoute: afterRouteText(data, id, 'More life from the stone path: the right answer to a build that gave up its armour.'),
  };
}

export function buildNotes(data: GuideData): readonly BuildNotes[] {
  return [glass(data), tank(data), whirlwind(data), caster(data), echoer(data), windrunner(data)];
}

export const BUILD_NOTES: readonly BuildNotes[] = buildNotes(guideData());
