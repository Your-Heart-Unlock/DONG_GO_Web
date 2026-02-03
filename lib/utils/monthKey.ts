/**
 * Returns current month in YYYY-MM format using Asia/Seoul timezone.
 */
export function getCurrentMonthKey(): string {
  const now = new Date();
  const seoulStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  return seoulStr.slice(0, 7);
}

/**
 * Returns month key from a Date in YYYY-MM format using Asia/Seoul timezone.
 */
export function getMonthKeyFromDate(date: Date): string {
  const seoulStr = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  return seoulStr.slice(0, 7);
}

/**
 * Returns previous month key in YYYY-MM format.
 */
export function getPreviousMonthKey(monthKey?: string): string {
  const [y, m] = (monthKey ?? getCurrentMonthKey()).split('-').map(Number);
  const prev = new Date(y, m - 2, 1);
  const py = prev.getFullYear();
  const pm = String(prev.getMonth() + 1).padStart(2, '0');
  return `${py}-${pm}`;
}

/**
 * Returns next month key in YYYY-MM format.
 */
export function getNextMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const next = new Date(y, m, 1);
  const ny = next.getFullYear();
  const nm = String(next.getMonth() + 1).padStart(2, '0');
  return `${ny}-${nm}`;
}

/**
 * Formats a month key like "2026-02" to a display string like "2026년 2월".
 */
export function formatMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return `${y}년 ${m}월`;
}
