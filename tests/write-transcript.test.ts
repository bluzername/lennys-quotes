import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFrontmatter, compactBody, formatDuration, renderTranscript, shortDescription } from '../src/ingest/write-transcript.js';
import { parseTranscript } from '../src/ingest/parse-transcript.js';
import { parseRss } from '../src/ingest/youtube.js';

test('formatDuration and shortDescription', () => {
  assert.equal(formatDuration(4963), '1:22:43');
  assert.equal(formatDuration(310), '5:10');
  assert.equal(shortDescription('First line\nSecond'), 'First line');
  assert.equal(shortDescription(undefined), undefined);
  assert.ok(shortDescription('word '.repeat(100))!.endsWith('...'));
});

test('rendered transcript round-trips through the parser', () => {
  const fm = buildFrontmatter('Roman Ugarte', {
    id: 'maSdsTLaMuU',
    title: 'How we built Grok Bot | Roman Ugarte (SpaceXAI)',
    durationSeconds: 4963,
    publishDate: '2026-09-08',
    description: 'Roman: a story\nmore',
    viewCount: 234510
  });
  const body = 'Roman Ugarte (00:00:00):\nHello.\n\n\nLenny Rachitsky (00:00:10):\nHi.   \n';
  const rendered = renderTranscript(fm, body);
  assert.ok(rendered.startsWith('---\n'));
  const episode = parseTranscript('roman-ugarte', rendered);
  assert.equal(episode.guest, 'Roman Ugarte');
  assert.equal(episode.videoId, 'maSdsTLaMuU');
  assert.equal(episode.publishDate, '2026-09-08');
  assert.equal(episode.duration, '1:22:43');
  assert.equal(episode.viewCount, 234510);
  assert.equal(episode.description, 'Roman: a story');
  assert.equal(episode.segments.length, 2);
  assert.equal(compactBody(body).split('\n').length, 4);
  assert.equal(buildFrontmatter('Failure', null).video_id, undefined);
});

test('parseRss extracts id, title, date, description and views', () => {
  const xml = `<feed><entry><yt:videoId>abc</yt:videoId><title>Hook &amp; more | Guest Name (Co)</title>
    <published>2026-09-14T00:16:23+00:00</published><media:group><media:description>Desc</media:description>
    <media:community><media:statistics views="3152"/></media:community></media:group></entry></feed>`;
  assert.deepEqual(parseRss(xml), [
    { id: 'abc', title: 'Hook & more | Guest Name (Co)', publishDate: '2026-09-14', description: 'Desc', viewCount: 3152 }
  ]);
});
