#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dataDir = join(__dirname, '..', 'data');
const transcriptsDir = join(dataDir, 'transcripts');

if (existsSync(join(transcriptsDir, 'episodes'))) {
  console.log('✓ Transcripts already downloaded');
  process.exit(0);
}

console.log('📥 Downloading Lenny\'s Podcast transcripts...');

try {
  // Create data directory if needed
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  // Clone the repository
  execSync(
    `git clone --depth 1 https://github.com/ChatPRD/lennys-podcast-transcripts.git "${transcriptsDir}"`,
    { stdio: 'inherit' }
  );

  console.log('✓ Transcripts downloaded successfully!');
} catch (error) {
  console.error('❌ Failed to download transcripts:', error.message);
  console.error('');
  console.error('Please run manually:');
  console.error(`  git clone https://github.com/ChatPRD/lennys-podcast-transcripts.git "${transcriptsDir}"`);
  process.exit(1);
}
