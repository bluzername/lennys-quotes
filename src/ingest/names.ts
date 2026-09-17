/**
 * Name matching between Lenny's Dropbox transcript filenames ("Elena Verna 3.0.txt")
 * and YouTube titles ("How to ... | Elena Verna (Lovable)").
 * Logic adapted from the community sync script by sdmurff (lennys-podcast-transcripts fork).
 */
const VERSION_RE = /[\s_.-]+v?[2-9]\.0(?=$|[\s_.-])|[\s_.-]+v[2-9](?=$|[\s_.-])/i;
const ROLE_WORDS = /\b(CPO|CTO|CEO|CPTO|COO|VP|Co-?founder)\b/gi;

/** Guest name to episode folder slug: "Elizabeth Stone 2.0" -> "elizabeth-stone-20". */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/\+/g, ' ')
    .replace(/[.,]/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Lossy key for fuzzy matching: lowercase alphanumerics only. */
export function norm(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function stripVersion(name: string): string {
  return name.replace(VERSION_RE, '').replace(/^[\s_-]+|[\s_-]+$/g, '');
}

export function isRerecord(name: string): boolean {
  return VERSION_RE.test(name);
}

/**
 * Extract the guest from a YouTube title. Lenny's titles are usually
 * "<hook> | <Guest> (<role>)" and occasionally "<Guest>: <hook>".
 */
export function guestFromTitle(title: string): string | null {
  let guest: string;
  if (title.includes('|')) {
    guest = title.slice(title.lastIndexOf('|') + 1);
  } else if (title.includes(':')) {
    const before = title.split(':', 1)[0]!.trim();
    const words = before.split(/\s+/);
    const looksLikeName = words.length >= 1 && words.length <= 4 && words.every((w) => !/^[a-z]/.test(w));
    if (!looksLikeName) return null;
    guest = before;
  } else {
    return null;
  }
  guest = guest.replace(/\([^)]*\)/g, '').replace(ROLE_WORDS, '').replace(/\s{2,}/g, ' ');
  const cleaned = guest.replace(/^[\s,\-·]+|[\s,\-·]+$/g, '');
  return cleaned || null;
}
