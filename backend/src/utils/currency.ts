/**
 * Formats integer paise to Indian Rupee string (e.g. ₹1,25,000)
 */
export function formatINR(paise: number, includeSymbol = true): string {
  const rupees = paise / 100;
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

  return includeSymbol ? `₹${formattedAmount}` : formattedAmount;
}

/**
 * Converts Rupees float/string to safe integer paise
 */
export function rupeesToPaise(rupees: number | string): number {
  const val = typeof rupees === 'string' ? parseFloat(rupees) : rupees;
  if (isNaN(val)) return 0;
  return Math.round(val * 100);
}

/**
 * Converts paise to rupees float
 */
export function paiseToRupees(paise: number): number {
  return (paise || 0) / 100;
}

/**
 * Calculates monthly EMI using the standard compound interest formula:
 * EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
 */
export function calculateEMI(principalPaise: number, annualRate: number, tenureMonths: number): {
  emiPaise: number;
  totalInterestPaise: number;
  totalAmountPaise: number;
} {
  if (principalPaise <= 0 || tenureMonths <= 0) {
    return { emiPaise: 0, totalInterestPaise: 0, totalAmountPaise: 0 };
  }

  if (annualRate <= 0) {
    const emi = Math.round(principalPaise / tenureMonths);
    return {
      emiPaise: emi,
      totalInterestPaise: 0,
      totalAmountPaise: principalPaise,
    };
  }

  const monthlyRate = annualRate / (12 * 100);
  const numerator = principalPaise * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths);
  const denominator = Math.pow(1 + monthlyRate, tenureMonths) - 1;
  const emiPaise = Math.round(numerator / denominator);
  const totalAmountPaise = emiPaise * tenureMonths;
  const totalInterestPaise = Math.max(0, totalAmountPaise - principalPaise);

  return { emiPaise, totalInterestPaise, totalAmountPaise };
}
