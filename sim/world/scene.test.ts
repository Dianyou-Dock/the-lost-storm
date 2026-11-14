import assert from 'node:assert/strict';
import { test } from 'node:test';
import { must, withoutGlitches, worldIn, zoneOf } from '../../test/support.ts';
import { loadContent } from '../content/content.ts';
import type { SceneDef } from '../content/scene-types.ts';
import type { Content, MonsterDef, SkillDef, ZoneExit } from '../content/types.ts';
import type { Vec2 } from '../math.ts';
import { distance } from '../math.ts';
import { isWalkable, lineWalkable } from '../nav/grid.ts';
import { parseSaveText, toSave } from '../save.ts';
import { createWorld } from './create.ts';
import { echoMonsters, forceStrike, wakeMoment } from './moments.ts';
import { lineSeconds } from './reading.ts';
import { SCENE } from './scene.ts';
import { spawnMonster } from './spawn.ts';
import { stepWorld } from './step.ts';
import type { Command, MomentState, MonsterState, NpcState, World, WorldEvent } from './types.ts';
import { enterZone } from './zones.ts';

const content: Content = loadContent();
const DT: number = 1 / 30;
const HALL: string = 'hall_of_time';
const APPROACH: Vec2 = { x: 50, z: 30 };
const LAGGING: Vec2 = { x: 58, z: 30 };
const LIMIT = { reach: 20, meeting: 40, walk: 60 } as const;
const QUIET: number = 1e9;
const ADJACENT: number = 1.2;
const DOORSTEP: number = 1;

type EventOf<T extends WorldEvent['type']> = Extract<WorldEvent, { readonly type: T }>;

function ofType<T extends WorldEvent['type']>(events: readonly WorldEvent[], type: T): EventOf<T>[] {
  return events.filter((event: WorldEvent): event is EventOf<T> => event.type === type);
}

function meeting(): SceneDef {
  return must(zoneOf(content, HALL).scenes[0], 'the Hall scene');
}

function exitOf(world: World, id: string): ZoneExit {
  return must(world.zone.exits.find((exit: ZoneExit): boolean => exit.id === id), `exit ${id}`);
}

function quiet(world: World): World {
  for (const monster of world.monsters) world.events.push({ type: 'monster_remove', monsterId: monster.id });
  world.monsters = [];
  world.flags['first_moment'] = 'cleared';
  world.strikeTimer = QUIET;
  world.events = [];
  return world;
}

function hall(seed: number = 1): World {
  const world: World = quiet(withoutGlitches(worldIn(content, HALL, seed)));
  world.player.pos = { ...APPROACH };
  return world;
}

function run(world: World, seconds: number, commands: () => Command[] = (): Command[] => [], until: () => boolean = (): boolean => false): WorldEvent[] {
  const events: WorldEvent[] = [];
  for (let elapsed: number = 0; elapsed < seconds && !until(); elapsed += DT) events.push(...stepWorld(world, commands(), DT));
  return events;
}

function towardExit(world: World): () => Command[] {
  const exit: ZoneExit = exitOf(world, meeting().lead.exit);
  return (): Command[] => [{ type: 'move', held: true, dest: { x: exit.x, z: exit.z } }];
}

function phaseOf(world: World): string | null {
  return world.scene?.phase ?? null;
}

function momentIdOf(world: World): number | null {
  return world.scene?.momentId ?? null;
}

function warden(world: World): NpcState {
  return must(world.npcs.find((npc: NpcState): boolean => npc.id === world.scene?.npcId), 'the Warden in the scene');
}

function untilPhase(world: World, phase: string, commands: () => Command[] = (): Command[] => []): WorldEvent[] {
  const events: WorldEvent[] = run(world, LIMIT.meeting, commands, (): boolean => world.scene?.phase === phase);
  assert.equal(world.scene?.phase, phase, `the scene reaches ${phase}`);
  return events;
}

