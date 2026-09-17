import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guestFromTitle, isRerecord, norm, slugify, stripVersion } from '../src/ingest/names.js';

test('slugify matches the archive convention', () => {
  assert.equal(slugify('Elizabeth Stone 2.0'), 'elizabeth-stone-20');
  assert.equal(slugify('Aishwarya Naresh Reganti + Kiriti Badam'), 'aishwarya-naresh-reganti-kiriti-badam');
  assert.equal(slugify('Hamel Husain & Shreya Shankar'), 'hamel-husain-shreya-shankar');
  assert.equal(slugify('Dr. Becky Kennedy'), 'dr-becky-kennedy');
  assert.equal(slugify('Casey Winters_'), 'casey-winters_');
});

test('version markers are detected and stripped', () => {
  assert.equal(stripVersion('Elena Verna 3.0'), 'Elena Verna');
  assert.equal(stripVersion('Ethan Evans_V2'), 'Ethan Evans');
  assert.equal(isRerecord('Jen Abel 2.0'), true);
  assert.equal(isRerecord('Jen Abel'), false);
  assert.equal(norm('Elena Verna 3.0'), 'elenaverna30');
});

test('guestFromTitle handles pipe and colon titles', () => {
  assert.equal(guestFromTitle('How we built Grok Bot | Roman Ugarte (SpaceXAI)'), 'Roman Ugarte');
  assert.equal(guestFromTitle('84 minutes of enterprise sales alpha | Jen Abel'), 'Jen Abel');
  assert.equal(guestFromTitle('Chatbots are not the final interface: OpenAI’s Head of Design | Ian Silber'), 'Ian Silber');
  assert.equal(guestFromTitle('Brian Chesky: a new playbook'), 'Brian Chesky');
  assert.equal(guestFromTitle('Why founders fail: the real story'), null);
  assert.equal(guestFromTitle('No separator here'), null);
  assert.equal(guestFromTitle('Talent density | Adam Ward, CPO at Cursor'), 'Adam Ward, at Cursor');
});
