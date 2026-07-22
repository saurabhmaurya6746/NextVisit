export function fmt(n: number): string {
  const rounded = Math.round((Number(n) || 0) * 100) / 100;
  try {
    return `₹${rounded.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  } catch {
    return `₹${rounded}`;
  }
}
export const CURRENCY_SYMBOL = "₹";