void test('the shipped meeting stands on open ground away from the exit it leads to, and its Warden strikes with a hit that shows', (): void => {
  const world: World = hall();
  const def: SceneDef = meeting();
  const exit: ZoneExit = exitOf(world, def.lead.exit);
  assert.ok(isWalkable(world.grid, def.x, def.z));
  assert.ok(isWalkable(world.grid, def.lead.x, def.lead.z));
  assert.ok(distance(def.lead, exit) > exit.radius + 1, 'he waits beside the way out, not on it');
  assert.ok(lineWalkable(world.grid, def.lead, exit));
  assert.ok(distance(exit, def) + exit.radius <= def.radius, 'every way to the exit passes through the meeting');
  const skill: SkillDef = must(content.skills.get(def.strike), 'the strike');
  assert.ok(skill.knockback > 0 && skill.stagger > 0 && skill.shake > 0 && skill.hitStop > 0 && skill.vfx.impact !== null);
  assert.deepEqual(def.lines, ['warden_guide_fell', 'warden_guide_counted', 'warden_guide_road']);
});

void test('the first time the hero nears the far end a moment is brought down on the path, wakes around the hero and holds the fight', (): void => {
  const world: World = hall();
  assert.equal(world.moments.length, 0);
  run(world, LIMIT.reach, towardExit(world), (): boolean => world.scene !== null);
  assert.ok(world.scene !== null && distance(world.player.pos, meeting()) <= meeting().radius);
  untilPhase(world, 'fight', towardExit(world));
  run(world, LIMIT.reach, towardExit(world), (): boolean => world.moments.some((moment: MomentState): boolean => moment.phase === 'awake'));
  const moment: MomentState = must(world.moments.find((entry: MomentState): boolean => entry.id === world.scene?.momentId), 'the brought moment');
  assert.equal(moment.def.id, meeting().moment);
  assert.equal(moment.phase, 'awake');
  assert.ok(distance(world.player.pos, moment.pos) <= moment.def.radius);
  assert.ok(echoMonsters(world, moment).some((monster: MonsterState): boolean => monster.alive));
  assert.ok(distance(moment.pos, exitOf(world, meeting().lead.exit)) > moment.def.radius + exitOf(world, meeting().lead.exit).radius);
  run(world, LIMIT.reach, towardExit(world), (): boolean => phaseOf(world) === 'strike');
  assert.equal(phaseOf(world), 'strike', 'a hero who walks on is met at once');
  assert.equal(moment.phase, 'awake', 'the moment is not left behind while he comes');
});

void test('the Warden appears outside the bubble and cuts down every one of its echoes with his own strike', (): void => {
  const world: World = hall();
  untilPhase(world, 'fight', towardExit(world));
  const events: WorldEvent[] = untilPhase(world, 'strike', towardExit(world));
  const moment: MomentState = must(world.moments.find((entry: MomentState): boolean => entry.id === world.scene?.momentId), 'the moment');
  const echoes: MonsterState[] = echoMonsters(world, moment).filter((monster: MonsterState): boolean => monster.alive);
  assert.ok(echoes.length > 0);
  const npc: NpcState = warden(world);
  assert.equal(npc.def.id, meeting().npc);
  assert.ok(distance(npc.pos, moment.pos) > moment.def.radius, 'he stands outside the moment');
  assert.ok(ofType(events, 'skill_start').every((event): boolean => event.actorId !== npc.id));
  const struck: WorldEvent[] = untilPhase(world, 'speak');
  const start: EventOf<'skill_start'> = must(ofType(struck, 'skill_start').find((event): boolean => event.actorId === npc.id), 'his swing');
  assert.equal(start.skill.id, meeting().strike);
  const hits: EventOf<'damage'>[] = ofType(struck, 'damage').filter((event): boolean => event.sourceId === npc.id);
  assert.deepEqual(hits.map((event): number => event.targetId).toSorted((a: number, b: number): number => a - b), echoes.map((monster: MonsterState): number => monster.id).toSorted((a: number, b: number): number => a - b));
  assert.ok(hits.every((event): boolean => event.killed && event.amount > 0 && event.skill.id === meeting().strike));
  assert.ok(ofType(struck, 'skill_impact').some((event): boolean => event.actorId === npc.id && event.team === 'player' && event.hits === echoes.length));
  assert.ok(echoes.every((monster: MonsterState): boolean => !monster.alive));
  assert.ok(ofType(struck, 'moment_ended').some((event): boolean => event.moment.id === moment.id && event.outcome === 'resolved'));
});

