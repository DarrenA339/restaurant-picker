"use client";

import { useState } from "react";
import { ChevronDownIcon, ClockIcon } from "@/components/icons";
import { useIsDesktop } from "@/components/layout/use-desktop";
import { hoursLine, todayIn } from "@/lib/places/place";
import type { RestaurantData } from "@/lib/restaurants";

/**
 * The hours box (docs/design/08-details): "Open until 11 PM", and the whole
 * week with today in bold. On phones the week sits behind "All hours"; the
 * desktop dialog has the room to show it outright.
 */
export function DetailsHours({ data }: { data: RestaurantData }) {
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  // Read once per mount: the render itself stays free of the clock.
  const [now] = useState(() => new Date());

  const status = hoursLine(data);
  const week = data.details?.weekHours ?? [];
  if (!status && week.length === 0) return null;

  const today = todayIn(week, data.details?.utcOffsetMinutes, now);
  const title = status ?? "Hours";
  const list = (
    <ul
      id="details-hours"
      className="flex flex-col gap-1.5 pr-3.5 pb-3 pl-[42px] text-sm lg:gap-1 lg:pr-4 lg:pb-3.5 lg:pl-[41px] lg:text-[13px]"
    >
      {week.map((line, i) => (
        <li
          key={line.day}
          className={`flex justify-between gap-3 ${i === today ? "font-extrabold text-ink" : "font-medium text-quiet"}`}
        >
          <span>{i === today ? `${line.day} (today)` : line.day}</span>
          <span className="text-right">{line.hours}</span>
        </li>
      ))}
    </ul>
  );

  if (week.length === 0 || desktop) {
    return (
      <div className="rounded-2xl bg-page">
        <p className="flex min-h-[52px] items-center gap-2.5 px-3.5 text-[15px] font-bold lg:gap-2 lg:px-4">
          <ClockIcon size={18} />
          {title}
        </p>
        {week.length ? list : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-page">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="details-hours"
        onClick={() => setOpen(!open)}
        className="flex min-h-[52px] w-full items-center gap-2.5 px-3.5 text-left text-ink"
      >
        <ClockIcon size={18} />
        <span className="flex-1 text-[15px] font-bold">{title}</span>
        <span className="text-[13px] font-semibold text-quiet">All hours</span>
        <ChevronDownIcon size={18} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? list : null}
    </div>
  );
}
