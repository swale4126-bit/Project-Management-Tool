/**
 * Exact monetary helpers using integer minor units (cents) to avoid
 * IEEE-754 floating-point precision errors in financial calculations.
 */

export function toCents(amount) {
  if (amount === null || amount === undefined || amount === '') {
    return 0;
  }
  const str = String(amount).trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(str)) {
    throw new Error(`Invalid monetary value: ${amount}`);
  }
  const negative = str.startsWith('-');
  const unsigned = negative ? str.slice(1) : str;
  const [wholePart, fracPart = ''] = unsigned.split('.');
  const cents = Number(wholePart) * 100 + Number(fracPart.padEnd(2, '0'));
  return negative ? -cents : cents;
}

export function fromCents(cents) {
  const safe = Math.round(Number(cents) || 0);
  const sign = safe < 0 ? '-' : '';
  const abs = Math.abs(safe);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${whole}.${frac}`;
}

export function addMoney(...values) {
  const totalCents = values.reduce((acc, v) => acc + toCents(v), 0);
  return fromCents(totalCents);
}

export function subtractMoney(a, b) {
  return fromCents(toCents(a) - toCents(b));
}

export function calculateUtilizationPct(actualAmount, plannedAmount) {
  const planned = toCents(plannedAmount);
  if (planned <= 0) return 0;
  const actual = toCents(actualAmount);
  return Number(((actual / planned) * 100).toFixed(2));
}
