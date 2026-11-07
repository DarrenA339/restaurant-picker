import type { SVGProps } from "react";

/**
 * Inline icons traced from docs/design/source. Each takes the design's stroke
 * width as a default; pass `className` for size and color (stroke uses
 * currentColor unless the design fixes it).
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 24, strokeWidth = 2.2, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** The app mark: a fork and knife. */
export function ForkKnifeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 3v7a2 2 0 0 0 2 2M9 3v18M11 3v7a2 2 0 0 1-2 2M17 21V3c-2.2 1.2-3.5 3.6-3.5 6.5V13H17" />
    </Svg>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <Svg strokeWidth={1.8} {...props}>
      <rect x="3" y="6" width="18" height="14" rx="3" />
      <path d="M8 6l1.5-2h5L16 6" />
      <circle cx="12" cy="13" r="3.5" />
    </Svg>
  );
}

export function SwipeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6" y="4" width="12" height="16" rx="3" />
      <path d="M2 9l2 3-2 3M22 9l-2 3 2 3" />
    </Svg>
  );
}

export function ListIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </Svg>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21s-6.5-5.8-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.2 12 21 12 21z" />
      <circle cx="12" cy="9.8" r="2.3" />
    </Svg>
  );
}

export function PinOffIcon(props: IconProps) {
  return (
    <Svg strokeWidth={2} {...props}>
      <path d="M12 21s-6.5-5.8-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 15.2 12 21 12 21z" />
      <path d="M4 4l16 16" />
    </Svg>
  );
}

/** The "use my location" arrow. */
export function SendIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 11l18-8-8 18-2-8z" />
    </Svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Svg strokeWidth={2.4} {...props}>
      <path d="M6 9l6 6 6-6" />
    </Svg>
  );
}

export function BackIcon(props: IconProps) {
  return (
    <Svg strokeWidth={2.4} {...props}>
      <path d="M15 5l-7 7 7 7" />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg strokeWidth={3} {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="9" y="9" width="12" height="12" rx="2.5" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </Svg>
  );
}

export function SpinnerIcon({ className = "", ...props }: IconProps) {
  return (
    <Svg strokeWidth={3} className={`animate-spin ${className}`} {...props}>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </Svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Svg strokeWidth={2.4} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5M12 16.5h.01" />
    </Svg>
  );
}

export function LinkBrokenIcon(props: IconProps) {
  return (
    <Svg strokeWidth={2} {...props}>
      <path d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-.9.9M14 10a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l.9-.9M4 4l16 16" />
    </Svg>
  );
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <Svg strokeWidth={2} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </Svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg strokeWidth={2.4} {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </Svg>
  );
}

export function MapIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 4L3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z" />
      <path d="M9 4v13.5M15 6.5V20" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg strokeWidth={2.6} {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function PeopleIcon(props: IconProps) {
  return (
    <Svg strokeWidth={2} {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M18 8v6M15 11h6" />
    </Svg>
  );
}
