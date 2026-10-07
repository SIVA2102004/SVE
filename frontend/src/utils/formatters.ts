/**
 * Formats integer paise or rupees into standard Indian numbering format (e.g. ₹1,25,000)
 * By default in ShopFlow/SVE database and API, financial values are stored in paise.
 */
export function formatINR(amountInPaiseOrRupees: number, isPaise = true): string {
  const rupees = isPaise ? (amountInPaiseOrRupees || 0) / 100 : (amountInPaiseOrRupees || 0);
  const isNegative = rupees < 0;
  const absVal = Math.abs(rupees);

  const parts = absVal.toFixed(2).split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];

  let lastThree = integerPart.substring(integerPart.length - 3);
  const otherNumbers = integerPart.substring(0, integerPart.length - 3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedInt = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
  const formattedAmount = `${isNegative ? '-' : ''}${formattedInt}${decimalPart !== '00' ? '.' + decimalPart : ''}`;

  return `₹${formattedAmount}`;
}

/**
 * Formats Date to Indian business format (DD-MM-YYYY)
 */
export function formatDate(dateStringOrObj: string | Date | undefined | null): string {
  if (!dateStringOrObj) return '-';
  const d = new Date(dateStringOrObj);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Formats time (e.g. 02:45 PM)
 */
export function formatTime(dateStringOrObj: string | Date | undefined | null): string {
  if (!dateStringOrObj) return '';
  const d = new Date(dateStringOrObj);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
