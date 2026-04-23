import { Link } from "react-router-dom";
import { Logo } from "@/components/brand";

/**
 * Canonical public/auth header for AAC.
 * Minimal white header with the canonical wordmark.
 * Used on /auth, /register, /pending-verification, /password-reset, /access-error.
 */
export function AACPublicHeader() {
  return (
    <header className="w-full bg-white border-b border-zinc-200">
      <div className="mx-auto max-w-7xl px-5 h-16 flex items-center justify-between">
        <Link to="/" aria-label="All Agent Connect — Home">
          <Logo variant="primary" size="md" />
        </Link>
        <Link
          to="/auth"
          className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
        >
          Sign in
        </Link>
      </div>
    </header>
  );
}

export default AACPublicHeader;
