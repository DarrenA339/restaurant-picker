const HERO_ALT =
  "Three restaurant cards in a stack. The front one, Juniper & Rice, a Korean spot, is marked yes while four friends pick.";

const friends = [
  { initials: "MK", tone: "bg-person-2" },
  { initials: "TJ", tone: "bg-person-3" },
  { initials: "NB", tone: "bg-person-4" },
];

const cardClass =
  "absolute h-[172px] w-[128px] overflow-hidden rounded-[15px] bg-white lg:h-[316px] lg:w-[236px] lg:rounded-[28px]";

/** A blank card behind the front one: a photo block and two text lines. */
function BackCard({ className, photo }: { className: string; photo: string }) {
  return (
    <div className={`${cardClass} shadow-[0_6px_18px_rgba(42,28,21,0.10)] ${className}`}>
      <div className={`h-24 lg:h-[177px] ${photo}`} />
      <div className="flex flex-col gap-1.5 p-2.5 lg:gap-3 lg:p-[19px]">
        <span className="h-[9px] w-[70%] rounded-full bg-tint lg:h-[17px]" />
        <span className="h-1.5 w-[45%] rounded-full bg-tint lg:h-3" />
      </div>
    </div>
  );
}

/**
 * The Welcome illustration from docs/design/01: three tilted swipe cards on
 * pale butter, a "4 picking" chip and a yes badge. Decorative, so it is one
 * image with a text alternative. The offsets are the design's, inside a
 * fixed-size stage (350px on phones, 508px on desktop) centered in the panel.
 * The photo is our own file, never a Google Places photo.
 */
export function WelcomeHero() {
  return (
    <div
      role="img"
      aria-label={HERO_ALT}
      className="relative h-[210px] shrink-0 overflow-hidden rounded-[26px] bg-butter-soft lg:h-[540px] lg:rounded-[32px]"
    >
      <div aria-hidden="true" className="absolute inset-y-0 left-1/2 w-[350px] -translate-x-1/2 lg:w-[508px]">
        <BackCard className="top-[21px] left-[57px] -rotate-[9deg] lg:top-[110px] lg:left-[33px]" photo="bg-[#EFD3BD]" />
        <BackCard className="top-[19px] left-[165px] rotate-[8deg] lg:top-[108px] lg:left-[231px]" photo="bg-[#E8CDB0]" />

        <div
          className={`${cardClass} top-[15px] left-[111px] -rotate-2 shadow-[0_14px_32px_rgba(42,28,21,0.16)] lg:top-[104px] lg:left-[132px]`}
        >
          {/* A static file from public/, so next/image has nothing to add. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/hero-card.jpg"
            alt=""
            width={472}
            height={354}
            className="block h-24 w-full bg-[#EFD3BD] object-cover lg:h-[177px]"
          />
          <div className="flex flex-col gap-[3px] px-[11px] py-2.5 lg:gap-[5px] lg:px-5 lg:py-[18px]">
            <span className="truncate text-[15px] leading-[1.1] font-extrabold lg:text-[27px]">Juniper &amp; Rice</span>
            <span className="truncate text-[10px] font-semibold text-quiet lg:text-[19px]">Korean · $$ · ★ 4.8</span>
          </div>
        </div>

        <div className="absolute top-[15px] left-[18px] flex h-[30px] -rotate-3 items-center gap-[7px] rounded-full bg-white pr-2.5 pl-4 shadow-[0_4px_12px_rgba(42,28,21,0.12)] lg:top-[38px] lg:left-[25px] lg:h-12 lg:gap-[13px] lg:pr-[19px] lg:pl-[30px]">
          <span className="flex">
            {friends.map(({ initials, tone }) => (
              <span
                key={initials}
                className={`-ml-1.5 flex size-5 items-center justify-center rounded-full border-2 border-white text-[8px] font-extrabold text-white lg:-ml-[11px] lg:size-[38px] lg:border-[3px] lg:text-sm ${tone}`}
              >
                {initials}
              </span>
            ))}
          </span>
          <span className="text-[11px] font-extrabold lg:text-[19px]">4 picking</span>
        </div>

        <span className="absolute top-[7px] left-[215px] flex size-[38px] rotate-[8deg] items-center justify-center rounded-full border-[3px] border-white bg-accent shadow-[0_6px_16px_rgba(210,67,42,0.28)] lg:top-[90px] lg:left-[324px] lg:size-[71px] lg:border-[6px]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="3.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-[17px] lg:size-8"
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>

        <span className="absolute top-[376px] left-[104px] hidden size-[55px] -rotate-[8deg] items-center justify-center rounded-full bg-white shadow-[0_6px_16px_rgba(42,28,21,0.14)] lg:flex">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="size-[23px]">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </span>
      </div>
    </div>
  );
}
