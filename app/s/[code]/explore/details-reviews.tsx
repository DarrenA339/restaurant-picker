"use client";

import { useState } from "react";
import type { PlaceReview } from "@/lib/restaurants";

/** Past this a review is clamped to three lines behind "More". */
const LONG_REVIEW = 150;
const AVATAR_TONES = ["bg-person-2", "bg-person-3", "bg-person-4"];

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

function reviewMeta(review: PlaceReview): string {
  const parts: string[] = [];
  if (review.rating !== undefined) parts.push(`${review.rating} star${review.rating === 1 ? "" : "s"}`);
  if (review.relativeTime) parts.push(review.relativeTime);
  return parts.join(", ");
}

function Review({ review, tone }: { review: PlaceReview; tone: string }) {
  const [open, setOpen] = useState(false);
  const long = review.text.length > LONG_REVIEW;
  const meta = reviewMeta(review);

  return (
    <article className="flex flex-col gap-2 rounded-2xl bg-page p-3.5 lg:gap-1.5">
      <div className="flex items-center gap-2.5">
        {review.authorPhotoUri ? (
          // Google's avatar for the author; its policies ask for it beside the review.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={review.authorPhotoUri}
            alt=""
            referrerPolicy="no-referrer"
            className="size-8 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white ${tone}`}
          >
            {initials(review.author)}
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          {review.authorUri ? (
            <a
              href={review.authorUri}
              target="_blank"
              rel="noreferrer"
              className="truncate text-sm font-bold text-ink underline"
            >
              {review.author}
            </a>
          ) : (
            <span className="truncate text-sm font-bold">{review.author}</span>
          )}
          {meta ? (
            review.googleMapsUri ? (
              <a
                href={review.googleMapsUri}
                target="_blank"
                rel="noreferrer"
                aria-label={`${meta}, open this review on Google Maps`}
                className="text-xs font-semibold text-quiet"
              >
                {meta}
              </a>
            ) : (
              <span className="text-xs font-semibold text-quiet">{meta}</span>
            )
          ) : null}
        </span>
      </div>
      <p className={`text-sm leading-normal font-medium whitespace-pre-line ${long && !open ? "line-clamp-3" : ""}`}>
        {review.text}
      </p>
      {long ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="h-8 self-start text-[13px] font-bold text-ink underline underline-offset-[3px]"
        >
          {open ? "Less" : "More"}
        </button>
      ) : null}
    </article>
  );
}

type DetailsReviewsProps = {
  reviews: PlaceReview[];
  /** Where "All reviews" goes: the place on Google Maps. */
  allReviewsUri?: string;
};

/**
 * Up to three of Google's reviews (docs/design/08-details), in Google's own
 * order, which the "Most relevant" label names as its policies require.
 */
export function DetailsReviews({ reviews, allReviewsUri }: DetailsReviewsProps) {
  if (reviews.length === 0) return null;
  return (
    <section aria-labelledby="details-reviews" className="flex flex-col gap-3 lg:gap-2.5">
      <div className="flex items-baseline justify-between">
        <h3 id="details-reviews" className="text-lg font-extrabold">
          Reviews
        </h3>
        <span className="text-[13px] font-semibold text-quiet">Most relevant</span>
      </div>
      {reviews.map((review, i) => (
        <Review key={i} review={review} tone={AVATAR_TONES[i % AVATAR_TONES.length]} />
      ))}
      {allReviewsUri ? (
        <a
          href={allReviewsUri}
          target="_blank"
          rel="noreferrer"
          className="self-start text-sm font-bold text-ink underline"
        >
          All reviews on <span translate="no">Google Maps</span>
        </a>
      ) : null}
    </section>
  );
}
