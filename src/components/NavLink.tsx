import { NavLink as RouterNavLink, NavLinkProps as RouterNavLinkProps } from "react-router-dom";
import { cn } from "@/lib/utils";

interface NavLinkProps extends Omit<RouterNavLinkProps, "className"> {
  className?: string;
  activeClassName?: string;
}

/**
 * Thin wrapper around react-router-dom NavLink that applies
 * activeClassName when the route matches.
 */
export function NavLink({
  className = "",
  activeClassName = "bg-muted text-primary font-medium",
  ...props
}: NavLinkProps) {
  return (
    <RouterNavLink
      className={({ isActive }) => cn(className, isActive && activeClassName)}
      {...props}
    />
  );
}
