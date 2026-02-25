import { useMemo } from "react";
import { Check, X } from "lucide-react";
import { validatePassword } from "@/lib/passwordPolicy";

interface PasswordChecklistProps {
  password: string;
  confirmPassword?: string;
  showMatch?: boolean;
}

/**
 * Reusable password-rules checklist.
 * Renders live validation feedback for password strength + optional match indicator.
 */
export function PasswordChecklist({ password, confirmPassword, showMatch = false }: PasswordChecklistProps) {
  const { results } = useMemo(() => validatePassword(password), [password]);
  const passwordsMatch = confirmPassword !== undefined && password === confirmPassword && confirmPassword.length > 0;

  return (
    <div className="space-y-1.5">
      {results.map((rule) => (
        <div
          key={rule.id}
          className={`flex items-center gap-2 text-xs ${
            rule.valid ? "text-green-600" : "text-muted-foreground"
          }`}
        >
          {rule.valid ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
          <span>{rule.label}</span>
        </div>
      ))}
      {showMatch && confirmPassword !== undefined && confirmPassword.length > 0 && (
        <div
          className={`flex items-center gap-2 text-xs ${
            passwordsMatch ? "text-green-600" : "text-destructive"
          }`}
        >
          {passwordsMatch ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
          <span>{passwordsMatch ? "Passwords match" : "Passwords do not match"}</span>
        </div>
      )}
    </div>
  );
}
