import { Check, X } from "lucide-react";

/**
 * Unified password policy — single source of truth.
 * Used by: Auth.tsx (register), ClientInvitationSetup.tsx, PasswordReset.tsx
 */

export interface PasswordRule {
  id: string;
  label: string;
  test: (p: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { id: "uppercase", label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { id: "lowercase", label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { id: "number", label: "One number", test: (p) => /[0-9]/.test(p) },
  { id: "symbol", label: 'One symbol (!@#$%^&*)', test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

export interface ValidationResult extends PasswordRule {
  valid: boolean;
}

/** Evaluate all rules against a password string */
export function validatePassword(password: string): {
  results: ValidationResult[];
  allPass: boolean;
} {
  const results = PASSWORD_RULES.map((rule) => ({
    ...rule,
    valid: rule.test(password),
  }));
  return { results, allPass: results.every((r) => r.valid) };
}