void test('he speaks his three lines in order, each given its reading time, and nothing can hit the hero while he does', (): void => {
  const world: World = hall();
  untilPhase(world, 'strike', towardExit(world));
  const brute: MonsterDef = must(content.monsters.get('unfinished_brute'), 'a brute');
  const foe: MonsterState = spawnMonster(world, brute, world.nextPackId, { x: world.player.pos.x + ADJACENT, z: world.player.pos.z }, { summonerId: null, scatter: 0, revived: false });
  world.nextPackId += 1;
  foe.aggro = true;
  foe.foeId = world.player.id;
  const life: number = world.player.life;
  const said: WorldEvent[] = [];
  const times: number[] = [];
  for (let elapsed: number = 0; elapsed < LIMIT.meeting && world.scene?.phase !== 'lead'; elapsed += DT) {
    const events: WorldEvent[] = stepWorld(world, [], DT);
    if (ofType(events, 'bark').length > 0) times.push(world.time);
    said.push(...events);
  }
  assert.equal(world.scene?.phase, 'lead');
  assert.equal(world.player.life, life);
  assert.equal(ofType(said, 'damage').filter((event): boolean => event.targetTeam === 'player').length, 0);
  const barks: EventOf<'bark'>[] = ofType(said, 'bark');
  assert.deepEqual(barks.map((event): string => event.line.id), meeting().lines);
  assert.ok(barks.every((event): boolean => event.speaker === meeting().npc));
  barks.slice(0, -1).forEach((event, index: number): void => {
    const gap: number = (times[index + 1] ?? 0) - (times[index] ?? 0);
    assert.ok(Math.abs(gap - lineSeconds(event.line.text)) <= DT * 2, `${event.line.id} is given its reading time`);
  });
  assert.equal(world.flags['warden_met'], 'yes');
  assert.ok(ofType(run(world, 5), 'damage').some((event): boolean => event.targetTeam === 'player'), 'once he has spoken the fight is the hero’s again');
});

void test('on the walk he keeps the hero’s pace, waits when the hero lags, and waits beside the way out without covering it', (): void => {
  const world: World = hall();
  untilPhase(world, 'lead', towardExit(world));
  const npc: NpcState = warden(world);
  const lead = meeting().lead;
  world.player.pos = { ...LAGGING };
  run(world, 2);
  assert.equal(npc.pace, 0);
  assert.equal(npc.motion, 'still');
  const waitingAt: Vec2 = { x: npc.pos.x, z: npc.pos.z };
  run(world, 2);
  assert.ok(distance(npc.pos, waitingAt) < 1e-6, 'he waits for the hero');
  assert.ok(distance(world.player.pos, LAGGING) < 1e-6, 'the hero kept control and stood where he chose');
  run(world, LIMIT.walk, (): Command[] => [{ type: 'move', held: true, dest: { x: npc.pos.x, z: npc.pos.z } }], (): boolean => npc.pace > 0);
  assert.equal(npc.pace, lead.walk, 'he walks on once the hero catches up');
  assert.ok(distance(npc.pos, world.player.pos) <= lead.ahead);
  world.player.pos = { x: lead.x, z: lead.z };
  run(world, DT * 2);
  assert.equal(npc.pace, lead.run, 'a hero who goes ahead is followed at a run');
  run(world, LIMIT.walk, (): Command[] => [], (): boolean => npc.route.length === 0);
  assert.ok(distance(npc.pos, lead) < 1e-3, 'he ends beside the way out');
  assert.equal(world.zone.id, HALL);
});

void test('the hero clicks the way out, the Warden goes through with him and walks to his place at the fire', (): void => {
  const world: World = hall();
  untilPhase(world, 'lead', towardExit(world));
  const exit: ZoneExit = exitOf(world, meeting().lead.exit);
  const events: WorldEvent[] = run(world, LIMIT.walk, (): Command[] => [{ type: 'travel', exit: exit.id }], (): boolean => world.zone.id !== HALL);
  assert.equal(world.zone.id, exit.to);
  assert.ok(ofType(events, 'zone_changed').length === 1);
  assert.equal(world.scene, null);
  const guide: NpcState = must(world.npcs.find((npc: NpcState): boolean => npc.def.id === meeting().npc), 'the Guide in the Hideout');
  assert.equal(world.npcs.filter((npc: NpcState): boolean => npc.def.id === meeting().npc).length, 1, 'one Warden, not a second at his place');
  assert.ok(distance(guide.pos, world.player.pos) < SCENE.reach, 'he arrives beside the hero');
  assert.ok(guide.route.length > 0 && guide.pace > 0);
  run(world, LIMIT.walk, (): Command[] => [], (): boolean => guide.route.length === 0);
  run(world, DT);
  assert.deepEqual({ x: guide.pos.x, z: guide.pos.z }, { x: guide.placement.x, z: guide.placement.z });
  assert.equal(guide.facing, guide.homeFacing);
  assert.equal(guide.motion, 'still');
});

