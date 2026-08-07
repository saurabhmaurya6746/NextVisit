/**
 * Centralized Validation Library for NextVisit
 * Enforces consistent input restrictions, validation rules, and error messaging across all forms.
 */

export interface ValidationRule {
  required?: boolean;
  requiredMessage?: string;
  isPhone?: boolean;
  isEmail?: boolean;
  isNumber?: boolean;
  isPrice?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  startDate?: string | Date;
  endDate?: string | Date;
  custom?: (val: any) => string | null | undefined;
}

export function validateValue(value: any, rules: ValidationRule): string | null {
  if (rules.required) {
    if (value === null || value === undefined) return rules.requiredMessage || "This field is required";
    if (typeof value === "string" && value.trim() === "") return rules.requiredMessage || "This field is required";
    if (typeof value === "boolean" && !value) return rules.requiredMessage || "This field is required";
  }

  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (rules.isPhone) {
      const cleanDigits = trimmed.replace(/\D/g, "");
      if (cleanDigits.length !== 10) {
        return "Phone number must be exactly 10 digits";
      }
    }

    if (rules.isEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmed)) {
        return "Please enter a valid email address";
      }
    }

    if (rules.isPrice) {
      const num = Number(trimmed);
      if (isNaN(num) || num < 0) {
        return "Please enter a valid non-negative price/amount";
      }
    }

    if (rules.isNumber) {
      const num = Number(trimmed);
      if (isNaN(num)) {
        return "Please enter a valid number";
      }
      if (rules.min !== undefined && num < rules.min) {
        return `Value must be at least ${rules.min}`;
      }
      if (rules.max !== undefined && num > rules.max) {
        return `Value must not exceed ${rules.max}`;
      }
    }

    if (rules.minLength && trimmed.length < rules.minLength) {
      return `Must be at least ${rules.minLength} characters`;
    }

    if (rules.maxLength && trimmed.length > rules.maxLength) {
      return `Must be at most ${rules.maxLength} characters`;
    }
  }

  if (rules.startDate && rules.endDate) {
    const start = new Date(rules.startDate).getTime();
    const end = new Date(rules.endDate).getTime();
    if (!isNaN(start) && !isNaN(end) && end < start) {
      return "End date cannot be before start date";
    }
  }

  if (rules.custom) {
    return rules.custom(value) || null;
  }

  return null;
}

/**
 * Filters input to ensure only 10 digits are kept (no letters, spaces, symbols).
 */
export function sanitizePhoneInput(phone: string): string {
  return phone.replace(/\D/g, "").slice(0, 10);
}

/**
 * Filters input to ensure only numbers are kept.
 */
export function sanitizeNumberInput(value: string, allowDecimal = false): string {
  if (allowDecimal) {
    let clean = value.replace(/[^0-9.]/g, "");
    const parts = clean.split(".");
    if (parts.length > 2) {
      clean = `${parts[0]}.${parts.slice(1).join("")}`;
    }
    return clean;
  }
  return value.replace(/\D/g, "");
}

/**
 * Trims leading/trailing whitespace from string inputs.
 */
export function sanitizeTextInput(text: string): string {
  return text.trim();
}
