import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBody, parseTimestamp, isHost } from '../src/ingest/parse-body.js';

test('parseTimestamp handles h:m:s and m:s', () => {
  assert.equal(parseTimestamp('00:01:27'), 87);
  assert.equal(parseTimestamp('1:02:03'), 3723);
  assert.equal(parseTimestamp('05:10'), 310);
  assert.equal(parseTimestamp('bad'), 0);
});

test('parseBody splits speaker turns and keeps timestamp-only continuations', () => {
  const body = [
    '# Title',
    '## Transcript',
    'Lenny (00:00:00):',
    'Hello there.',
    'Guest Name (00:00:05):',
    'First line.',
    'Second line.',
    '(00:00:20):',
    'Same speaker, new timestamp.'
  ].join('\n');
  const segments = parseBody(body);
  assert.equal(segments.length, 3);
  assert.deepEqual(segments.map((s) => s.speaker), ['Lenny', 'Guest Name', 'Guest Name']);
  assert.equal(segments[1]!.text, 'First line. Second line.');
  assert.equal(segments[2]!.timestamp, '00:00:20');
  assert.equal(segments[2]!.seconds, 20);
  assert.deepEqual(segments.map((s) => s.idx), [0, 1, 2]);
});

test('isHost recognises Lenny in any form', () => {
  assert.equal(isHost('Lenny'), true);
  assert.equal(isHost('Lenny Rachitsky'), true);
  assert.equal(isHost('Brian Chesky'), false);
});
