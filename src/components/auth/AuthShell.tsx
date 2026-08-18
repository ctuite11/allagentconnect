import AACMonogram from "@/components/ui/AACMonogram";

/** Dark masthead lockup — matches AAC unified email template. */
export function AuthBrandMasthead() {
  return (
    <div className="w-full bg-[#0B0B0F] px-6 py-8 sm:py-9">
      <div className="flex flex-col items-center gap-3">
        <AACMonogram className="h-10 w-10 text-[#22C55E]" />
        <div
          className="text-[22px] font-semibold leading-none tracking-tight text-white sm:text-[26px]"
          style={{ fontFamily: "Manrope, system-ui, sans-serif" }}
        >
          All Agent Connect
        </div>
        <div className="h-[2px] w-16 bg-[#22C55E]" />
      </div>
    </div>
  );
}

/** Dark footer band — matches AAC unified email template. */
export function AuthBrandFooter() {
  return (
    <div className="w-full bg-[#0B0B0F] px-6 py-5 mt-auto">
      <div className="flex flex-col items-center gap-2">
        <div className="h-[2px] w-full max-w-[640px] bg-[#22C55E] -mt-6 mb-4" />
        <AACMonogram className="h-7 w-7 text-[#22C55E]" />
        <div
          className="text-sm text-white/80"
          style={{ fontFamily: "Manrope, system-ui, sans-serif" }}
        >
          All Agent Connect
        </div>
      </div>
    </div>
  );
}

/** Shared shell: dark masthead + white content + dark footer (email template aligned). */
export function AuthShell({
  children,
  maxWidth = "460px",
}: {
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <AuthBrandMasthead />
      <main className="flex-1 flex items-start justify-center px-4 py-8 sm:py-10 bg-white">
        <div className="w-full" style={{ maxWidth }}>
          {children}
        </div>
      </main>
      <AuthBrandFooter />
    </div>
  );
}

export default AuthShell;