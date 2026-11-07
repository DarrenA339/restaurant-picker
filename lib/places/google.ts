import "server-only";
import type { CallKind, CallLog } from "./calls";
import { AUTOCOMPLETE_FIELD_MASK, DETAILS_FIELD_MASK, SEARCH_FIELD_MASK } from "./fields";
import type { GooglePlace, PlacesPort, Prediction } from "./place";

/**
 * The only module that talks to Google. Every request carries the key from
 * GOOGLE_PLACES_API_KEY (server-only), an explicit field mask, and a timeout,
 * and counts itself in the request's CallLog so routes can log their cost.
 */

const BASE = "https://places.googleapis.com/v1";
const TIMEOUT_MS = 8000;
/** Wide enough for a card or details photo on a 3x phone; photos are billed per request, not per pixel. */
const PHOTO_MAX_WIDTH_PX = 800;
const PHOTO_NAME = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

type LatLngLiteral = { latitude: number; longitude: number };
type Circle = { center: LatLngLiteral; radius: number };
type Rectangle = { low: LatLngLiteral; high: LatLngLiteral };

export type AutocompleteBody = {
  input: string;
  sessionToken: string;
  locationBias?: { circle: Circle } | { rectangle: Rectangle };
  origin?: LatLngLiteral;
  includedPrimaryTypes?: string[];
  includeQueryPredictions?: boolean;
  languageCode?: string;
  regionCode?: string;
};

type FormattableText = { text?: string };

export type AutocompleteResponse = {
  suggestions?: {
    placePrediction?: {
      placeId?: string;
      text?: FormattableText;
      structuredFormat?: { mainText?: FormattableText; secondaryText?: FormattableText };
    };
    queryPrediction?: { text?: FormattableText };
  }[];
};

export type SearchTextBody = {
  textQuery: string;
  includedType?: string;
  pageSize?: number;
  pageToken?: string;
  locationBias?: { circle: Circle };
  openNow?: boolean;
  priceLevels?: string[];
  languageCode?: string;
  regionCode?: string;
};

export type SearchTextResponse = { places?: GooglePlace[]; nextPageToken?: string };

export type PlacesClient = Omit<PlacesPort, "details"> & {
  autocomplete(body: AutocompleteBody): Promise<AutocompleteResponse>;
  searchText(body: SearchTextBody): Promise<SearchTextResponse>;
  /** Place Details; a narrower mask than the card's picks a cheaper SKU. */
  details(placeId: string, sessionToken?: string, fieldMask?: string): Promise<GooglePlace>;
};

/** The place predictions of an autocomplete response, as the client shows them. */
export function placePredictions(result: AutocompleteResponse): Prediction[] {
  const places: Prediction[] = [];
  for (const suggestion of result.suggestions ?? []) {
    const place = suggestion.placePrediction;
    if (!place?.placeId) continue;
    places.push({
      placeId: place.placeId,
      mainText: place.structuredFormat?.mainText?.text ?? place.text?.text ?? "",
      secondaryText: place.structuredFormat?.secondaryText?.text ?? "",
    });
  }
  return places;
}

export class PlacesError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "PlacesError";
  }
}

type CallInit = { method: "GET" | "POST"; fieldMask?: string; body?: unknown };

/** A client for one request. Reads the key here, never at module scope, so builds without env still compile. */
export function googlePlaces(calls: CallLog): PlacesClient {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error("Missing GOOGLE_PLACES_API_KEY");

  async function call<T>(kind: CallKind, path: string, init: CallInit): Promise<T> {
    calls.count(kind);
    const headers: Record<string, string> = {
      "X-Goog-Api-Key": apiKey as string,
      "Content-Type": "application/json",
    };
    if (init.fieldMask) headers["X-Goog-FieldMask"] = init.fieldMask;
    const response = await fetch(`${BASE}${path}`, {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new PlacesError(response.status, `${kind} ${response.status}: ${text.slice(0, 300)}`);
    }
    return (await response.json()) as T;
  }

  return {
    autocomplete(body) {
      return call<AutocompleteResponse>("autocomplete", "/places:autocomplete", {
        method: "POST",
        fieldMask: AUTOCOMPLETE_FIELD_MASK,
        body,
      });
    },
    searchText(body) {
      return call<SearchTextResponse>("search", "/places:searchText", {
        method: "POST",
        fieldMask: SEARCH_FIELD_MASK,
        body,
      });
    },
    details(placeId: string, sessionToken?: string, fieldMask: string = DETAILS_FIELD_MASK) {
      const token = sessionToken ? `?sessionToken=${encodeURIComponent(sessionToken)}` : "";
      return call<GooglePlace>("details", `/places/${encodeURIComponent(placeId)}${token}`, {
        method: "GET",
        fieldMask,
      });
    },
    async photoUri(photoName) {
      if (!PHOTO_NAME.test(photoName)) throw new PlacesError(400, `bad photo name ${photoName}`);
      // The media endpoint returns a JSON { name, photoUri } with skipHttpRedirect
      // instead of redirecting to the image; it has no fields to mask.
      const result = await call<{ photoUri?: string }>(
        "photo",
        `/${photoName}/media?maxWidthPx=${PHOTO_MAX_WIDTH_PX}&skipHttpRedirect=true`,
        { method: "GET" },
      );
      return result.photoUri ?? null;
    },
  };
}
