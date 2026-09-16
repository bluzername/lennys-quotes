import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVideoIndex, matchVideo } from '../src/ingest/match.js';
import type { Video } from '../src/ingest/youtube.js';

const videos: Video[] = [
  { id: 'v3', title: 'Third time | Elena Verna (Lovable)' },
  { id: 'v2', title: 'Second time | Elena Verna (Dropbox)' },
  { id: 'v1', title: 'First time | Elena Verna (Amplitude)' },
  { id: 'h1', title: 'Growth loops | Brian Halligan' },
  { id: 'c1', title: 'Claire Vo on OpenClaw | Claire Vo' }
];

test('re-recorded guests get the newest unused video', () => {
  const index = buildVideoIndex(videos);
  const used = new Set(['v1', 'v2']);
  assert.equal(matchVideo('Elena Verna 3.0', index, used)?.id, 'v3');
  assert.equal(matchVideo('Elena Verna', index, new Set())?.id, 'v3');
});

test('containment matches role-prefixed or topic-suffixed names', () => {
  const index = buildVideoIndex(videos);
  assert.equal(matchVideo('CTO Brian Halligan', index, new Set())?.id, 'h1');
  assert.equal(matchVideo('Claire Vo OpenClaw', index, new Set())?.id, 'c1');
});

test('overrides and misses', () => {
  const index = buildVideoIndex(videos);
  assert.equal(matchVideo('Sam Lessin', index, new Set())?.id, 'KtKJ3A6DWTs');
  assert.equal(matchVideo('Nobody Known', index, new Set()), null);
});
