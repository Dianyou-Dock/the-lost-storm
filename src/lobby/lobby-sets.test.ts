import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadContent } from '../../sim/content/content.ts';
import type { Content } from '../../sim/content/types.ts';
import { LOBBY_ORBIT } from './lobby-orbit.ts';
import { LOBBY_SETS, pickSet, readLobbySets, setMounds } from './lobby-sets.ts';
import type { LobbySet, SetPiece } from './lobby-sets.ts';

const content: Content = loadContent();

void test('every lobby set dresses its ground and pieces from surfaces and props the game already has', (): void => {
  for (const set of LOBBY_SETS.sets.values()) {
    assert.ok(content.surfaces.has(set.ground), `${set.id} ground ${set.ground}`);
    if (set.stone !== null) assert.ok(content.surfaces.has(set.stone), `${set.id} stone ${set.stone}`);
    for (const piece of set.pieces) assert.ok(content.props.has(piece.prop), `${set.id} piece ${piece.prop}`);
  }
});

void test('there is a set for the first lobby and three more to choose from, and the first is still the one shown', (): void => {
  assert.deepEqual([...LOBBY_SETS.sets.keys()], ['stones', 'hall', 'cave', 'gate']);
  assert.equal(LOBBY_SETS.chosen, 'stones');
  assert.deepEqual([...LOBBY_SETS.sets.values()].filter((set: LobbySet): boolean => set.shadows).map((set: LobbySet): string => set.id), ['stones']);
  assert.equal(pickSet(LOBBY_SETS, '').id, 'stones');
  assert.equal(pickSet(LOBBY_SETS, '?lobby-set=cave').id, 'cave');
  assert.equal(pickSet(LOBBY_SETS, '?lobby-set=nowhere').id, 'stones');
});

function blocksView(piece: SetPiece): boolean {
  const reach: number = Math.hypot(piece.x, piece.z);
  const near: number = LOBBY_ORBIT.near.distance;
  const far: number = LOBBY_ORBIT.far.distance;
  return reach > near - 1 && reach < far + 1.2 && piece.y < 2.4 && piece.size > 1;
}

void test('nothing tall stands in the ring the camera turns on, so the orbit never walks into a wall or hides the hero behind one', (): void => {
  for (const set of LOBBY_SETS.sets.values()) {
    if (set.id === 'stones') continue;
    for (const piece of set.pieces) assert.ok(!blocksView(piece), `${set.id} ${piece.prop} at ${piece.x}, ${piece.z}`);
  }
});

function coverage(set: LobbySet): number {
  const seen: Set<number> = new Set<number>();
  for (const piece of set.pieces) if (Math.hypot(piece.x, piece.z) > LOBBY_ORBIT.far.distance) seen.add(Math.floor(((Math.atan2(piece.x, -piece.z) * 180) / Math.PI + 360) / 30) % 12);
  for (const piece of set.skyline?.pieces ?? []) seen.add(Math.floor((((piece.angleDegrees % 360) + 360) % 360) / 30));
  return seen.size;
}

void test('each new set dresses the whole way round, so the slow turn of the lobby never shows an empty edge', (): void => {
  for (const id of ['hall', 'cave', 'gate']) {
    const set: LobbySet | undefined = LOBBY_SETS.sets.get(id);
    assert.ok(set !== undefined);
    assert.equal(coverage(set), 12, id);
  }
});

void test('a set is read strictly: a missing chosen set, reversed fog or lightning, or an unknown skyline shape is refused', (): void => {
  const good = { chosen: 'a', sets: [{ id: 'a', ground: 'black_rock', stone: null, shade: 0.5, fogNear: 10, fogFar: 20, haze: 0, pieces: [{ prop: 'rock_1', x: 1, z: 2, mound: true }], skyline: null, flash: null }] };
  const read = readLobbySets(good);
  const set: LobbySet | undefined = read.sets.get('a');
  assert.ok(set !== undefined);
  assert.deepEqual(setMounds(set), [{ x: 1, z: 2, size: 1 }]);
  assert.throws((): void => void readLobbySets({ ...good, chosen: 'b' }));
  assert.throws((): void => void readLobbySets({ ...good, zones: { hall_of_time: 'b' } }));
  assert.throws((): void => void readLobbySets({ ...good, sets: [{ ...good.sets[0], fogFar: 5 }] }));
  assert.throws((): void => void readLobbySets({ ...good, sets: [{ ...good.sets[0], flash: { everyMin: 9, everyMax: 3, strength: 1 } }] }));
  assert.throws((): void => void readLobbySets({ ...good, sets: [{ ...good.sets[0], skyline: { radius: 30, pieces: [{ kind: 'dome', angle: 0, width: 1, height: 1 }] } }] }));
});

void test('a zone can name the set the lobby shows for a character who last stood there, and a set asked for by name still wins', (): void => {
  const two = { chosen: 'a', zones: { hall_of_time: 'b' }, sets: [{ id: 'a', ground: 'black_rock', stone: null, shade: 0.5, fogNear: 10, fogFar: 20, haze: 0, pieces: [] }, { id: 'b', ground: 'black_rock', stone: null, shade: 0.5, fogNear: 10, fogFar: 20, haze: 0, pieces: [] }] };
  const read = readLobbySets(two);
  assert.equal(pickSet(read, '', 'hall_of_time').id, 'b');
  assert.equal(pickSet(read, '', 'hideout').id, 'a');
  assert.equal(pickSet(read, '', null).id, 'a');
  assert.equal(pickSet(read, '?lobby-set=a', 'hall_of_time').id, 'a');
  for (const zone of LOBBY_SETS.zones.keys()) assert.ok(content.zones.has(zone), `no zone ${zone}`);
});
