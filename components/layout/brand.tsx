import { ForkKnifeIcon } from "@/components/icons";

export type BrandSize = "md" | "lg";

// Two sizes from docs/design/source: 32px mark + 17px name on phones and in
// the desktop lobby, 36px + 19px in the desktop headers of flow screens.
const styles: Record<BrandSize, { mark: string; icon: number; name: string }> = {
  md: { mark: "size-8 rounded-[10px]", icon: 18, name: "text-[17px]" },
  lg: { mark: "size-9 rounded-[11px]", icon: 20, name: "text-[19px]" },
};

const desktopStyles: Record<BrandSize, { mark: string; icon: string; name: string }> = {
  md: { mark: "lg:size-8 lg:rounded-[10px]", icon: "lg:size-[18px]", name: "lg:text-[17px]" },
  lg: { mark: "lg:size-9 lg:rounded-[11px]", icon: "lg:size-5", name: "lg:text-[19px]" },
};

type BrandProps = {
  size?: BrandSize;
  /** The size from 1024px up, when it differs. */
  desktopSize?: BrandSize;
  className?: string;
};

/** The app mark and name. */
export function Brand({ size = "md", desktopSize = size, className = "" }: BrandProps) {
  const base = styles[size];
  const wide = desktopSize === size ? null : desktopStyles[desktopSize];
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <span
        className={`flex items-center justify-center bg-accent text-white ${base.mark} ${wide?.mark ?? ""}`}
        aria-hidden="true"
      >
        <ForkKnifeIcon size={base.icon} className={wide?.icon} />
      </span>
      <span className={`font-extrabold tracking-[-0.01em] ${base.name} ${wide?.name ?? ""}`}>
        [APP NAME]
      </span>
    </span>
  );
}

type BrandHeaderProps = {
  /** Show the header on phones too (Welcome). Flow screens show it only on desktop. */
  mobile?: boolean;
};

/**
 * The "[APP NAME]" header from the desktop designs: 1104px wide, 32px side
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
