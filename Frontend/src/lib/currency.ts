export function fmt(n: number): string {
  const rounded = Math.round((Number(n) || 0) * 100) / 100;
  try {
    return `₹${rounded.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  } catch {
    return `₹${rounded}`;
  }
}

export function formatCurrency(n: number, currency = "INR"): string {
  const rounded = Math.round((Number(n) || 0) * 100) / 100;
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : "₹";
  const locale = currency === "INR" ? "en-IN" : "en-US";
  try {
    return `${symbol}${rounded.toLocaleString(locale, { maximumFractionDigits: 2 })}`;
  } catch {
    return `${symbol}${rounded}`;
  }
}

export const CURRENCY_SYMBOL = "₹";