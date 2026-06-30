import * as React from "react";

type XIconProps = React.SVGProps<SVGSVGElement> & {
  size?: number | string;
};

/**
 * X (formerly Twitter) brand glyph. Lucide does not ship an X icon, so we
 * provide our own SVG that accepts the same `className` / `size` / `color`
 * props as a lucide icon. Uses `currentColor` so Tailwind text utilities
 * style it like any other icon.
 */
export const XIcon = React.forwardRef<SVGSVGElement, XIconProps>(
  ({ size = 24, className, ...rest }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25h6.825l4.713 6.231 5.452-6.231Zm-1.161 17.52h1.834L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  ),
);
XIcon.displayName = "XIcon";

export default XIcon;