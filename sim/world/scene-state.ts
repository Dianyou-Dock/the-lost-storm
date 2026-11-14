import type { SceneDef } from '../content/scene-types.ts';
import type { ZoneNpc } from '../content/types.ts';

export type ScenePhase = 'bring' | 'fight' | 'strike' | 'speak' | 'lead';

export interface SceneState {
  readonly def: SceneDef;
  phase: ScenePhase;
  momentId: number | null;
  elapsed: number;
  missed: number;
  spoken: number;
  npcId: number | null;
  placement: ZoneNpc | null;
}

export interface Escort {
  readonly npc: string;
  readonly pace: number;
}
