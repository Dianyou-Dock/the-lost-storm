import assert from 'node:assert/strict';
import { test } from 'node:test';
import { books, encounter } from './parse-story.ts';
import { ContentError } from './read.ts';

const ITEM_FIND = { type: 'item', item: 'worn_journal', sets: {} } as const;

void test('an item find cannot be laid under the hero after a while, because only a click or tap picks an item up', (): void => {
  assert.throws((): unknown => encounter({ id: 'journal', when: [], after: 10, ahead: 16, latest: 50, find: ITEM_FIND }, 'journal'), (error: unknown): boolean => error instanceof ContentError && error.message.includes('only picked up by a click or tap'));
  assert.equal(encounter({ id: 'journal', when: [], after: 10, ahead: 16, find: ITEM_FIND }, 'journal').latest, null);
  assert.equal(encounter({ id: 'light', when: [], after: 10, ahead: 16, latest: 60, find: { type: 'exit', exit: 'into_the_hall' } }, 'light').latest, 60);
});

void test('a page may name the line that speaks it, and a page that names none is silent', (): void => {
  const page = { id: 'first', lines: ['Look.'], address: 'For {name}.', unnamed: 'For you.', when: [] } as const;
  const read = books([{ id: 'diary', title: 'A diary', pages: [{ ...page, voice: 'diary_look' }, { ...page, id: 'second' }] }], 'books');
  assert.deepEqual(read.get('diary')?.pages.map((entry): string | null => entry.voice), ['diary_look', null]);
  assert.throws((): unknown => books([{ id: 'diary', title: 'A diary', pages: [{ ...page, voice: 7 }] }], 'books'), (error: unknown): boolean => error instanceof ContentError && error.message.includes('voice'));
});
