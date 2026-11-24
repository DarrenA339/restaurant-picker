"use client";

import { useState } from "react";
import { BackIcon, CameraIcon, ChevronRightIcon } from "@/components/icons";
import type { GalleryPhoto, PhotoAttribution } from "@/lib/restaurants";

const arrowClass =
  "absolute top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-ink shadow-[0_2px_8px_rgba(42,28,21,0.18)] disabled:opacity-45";

function Credit({ attribution, linkClass }: { attribution: PhotoAttribution; linkClass: string }) {
  return (
    <>
      Photo by&nbsp;
      {attribution.uri ? (
        <a href={attribution.uri} target="_blank" rel="noreferrer" className={linkClass}>
          {attribution.name}
        </a>
      ) : (
        attribution.name
      )}
      &nbsp;on <span translate="no">Google Maps</span>
    </>
  );
}

/**
 * The details sheet's photos (docs/design/08-details): one at a time with
 * previous and next, the position, and the credit of the photo on show,
 * under the photo on phones and over its corner in the desktop dialog.
 */
export function DetailsGallery({ photos }: { photos: GalleryPhoto[] }) {
  const [index, setIndex] = useState(0);
  // The gallery can arrive after the first photo; never point past its end.
  const at = Math.min(index, Math.max(0, photos.length - 1));
  const photo = photos[at];
  const attribution = photo?.attributions?.[0];
  const many = photos.length > 1;

  return (
    <div className="flex shrink-0 flex-col gap-2 lg:min-w-0 lg:flex-1 lg:gap-0">
      <div className="relative h-[232px] overflow-hidden rounded-[20px] bg-[#E9E4DA] lg:h-full lg:min-h-[280px] lg:rounded-none">
        {photo ? (
          // Google photo URIs come from the server; next/image would need a remote pattern per host.
          // eslint-disable-next-line @next/next/no-img-element
          <img key={photo.uri} src={photo.uri} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[13px] font-bold text-[#5E5A52] lg:text-sm">
            <CameraIcon size={28} strokeWidth={1.8} />
            Restaurant photo
          </span>
        )}

        {many ? (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              disabled={at === 0}
              onClick={() => setIndex(at - 1)}
              className={`${arrowClass} left-2.5 lg:left-4`}
            >
              <BackIcon size={18} strokeWidth={2.6} />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              disabled={at === photos.length - 1}
              onClick={() => setIndex(at + 1)}
              className={`${arrowClass} right-2.5 lg:right-4`}
            >
              <ChevronRightIcon size={18} strokeWidth={2.6} />
            </button>
          </>
        ) : null}

        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-end gap-3 lg:inset-x-4 lg:bottom-4 lg:justify-between">
          {attribution ? (
            <span className="pointer-events-auto hidden h-7 min-w-0 items-center rounded-full bg-surface px-2.5 text-xs font-semibold text-[#3D4047] lg:flex">
              {/* One text run: as separate flex items the words would lose their spaces. */}
              <span className="truncate">
                <Credit attribution={attribution} linkClass="text-[#3D4047] underline" />
              </span>
            </span>
          ) : (
            <span className="hidden lg:block" />
          )}
          {many ? (
            <span
              aria-live="polite"
              className="flex h-7 shrink-0 items-center rounded-full bg-ink px-2.5 text-xs font-bold text-white"
            >
              <span className="sr-only">Photo </span>
              {at + 1} / {photos.length}
            </span>
          ) : null}
        </div>
      </div>

      {attribution ? (
        <p className="text-xs font-semibold text-quiet lg:hidden">
          <Credit attribution={attribution} linkClass="text-quiet underline" />
        </p>
      ) : null}
    </div>
  );
}
