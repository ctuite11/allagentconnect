/**
 * Server-side password policy for the activation completion endpoint.
 *
 * Mirrors src/lib/passwordPolicy.ts exactly. The browser's checks are a
 * convenience only — this is the authoritative gate.
 *
 * The plaintext password is never logged, never persisted, never queued and
 * never sent to a third party. The optional breach check uses the Have I Been
 * Pwned k-anonymity range API, which receives only the FIRST FIVE characters
 * of the SHA-1 hash — never the password and never the full hash.
 */

const MAX_PASSWORD_BYTES = 72; // bcrypt truncation boundary

export function validateActivationPassword(password: string): string | null {
  if (typeof password !== "string" || password.length === 0) {
    return "Please choose a password.";
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return "Password is too long. Please use 72 characters or fewer.";
  }
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include a number.";
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return "Password must include a symbol.";
  return null;
}

async function sha1Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/**
 * Leaked-password (HIBP) check.
 *
 * The Supabase Admin API does NOT apply the project's leaked-password
 * protection the way the user-facing `updateUser` path does, so the check is
 * performed here explicitly. Fails OPEN on network/service errors so a
 * third-party outage can never block a legitimate activation.
 */
export async function isPasswordBreached(password: string): Promise<boolean> {
  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return false;
    const body = await res.text();
    for (const line of body.split("\n")) {
      const [candidate, countRaw] = line.trim().split(":");
      if (candidate === suffix && Number(countRaw ?? "0") > 0) return true;
    }
    return false;
  } catch {
    // Never block activation on a breach-service failure.
    return false;
  }
}
