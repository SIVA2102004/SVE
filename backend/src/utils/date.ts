/**
 * Normalizes a date to Midnight UTC of the specified calendar day in Asia/Kolkata (IST).
 * Ensures exact matching in database regardless of whether the server runs in UTC, US, or IST timezone.
 */
export function getTodayIST(): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()); // Formats as 'YYYY-MM-DD'
  return new Date(`${parts}T00:00:00.000Z`);
}

/**
 * Parses any date input (YYYY-MM-DD string, Date object, ISO string)
 * into a consistent midnight UTC Date object aligned with Indian Standard Time.
 */
export function parseDateIST(inputDate?: string | Date | null): Date {
  if (!inputDate) return getTodayIST();
  if (typeof inputDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(inputDate)) {
    return new Date(`${inputDate}T00:00:00.000Z`);
  }
  const d = typeof inputDate === 'string' ? new Date(inputDate) : inputDate;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  return new Date(`${parts}T00:00:00.000Z`);
}

/**
 * Returns current hours and minutes in Indian Standard Time (Asia/Kolkata).
 */
export function getCurrentTimeIST(): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date());

  const hourStr = parts.find((p) => p.type === 'hour')?.value || '0';
  const minuteStr = parts.find((p) => p.type === 'minute')?.value || '0';
  return {
    hour: parseInt(hourStr, 10),
    minute: parseInt(minuteStr, 10),
  };
}

/**
 * Checks if current Indian Standard Time is past 9:30 AM.
 */
export function isPast930AmIST(): boolean {
  const { hour, minute } = getCurrentTimeIST();
  return hour > 9 || (hour === 9 && minute >= 30);
}

