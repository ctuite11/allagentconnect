import AACMonogram from "./AACMonogram";

export default function AACLogo() {
  return (
    <div className="flex items-center gap-2">
      <AACMonogram className="w-8 h-8" />

      <span
        className="font-extrabold text-lg tracking-tight text-white"
        style={{ fontFamily: "Manrope, sans-serif" }}
      >
        All Agent Connect
      </span>
    </div>
  );
}
