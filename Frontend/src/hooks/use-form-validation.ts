import { useState, useCallback, useRef } from "react";
import { validateValue, ValidationRule, sanitizePhoneInput, sanitizeNumberInput } from "@/lib/validation";

export function useFormValidation<T extends Record<string, any>>(
  initialValues: T,
  validationRules: Partial<Record<keyof T, ValidationRule>>
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const fieldRefs = useRef<Partial<Record<keyof T, HTMLElement | null>>>({});

  const validateField = useCallback(
    (name: keyof T, val: any) => {
      const rule = validationRules[name];
      if (!rule) return null;
      const err = validateValue(val, rule);
      setErrors((prev) => ({ ...prev, [name]: err || undefined }));
      return err;
    },
    [validationRules]
  );

  const handleChange = useCallback(
    (name: keyof T, value: any) => {
      let finalVal = value;
      const rule = validationRules[name];

      if (rule?.isPhone && typeof value === "string") {
        finalVal = sanitizePhoneInput(value);
      } else if ((rule?.isNumber || rule?.isPrice) && typeof value === "string") {
        finalVal = sanitizeNumberInput(value, rule.isPrice);
      }

      setValues((prev) => ({ ...prev, [name]: finalVal }));
      if (touched[name]) {
        validateField(name, finalVal);
      }
    },
    [validationRules, touched, validateField]
  );

  const handleBlur = useCallback(
    (name: keyof T) => {
      setTouched((prev) => ({ ...prev, [name]: true }));
      validateField(name, values[name]);
    },
    [validateField, values]
  );

  const validateAll = useCallback(() => {
    const newErrors: Partial<Record<keyof T, string>> = {};
    let firstInvalidName: keyof T | null = null;

    (Object.keys(validationRules) as Array<keyof T>).forEach((name) => {
      const rule = validationRules[name];
      if (rule) {
        const err = validateValue(values[name], rule);
        if (err) {
          newErrors[name] = err;
          if (!firstInvalidName) firstInvalidName = name;
        }
      }
    });

    setErrors(newErrors);
    setTouched(
      (Object.keys(validationRules) as Array<keyof T>).reduce(
        (acc, k) => ({ ...acc, [k]: true }),
        {}
      )
    );

    if (firstInvalidName && fieldRefs.current[firstInvalidName]) {
      fieldRefs.current[firstInvalidName]?.focus();
    }

    return Object.keys(newErrors).length === 0;
  }, [validationRules, values]);

  const registerRef = useCallback(
    (name: keyof T) => (el: HTMLElement | null) => {
      fieldRefs.current[name] = el;
    },
    []
  );

  const resetForm = useCallback((newValues?: T) => {
    setValues(newValues || initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return {
    values,
    setValues,
    errors,
    touched,
    handleChange,
    handleBlur,
    validateAll,
    validateField,
    registerRef,
    resetForm,
  };
}