void test('the meeting happens once: walking back to the far end later brings no second moment and no second Warden', (): void => {
  const world: World = hall();
  untilPhase(world, 'lead', towardExit(world));
  world.player.pos = { ...APPROACH };
  run(world, 1);
  assert.equal(world.scene?.phase, 'lead');
  enterZone(world, zoneOf(content, HALL), { type: 'start' });
  quiet(world);
  world.player.pos = { ...APPROACH };
  const before: number = world.moments.length;
  run(world, LIMIT.reach, towardExit(world), (): boolean => world.zone.id !== HALL);
  assert.equal(world.scene, null);
  assert.ok(world.moments.length <= before);
  assert.ok(!world.npcs.some((npc: NpcState): boolean => npc.def.id === meeting().npc));
});

void test('a save that already reached the Hideout before the meeting existed walks the far end in peace', (): void => {
  const first: World = withoutGlitches(createWorld(content, { seed: 4, save: null }));
  enterZone(first, zoneOf(content, 'hideout'), { type: 'start' });
  enterZone(first, zoneOf(content, HALL), { type: 'start' });
  const world: World = quiet(withoutGlitches(createWorld(content, { seed: 4, save: parseSaveText(content, JSON.stringify(toSave(first))) })));
  enterZone(world, zoneOf(content, HALL), { type: 'start' });
  quiet(world);
  world.player.pos = { ...APPROACH };
  run(world, LIMIT.walk, (): Command[] => [{ type: 'travel', exit: meeting().lead.exit }], (): boolean => world.zone.id !== HALL || world.scene !== null);
  assert.equal(world.scene, null);
  assert.equal(world.flags['warden_met'], undefined);
  assert.equal(world.zone.id, 'hideout');
});

void test('a hero who dies before the Warden arrives meets him on the next approach instead', (): void => {
  const world: World = hall();
  untilPhase(world, 'fight', towardExit(world));
  world.player.life = 0;
  world.player.alive = false;
  stepWorld(world, [], DT);
  assert.equal(world.scene, null);
  assert.ok(!world.npcs.some((npc: NpcState): boolean => npc.def.id === meeting().npc));
});

void test('a hero already fighting in a moment at the far end has that fight cut short, and no second moment is brought', (): void => {
  const world: World = hall();
  world.flags['warden_met'] = 'yes';
  const at: Vec2 = { x: meeting().x, z: meeting().z };
  world.player.pos = { ...at };
  const own: MomentState = must(forceStrike(world, at, 'charge'), 'a moment of the hero’s own');
  run(world, LIMIT.reach, (): Command[] => [], (): boolean => own.phase === 'dormant');
  wakeMoment(world, own, true);
  run(world, 1);
  assert.equal(world.scene, null);
  world.flags = Object.fromEntries(Object.entries(world.flags).filter(([name]: [string, string]): boolean => name !== 'warden_met'));
  run(world, 1);
  assert.equal(momentIdOf(world), own.id);
  assert.deepEqual(world.moments.map((moment: MomentState): number => moment.id), [own.id]);
});

void test('a hero who reaches the way out before any fight is met at the door, the way out waits while he speaks, and they go through together', (): void => {
  const world: World = hall();
  const exit: ZoneExit = exitOf(world, meeting().lead.exit);
  world.player.pos = { x: exit.x - exit.radius - DOORSTEP, z: exit.z };
  const travel = (): Command[] => [{ type: 'travel', exit: exit.id }];
  run(world, LIMIT.reach, travel, (): boolean => world.scene?.phase === 'speak');
  assert.equal(world.scene?.phase, 'speak');
  assert.ok(distance(warden(world).pos, world.player.pos) <= SCENE.beside + SCENE.reach);
  const said: WorldEvent[] = run(world, LIMIT.meeting, travel, (): boolean => world.zone.id !== HALL);
  assert.deepEqual(ofType(said, 'bark').map((event): string => event.line.id), meeting().lines);
  assert.equal(world.zone.id, exit.to);
  assert.equal(world.flags['warden_met'], 'yes');
  assert.ok(must(world.npcs.find((npc: NpcState): boolean => npc.def.id === meeting().npc), 'the Guide').route.length > 0, 'he came through with the hero');
});
