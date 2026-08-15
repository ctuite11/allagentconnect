import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

export type DevelopmentNavItem = {
  id: string;
  label: string;
  to: string;
  end?: boolean;
};

export function buildDevelopmentNav(slug: string): DevelopmentNavItem[] {
  const base = `/developments/${slug}`;
  return [
    { id: "overview", label: "Overview", to: base, end: true },
    { id: "amenities", label: "Amenities", to: `${base}#amenities` },
    { id: "floor-plans", label: "Floor Plans", to: `${base}/floor-plans` },
    { id: "units", label: "Available Units", to: `${base}/units` },
    { id: "gallery", label: "Gallery", to: `${base}#gallery` },
    { id: "documents", label: "Documents", to: `${base}/documents` },
    { id: "updates", label: "Updates", to: `${base}/updates` },
    { id: "sales", label: "Sales Team", to: `${base}#sales-team` },
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
          const isHash = item.to.includes("#");
          if (isHash) {
            return (
              <li key={item.id} className="shrink-0">
                <a
                  href={item.to}
                  className="inline-flex whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                >
                  {item.label}
                </a>
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
