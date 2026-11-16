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

/** The "+ Add" sign on explore rows (stroke 3 in the design). */
export function PlusIcon(props: IconProps) {
  return (
    <Svg strokeWidth={3} {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

/** The Filters button: two slider rows. */
export function SlidersIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2.2" />
      <circle cx="10" cy="17" r="2.2" />
    </Svg>
  );
}

/** "Search this area" (stroke 2.6 in the design). */
export function RefreshIcon(props: IconProps) {
  return (
    <Svg strokeWidth={2.6} {...props}>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v4h-4" />
    </Svg>
  );
}

/** Opening hours. */
export function ClockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  );
}

/** The veto button: a circle with a slash (stroke 2.4 in the design). */
export function VetoIcon(props: IconProps) {
  return (
    <Svg strokeWidth={2.4} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 6l12 12" />
    </Svg>
  );
}

/** A filled rating star. */
export function StarIcon({ size = 24, className = "", ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      <path d="M12 2.8l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.6l-5.8 3 1.1-6.4-4.7-4.6 6.5-.9z" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg strokeWidth={2.4} {...props}>
      <path d="M9 5l7 7-7 7" />
    </Svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </Svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Svg strokeWidth={2.4} {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  );
}

/** The drag handle on a ranking row: two columns of dots. */
export function GripIcon({ size = 24, className = "", ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </svg>
  );
}

export function ChevronUpIcon(props: IconProps) {
  return (
    <Svg strokeWidth={2.4} {...props}>
      <path d="M6 15l6-6 6 6" />
    </Svg>
  );
}

/** The share arrow: up and out of a tray. */
export function ShareIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 14V3" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </Svg>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z" />
    </Svg>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3 8l9 6 9-6" />
    </Svg>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <Svg strokeWidth={2.6} {...props}>
      <path d="M5 12h14" />
    </Svg>
  );
}

/** The details sheet's Website / Menu link. */
export function GlobeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
    </Svg>
  );
}

/** The details sheet's Directions link. */
export function DirectionsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3 11l18-8-8 18-2-8z" />
    </Svg>
  );
}

/** The details sheet's Call link. */
export function PhoneIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
    </Svg>
  );
}
