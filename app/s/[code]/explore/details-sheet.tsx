"use client";

import { useState, type ReactNode } from "react";
import { CheckIcon, CloseIcon, DirectionsIcon, GlobeIcon, PhoneIcon, PlusIcon, StarIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { telHref, websiteLabel, type PlaceResult } from "@/lib/places/place";
import { ATTRIBUTE_LABELS, distanceLabel, type LatLng, type PlaceSummary } from "@/lib/restaurants";
import { priceLabel } from "@/lib/session-filters";
import { DetailsGallery } from "./details-gallery";
import { DetailsHours } from "./details-hours";
import { DetailsReviews } from "./details-reviews";
import type { AddState } from "./result-row";
import { useGallery } from "./use-gallery";

type DetailsSheetProps = {
  /** The session the sheet is opened in: its gallery is fetched and kept per session. */
  sessionId: string;
  place: PlaceResult | null;
  /** The viewer's own location, if they shared one: distances are "from you". */
  viewer: LatLng | null;
  /** The session's starting area: distances are "from the meeting area" without a viewer location. */
  meetingArea: LatLng | null;
  /** Explore: the Add to the deck control's state. */
  state?: AddState;
  onAdd?: () => void;
  /** The swipe screen's vote buttons take the footer instead of Add. */
  footer?: ReactNode;
  onClose: () => void;
};

const linkClass =
  "flex h-[52px] items-center justify-center gap-1.5 rounded-field border-[1.5px] border-line bg-surface text-sm font-bold text-ink lg:h-11 lg:px-4";
const LINK_COLUMNS = ["", "grid-cols-1", "grid-cols-2", "grid-cols-3"];
const smallLink = "font-semibold text-quiet underline";
const closeClass = "size-11 items-center justify-center rounded-full bg-tint text-ink";

/**
 * A spot's details from docs/design/08-details (phone sheet) and
 * 08-details-desktop (a 960px two-pane dialog): the photo gallery, name,
 * meta, address, the week's hours, attribute chips, Google's summary, up to
 * three reviews, and the links. Everything but the gallery comes with the
 * card's own data; the gallery is fetched when the sheet opens.
 */
export function DetailsSheet({
  sessionId,
  place,
  viewer,
  meetingArea,
  state = "idle",
  onAdd,
  footer,
  onClose,
}: DetailsSheetProps) {
  // Keep the last place while the close animation runs.
  const [shown, setShown] = useState(place);
  if (place && place !== shown) setShown(place);

  return (
    <Sheet open={place !== null} onClose={onClose} labelledBy="ex-details-title" size="wide" flush>
      {shown ? (
        <Details
          // A new place starts at its first photo with its reviews folded.
          key={shown.placeId}
          sessionId={sessionId}
          place={shown}
          viewer={viewer}
          meetingArea={meetingArea}
          state={state}
          onAdd={onAdd}
          footer={footer}
          onClose={onClose}
        />
      ) : null}
    </Sheet>
  );
}

/**
 * Google's summary, exactly as sent, with what its policies ask for beside
 * it: a plain source line for the editorial one; for the AI ones, Google's
 * own disclosure line unchanged and a way to report it, plus a heading and a
 * reviews link when it summarizes reviews.
 */
function Summary({ summary }: { summary: PlaceSummary }) {
  return (
    <div className="flex flex-col gap-1.5 lg:gap-1">
      {summary.kind === "review" ? <h3 className="text-[13px] font-bold text-quiet">Review summary</h3> : null}
      <p className="text-base leading-normal font-medium">{summary.text}</p>
      {summary.kind === "editorial" ? (
        <span className="text-xs font-semibold text-quiet">Summary from Google</span>
      ) : (
        <p className="flex flex-wrap gap-x-2.5 gap-y-1 text-xs font-semibold text-quiet">
          <span>{summary.disclosure}</span>
          {summary.reviewsUri ? (
            <a href={summary.reviewsUri} target="_blank" rel="noreferrer" className={smallLink}>
              See reviews
            </a>
          ) : null}
          {summary.flagUri ? (
            <a href={summary.flagUri} target="_blank" rel="noreferrer" className={smallLink}>
              Report
            </a>
          ) : null}
        </p>
      )}
    </div>
  );
}

type DetailsProps = Omit<DetailsSheetProps, "place" | "state"> & { place: PlaceResult; state: AddState };

function Details({ sessionId, place, viewer, meetingArea, state, onAdd, footer, onClose }: DetailsProps) {
  const { data } = place;
  const details = data.details;
  const photos = useGallery(sessionId, place.placeId, data);

  const price = [data.priceLevel ? priceLabel(data.priceLevel) : null, details?.priceRange ? `${details.priceRange} per person` : null]
    .filter(Boolean)
    .join(" · ");
  const meta = [data.cuisine, price].filter(Boolean) as string[];
  const reviewCount =
    data.userRatingCount !== undefined ? `(${data.userRatingCount.toLocaleString("en-US")} reviews)` : null;
  const where = [details?.address, distanceLabel(viewer, meetingArea, data.location)].filter(Boolean).join(" · ");

  const chips = [
    ...(data.servesVegetarianFood ? ["Vegetarian options"] : []),
    ...(details?.attributes ?? []).map((key) => ATTRIBUTE_LABELS[key]),
  ];
  const linkCount = [data.websiteUri, data.googleMapsUri, details?.phone].filter(Boolean).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Phones: pinned to the sheet's corner, beside the handle. The dialog has its own in the title row. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close details"
        className={`absolute top-1.5 right-3 z-10 flex lg:hidden ${closeClass}`}
      >
        <CloseIcon size={18} strokeWidth={2.6} />
      </button>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pt-8 pb-5 lg:flex-row lg:gap-0 lg:overflow-hidden lg:p-0">
        <DetailsGallery photos={photos} />

        <div className="flex flex-col gap-5 lg:min-w-0 lg:flex-1 lg:overflow-y-auto lg:px-7 lg:pt-7 lg:pb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1.5">
              <h2
                id="ex-details-title"
                className="text-[30px] leading-[1.1] font-extrabold tracking-[-0.02em] lg:text-[34px] lg:leading-[1.08]"
              >
                {data.name}
              </h2>
              {meta.length || data.rating !== undefined ? (
                <p className="flex flex-wrap items-center gap-x-1.5 text-[15px] font-semibold text-quiet">
                  {meta.map((part, i) => (
                    <span key={part} className="flex items-center gap-x-1.5">
                      {part}
                      {/* The dot trails its item, so a wrapped line never starts with one. */}
                      {i < meta.length - 1 || data.rating !== undefined ? <span aria-hidden="true">·</span> : null}
                    </span>
                  ))}
                  {data.rating !== undefined ? (
                    <span className="flex items-center gap-x-1.5">
                      <span className="flex items-center gap-1 text-ink">
                        <StarIcon size={15} />
                        <span className="sr-only">Rated </span>
                        {data.rating.toFixed(1)}
                      </span>
                      {reviewCount}
                    </span>
                  ) : null}
                </p>
              ) : null}
              {where ? <p className="text-[15px] font-medium text-quiet">{where}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close details"
              className={`hidden shrink-0 lg:flex ${closeClass}`}
            >
              <CloseIcon size={18} strokeWidth={2.6} />
            </button>
          </div>

          <DetailsHours data={data} />

          {chips.length ? (
            <ul className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <li key={chip} className="flex h-8 items-center rounded-full bg-tint px-3 text-[13px] font-semibold">
                  {chip}
                </li>
              ))}
            </ul>
          ) : null}

          {details?.summary ? <Summary summary={details.summary} /> : null}

          <DetailsReviews reviews={details?.reviews ?? []} allReviewsUri={data.googleMapsUri} />

          {linkCount ? (
            <div className={`grid gap-2 lg:flex lg:flex-wrap ${LINK_COLUMNS[linkCount]}`}>
              {data.websiteUri ? (
                <a href={data.websiteUri} target="_blank" rel="noreferrer" className={linkClass}>
                  <GlobeIcon size={16} className="lg:hidden" />
                  {websiteLabel(data.websiteUri)}
                </a>
              ) : null}
              {data.googleMapsUri ? (
                <a href={data.googleMapsUri} target="_blank" rel="noreferrer" className={linkClass}>
                  <DirectionsIcon size={16} className="lg:hidden" />
                  Directions
                </a>
              ) : null}
              {details?.phone ? (
                <a href={telHref(details.phone)} aria-label={`Call ${details.phone}`} className={linkClass}>
                  <PhoneIcon size={16} className="lg:hidden" />
                  Call
                </a>
              ) : null}
            </div>
          ) : null}

          <p className="text-xs font-semibold text-quiet">
            Restaurant info, photos and reviews from{" "}
            <span translate="no">
              <span className="font-extrabold text-ink">Google</span> Maps
            </span>
          </p>
        </div>
      </div>

      <div className="shrink-0 px-4 pt-3 pb-[calc(22px+env(safe-area-inset-bottom,0px))] shadow-[0_-1px_0_var(--color-track)] lg:flex lg:justify-end lg:px-5 lg:py-3.5">
        {footer ? (
          <div className="w-full">{footer}</div>
        ) : state === "added" ? (
          <div
            role="status"
            className="flex h-14 items-center justify-center gap-2 rounded-button bg-tint text-base font-extrabold text-[#3D4047] lg:w-[260px]"
          >
            <CheckIcon size={18} strokeWidth={3} />
            Added to the group’s deck
          </div>
        ) : (
          <Button
            onClick={onAdd}
            loading={state === "adding"}
            loadingLabel="Adding"
            className="w-full shadow-[0_4px_12px_rgba(210,67,42,0.20)] lg:w-[180px]"
          >
            <PlusIcon size={18} />
            Add to the deck
          </Button>
        )}
      </div>
    </div>
  );
}
