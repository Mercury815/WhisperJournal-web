const MAX_LEN = 4000;
const SUMMARY_LEN = 160;

export function clampContent(raw: string): string {
  const s = raw ?? '';
  if (s.length <= MAX_LEN) {
    return s;
  }
  return s.slice(0, MAX_LEN);
}

export function makeSummary(content: string): string {
  const oneLine = content.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= SUMMARY_LEN) {
    return oneLine;
  }
  return `${oneLine.slice(0, SUMMARY_LEN)}…`;
}

export function parseMonth(month: string): { start: string; end: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(month.trim());
  if (!m) {
    return null;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) {
    return null;
  }
  const start = `${m[1]}-${m[2]}-01`;
  const last = new Date(y, mo, 0).getDate();
  const end = `${m[1]}-${m[2]}-${String(last).padStart(2, '0')}`;
  return { start, end };
}
