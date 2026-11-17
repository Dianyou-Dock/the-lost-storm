import { isMoyu, moyuComboRoot, moyuNode } from '../content/moyu.ts';
import type { SkillDef } from '../content/types.ts';
import type { MonsterState, PlayerState, World } from './types.ts';

type ComboState = NonNullable<PlayerState['moyuComboState']>;
const LOOK = { 金: 'metal', 木: 'wood', 水: 'water', 火: 'fire', 土: 'earth' } as const;
function elementOf(value: string): value is keyof typeof LOOK { return value === '金' || value === '木' || value === '水' || value === '火' || value === '土'; }

function state(player: PlayerState): ComboState {
  return player.moyuComboState ??= { hits: {}, ready: {}, sharp: false };
}

function combo(skill: SkillDef): { root: string; scale: number; element: keyof typeof LOOK; name: string } | null {
  if (skill.moyuCombo === undefined) return null;
  const node = moyuNode(skill.moyuCombo);
  if (node === null || node.element === undefined || !elementOf(node.element)) return null;
  return { root: moyuComboRoot(node), scale: node.type === 'variant' ? 1.2 : 1, element: node.element, name: node.name };
}

export function moyuComboDamage(world: World, skill: SkillDef, guarded: boolean, pierce: number = 0): number {
  if (!isMoyu(world.content)) return 1;
  const bound = combo(skill);
  if (bound === null) return 1;
  if (bound.root === 'word-破甲' && guarded) return 1 + 0.2 * bound.scale;
  if (bound.root === 'word-震击' && guarded) return 1 + 0.28 * bound.scale;
  if (bound.root === 'word-锋锐') {
    const held = state(world.player);
    const boost = (held.sharp ? 0.2 : 0) + (skill.name === '连斩' && pierce > 0 ? 0.25 : 0);
    held.sharp = false;
    return 1 + boost * bound.scale;
  }
  return 1;
}

export function moyuComboHit(world: World, target: MonsterState, skill: SkillDef, countered: boolean = false): void {
  if (!isMoyu(world.content)) return;
  const bound = combo(skill);
  if (bound === null) return;
  const player = world.player;
  const held = state(player);
  const ready = (key: string, seconds: number): boolean => {
    if (world.time < (held.ready[key] ?? 0)) return false;
    held.ready[key] = world.time + seconds;
    return true;
  };
  let fired = false;
  switch (bound.root) {
    case 'word-流血': case 'word-毒蚀': case 'word-灼烧':
      fired = true;
      break;
    case 'word-破甲': case 'word-震击':
      fired = target.def.guard !== null;
      break;
    case 'word-锋锐':
      held.sharp = true;
      fired = true;
      break;
    case 'word-缠绕':
      if (ready(`root:${target.id}`, 3)) { target.root = Math.max(target.root, 0.7 * bound.scale); fired = true; }
      break;
    case 'word-再生':
      if (player.life < player.maxLife && ready('renew', 2)) { player.life = Math.min(player.maxLife, player.life + Math.max(1, player.maxLife * 0.025 * bound.scale)); fired = true; }
      break;
    case 'word-寒伤':
      target.tempo = Math.min(target.tempo, 0.85);
      target.tempoTime = Math.max(target.tempoTime, 1.5 * bound.scale);
      fired = true;
      break;
    case 'word-冰封': {
      const key = `freeze:${target.id}`;
      held.hits[key] = (held.hits[key] ?? 0) + 1;
      if (held.hits[key] >= 3 && ready(key, 4)) {
        held.hits[key] = 0;
        target.tempo = 0;
        target.tempoTime = Math.max(target.tempoTime, target.def.boss === null ? 0.55 * bound.scale : 0.18);
        fired = true;
      }
      break;
    }
    case 'word-净化':
      if (countered && skill.name === '格挡反击') {
        player.life = Math.min(player.maxLife, player.life + Math.max(1, player.maxLife * 0.03 * bound.scale));
        player.cooldowns[skill.id] = Math.max(0, (player.cooldowns[skill.id] ?? 0) - 0.8 * bound.scale);
        fired = true;
      }
      if ((player.burn !== null || player.root > 0 || player.tempo < 1) && ready('cleanse', 5)) {
        player.burn = null;
        player.root = 0;
        player.tempo = 1;
        player.tempoTime = 0;
        fired = true;
      }
      break;
    case 'word-躁动':
      target.tempo = Math.min(target.tempo, 0.72);
      target.tempoTime = Math.max(target.tempoTime, 1.2 * bound.scale);
      fired = true;
      break;
    case 'word-急速':
      if (ready('haste', 3)) { player.tempo = Math.max(player.tempo, 1.18 * bound.scale); player.tempoTime = Math.max(player.tempoTime, 1.5); fired = true; }
      break;
    case 'word-失衡':
      if (target.action?.phase === 'windup' && ready(`break:${target.id}`, 4)) {
        target.action = null;
        target.stagger = Math.max(target.stagger, 0.35 * bound.scale);
        world.events.push({ type: 'skill_interrupt', actorId: target.id });
        fired = true;
      }
      break;
    case 'word-固守':
      if (ready('guard', 2)) {
        const earth = player.moyuElements ??= { goldTarget: null, goldHits: 0, goldUntil: 0, woodHits: 0, woodReady: 0, waterLast: null, fireHeat: 0, fireUntil: 0, earthCharges: 0, earthTime: 0 };
        earth.earthCharges = Math.min(2, earth.earthCharges + 1);
        earth.earthTime = 4 * bound.scale;
        fired = true;
      }
      break;
  }
  if (fired) world.events.push({ type: 'moyu_element', element: LOOK[bound.element], text: bound.name, pos: { x: target.pos.x, z: target.pos.z } });
}
