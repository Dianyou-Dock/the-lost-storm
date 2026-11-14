import type { Condition, Content, ZoneExit } from './types.ts';

function heldBack(content: Content, requires: readonly Condition[]): boolean {
  return requires.some((condition: Condition): boolean => condition.type === 'flag' && !condition.not && content.world.withheld.includes(condition.flag));
}

export function withheldZones(content: Content): ReadonlySet<string> {
  const exits: ZoneExit[] = [...content.zones.values()].flatMap((zone): readonly ZoneExit[] => zone.exits);
  const behind: Set<string> = new Set<string>(exits.filter((exit: ZoneExit): boolean => heldBack(content, exit.requires)).map((exit: ZoneExit): string => exit.to));
  const open: Set<string> = new Set<string>([...content.zones.keys()].filter((id: string): boolean => !behind.has(id)));
  const queue: string[] = [...open];
  while (queue.length > 0) {
    const from: string | undefined = queue.pop();
    if (from === undefined) break;
    for (const exit of content.zones.get(from)?.exits ?? []) {
      if (open.has(exit.to) || heldBack(content, exit.requires)) continue;
      open.add(exit.to);
      queue.push(exit.to);
    }
  }
  return new Set<string>([...behind].filter((id: string): boolean => !open.has(id)));
}

export function exitWithheld(content: Content, exit: ZoneExit): boolean {
  return heldBack(content, exit.requires);
}
