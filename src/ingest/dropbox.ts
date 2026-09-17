import { execFile } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Lenny's public Dropbox folder of official transcripts (shared on his LinkedIn). dl=1 returns a zip. */
export const DROPBOX_ZIP_URL =
  'https://www.dropbox.com/scl/fo/yxi4s2w998p1gvtpu4193/AMdNPR8AOw0lMklwtnC0TrQ?rlkey=j06x0nipoti519e0xgm23zsn9&dl=1';

export interface DropboxTranscript {
  name: string;
  text: string;
}

export async function readTranscriptDir(dir: string): Promise<DropboxTranscript[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.txt')).sort();
  const items: DropboxTranscript[] = [];
  for (const file of files) {
    items.push({ name: file.slice(0, -4), text: await readFile(path.join(dir, file), 'utf8') });
  }
  return items;
}

/** Download and extract the Dropbox folder zip into workdir, returning all .txt transcripts. */
export async function fetchDropboxTranscripts(workdir: string, url = DROPBOX_ZIP_URL): Promise<DropboxTranscript[]> {
  await mkdir(workdir, { recursive: true });
  const zipPath = path.join(workdir, 'dropbox.zip');
  const outDir = path.join(workdir, 'dropbox');
  await mkdir(outDir, { recursive: true });

  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
  if (!response.ok) throw new Error(`Dropbox download failed: HTTP ${response.status}`);
  await writeFile(zipPath, Buffer.from(await response.arrayBuffer()));

  // -j flattens paths; the pattern skips the bare "/" entry Dropbox includes. unzip exits 1 on
  // warnings only, so treat that as success when files were extracted.
  try {
    await execFileAsync('unzip', ['-o', '-q', '-j', zipPath, '*.txt', '-d', outDir]);
  } catch (error) {
    const files = await readdir(outDir).catch(() => []);
    if (files.length === 0) throw error;
  }
  return readTranscriptDir(outDir);
}
