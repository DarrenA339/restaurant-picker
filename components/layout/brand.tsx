export type BrandSize = "md" | "lg";

// Two sizes from docs/design/source/01-welcome*: a 32px mark + 26px wordmark
// on phones and in the desktop lobby, 40px + 34px in the desktop headers.
const styles: Record<BrandSize, { wrap: string; mark: string; name: string }> = {
  md: { wrap: "gap-2.5", mark: "size-8", name: "text-[26px]" },
  lg: { wrap: "gap-3", mark: "size-10", name: "text-[34px]" },
};

const desktopStyles: Record<BrandSize, { wrap: string; mark: string; name: string }> = {
  md: { wrap: "lg:gap-2.5", mark: "lg:size-8", name: "lg:text-[26px]" },
  lg: { wrap: "lg:gap-3", mark: "lg:size-10", name: "lg:text-[34px]" },
};

// The bitten c, from public/brand/chews-mark.svg (120x120, drawn to sit inside the tile).
const MARK_PATH =
  "M76.9 52.5L77.3 52.9L77.9 53.0L78.7 52.6L79.0 52.3L79.1 51.7L78.7 50.4L78.5 49.1L78.5 47.9L78.8 46.6L79.2 45.4L79.8 44.2L80.7 43.2L81.7 42.3L82.7 41.6L83.8 41.2L84.7 40.9L85.9 40.7L87.3 40.7L88.4 40.9L89.6 41.3L91.1 42.0L91.7 41.9L92.1 41.5L92.1 41.0L92.0 40.6L90.7 38.8L89.3 37.1L86.6 34.4L84.0 32.1L82.2 30.9L80.0 29.5L77.8 28.4L75.4 27.3L73.0 26.5L70.9 25.9L68.4 25.4L65.8 25.1L63.2 25.0L60.7 25.1L58.1 25.3L55.6 25.8L53.1 26.4L51.0 27.0L48.6 28.0L46.3 29.1L43.4 30.9L40.6 32.9L38.1 35.2L35.7 37.8L33.7 40.6L31.9 43.5L30.5 46.6L29.3 49.8L28.5 53.2L28.0 56.6L27.8 60.0L28.0 63.4L28.5 66.8L29.3 70.2L30.5 73.4L31.9 76.5L33.7 79.4L35.7 82.2L38.0 84.7L40.6 87.1L43.4 89.1L46.3 90.9L49.4 92.3L52.6 93.5L56.0 94.3L59.4 94.8L62.8 95.0L66.2 94.8L69.6 94.3L73.0 93.5L76.2 92.3L79.3 90.9L81.5 89.6L83.7 88.1L85.7 86.5L87.6 84.7L89.9 82.2L92.0 79.4L92.1 78.8L91.8 78.2L91.5 78.0L91.0 78.0L89.7 78.6L88.6 79.0L87.3 79.3L86.1 79.3L84.7 79.1L83.6 78.8L82.5 78.3L81.6 77.6L80.7 76.8L79.9 75.9L79.4 75.1L79.0 74.0L78.6 72.7L78.5 71.1L78.6 69.9L79.0 68.4L79.1 68.0L79.0 67.7L78.7 67.4L77.8 67.0L77.4 67.1L77.1 67.3L76.2 68.7L75.3 70.0L74.3 71.2L73.2 72.1L71.0 73.7L68.6 74.9L67.1 75.4L65.7 75.7L64.2 75.9L62.8 76.0L61.2 75.9L59.9 75.7L58.5 75.4L57.0 74.9L55.1 74.0L53.1 72.7L51.4 71.2L49.9 69.5L48.7 67.5L47.8 65.6L47.1 63.3L46.8 61.0L46.9 58.4L47.4 55.7L48.3 53.2L49.7 50.8L51.5 48.7L53.6 46.9L56.0 45.5L58.5 44.6L61.2 44.1L64.0 44.0L66.7 44.5L69.1 45.3L71.5 46.6L73.7 48.3L75.5 50.3Z";

type BrandProps = {
  size?: BrandSize;
  /** The size from 1024px up, when it differs. */
  desktopSize?: BrandSize;
  className?: string;
};

/** The Chews lockup: the c mark on its tomato tile, then "chews" as text in the display face. */
export function Brand({ size = "md", desktopSize = size, className = "" }: BrandProps) {
  const base = styles[size];
  const wide = desktopSize === size ? null : desktopStyles[desktopSize];
  return (
    <span className={`flex items-center ${base.wrap} ${wide?.wrap ?? ""} ${className}`}>
      <svg
        viewBox="0 0 120 120"
        aria-hidden="true"
        className={`block shrink-0 rounded-[23.33%] bg-accent text-page ${base.mark} ${wide?.mark ?? ""}`}
      >
        <path d={MARK_PATH} fill="currentColor" />
      </svg>
      <span
        className={`font-display leading-none font-normal tracking-[-0.01em] whitespace-nowrap ${base.name} ${wide?.name ?? ""}`}
      >
        chews
      </span>
    </span>
  );
}

type BrandHeaderProps = {
  /** Show the header on phones too (Welcome). Flow screens show it only on desktop. */
  mobile?: boolean;
};

/**
 * The Chews header from the desktop designs: 1104px wide, 32px side
 * padding, 28px from the top.
 */
export function BrandHeader({ mobile = false }: BrandHeaderProps) {
  return (
    <header
      className={`mx-auto w-full max-w-[1104px] shrink-0 items-center lg:flex lg:px-8 lg:pt-7 ${
        mobile ? "flex px-5 pt-3" : "hidden"
      }`}
    >
      <Brand size={mobile ? "md" : "lg"} desktopSize="lg" />
    </header>
  );
}
