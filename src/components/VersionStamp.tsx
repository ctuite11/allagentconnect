export default function VersionStamp({
  className = "",
}: {
  className?: string;
}) {
  const target = import.meta.env.VITE_DEPLOY_TARGET || "local";
  const version = import.meta.env.VITE_APP_VERSION || "dev";

  return (
    <div className={`text-xs text-muted-foreground ${className}`}>
      {target} · {version}
    </div>
  );
}
