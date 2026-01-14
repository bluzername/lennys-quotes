#!/usr/bin/env node

/**
 * Check if the upstream transcript repository has new content.
 * Compares the latest commit SHA with a cached version.
 * 
 * Outputs GitHub Actions variables:
 * - has_updates: 'true' or 'false'
 * - new_sha: latest commit SHA
 * - episode_count: number of episodes found
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPSTREAM_REPO = 'ChatPRD/lennys-podcast-transcripts';
const CACHE_FILE = path.join(__dirname, '..', '.last-transcript-sha');

async function getLatestCommitSha() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${UPSTREAM_REPO}/commits/main`,
      headers: {
        'User-Agent': 'lennys-podcast-wisdom',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.sha);
        } catch (e) {
          reject(new Error(`Failed to parse GitHub response: ${e.message}`));
        }
      });
    }).on('error', reject);
  });
}

async function countEpisodes() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${UPSTREAM_REPO}/contents/transcripts`,
      headers: {
        'User-Agent': 'lennys-podcast-wisdom',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const count = Array.isArray(json) ? json.length : 0;
          resolve(count);
        } catch (e) {
          resolve(0);
        }
      });
    }).on('error', () => resolve(0));
  });
}

function getCachedSha() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return fs.readFileSync(CACHE_FILE, 'utf8').trim();
    }
  } catch (e) {
    // Ignore errors
  }
  return null;
}

function saveSha(sha) {
  fs.writeFileSync(CACHE_FILE, sha);
}

function setOutput(name, value) {
  const output = process.env.GITHUB_OUTPUT;
  if (output) {
    fs.appendFileSync(output, `${name}=${value}\n`);
  }
  console.log(`${name}=${value}`);
}

async function main() {
  console.log('Checking for transcript updates...\n');

  const [latestSha, episodeCount] = await Promise.all([
    getLatestCommitSha(),
    countEpisodes()
  ]);

  const cachedSha = getCachedSha();

  console.log(`Upstream SHA: ${latestSha}`);
  console.log(`Cached SHA:   ${cachedSha || '(none)'}`);
  console.log(`Episodes:     ${episodeCount}`);

  const hasUpdates = latestSha !== cachedSha;

  if (hasUpdates) {
    console.log('\n✅ New transcripts available!');
    saveSha(latestSha);
  } else {
    console.log('\n⏸️  No updates found.');
  }

  setOutput('has_updates', hasUpdates.toString());
  setOutput('new_sha', latestSha);
  setOutput('episode_count', episodeCount.toString());
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
