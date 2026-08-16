import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { parseDevelopmentHash, scheduleDevelopmentSectionScroll } from "@/lib/developments/scroll";

export type DevelopmentNavItem = {
  id: string;
  label: string;
  to: string;
  hash?: string;
  end?: boolean;
};

export function buildDevelopmentNav(slug: string): DevelopmentNavItem[] {
  const base = `/developments/${slug}`;
  return [
    { id: "gallery", label: "Photos", to: `${base}#gallery`, hash: "gallery" },
    { id: "overview", label: "Overview", to: `${base}#overview`, hash: "overview" },
    { id: "amenities", label: "Amenities", to: `${base}#amenities`, hash: "amenities" },
    { id: "floor-plans", label: "Floor Plans", to: `${base}/floor-plans` },
    { id: "units", label: "Available Units", to: `${base}/units` },
    { id: "documents", label: "Documents", to: `${base}/documents` },
    { id: "updates", label: "Updates", to: `${base}/updates` },
    { id: "sales", label: "Sales Team", to: `${base}#sales-team`, hash: "sales-team" },
  ];
}

export function DevelopmentSubNav({
  slug,
  className,
}: {
  slug: string;
  className?: string;
}) {
  const items = buildDevelopmentNav(slug);
  const navigate = useNavigate();
  const location = useLocation();
  const overviewPath = `/developments/${slug}`;

  const goToHashSection = (sectionId: string) => {
    const targetHash = `#${sectionId}`;
    if (location.pathname === overviewPath && location.hash === targetHash) {
      scheduleDevelopmentSectionScroll(sectionId);
      return;
    }
    // SPA navigate so overview can mount, then scroll after render.
    navigate(`${overviewPath}${targetHash}`);
  };

  return (
    <nav
      aria-label="Development sections"
      className={cn(
        "sticky top-0 z-20 -mx-6 border-b border-zinc-200/90 bg-white/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-white/85 md:-mx-8 md:px-8",
        className,
      )}
    >
      <ul className="flex gap-1 overflow-x-auto py-2 scrollbar-none">
        {items.map((item) => {
          if (item.hash) {
            const active =
              location.pathname === overviewPath &&
              parseDevelopmentHash(location.hash) === item.hash;
            return (
              <li key={item.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => goToHashSection(item.hash!)}
                  className={cn(
                    "inline-flex whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
                  )}
                >
                  {item.label}
                </button>
              </li>
            );
          }
          return (
            <li key={item.id} className="shrink-0">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "inline-flex whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-zinc-900 text-white"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
                  )
                }
              >
                {item.label}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
