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
