import { env } from "../env";

export interface Place {
  placeId: string;
  name: string;
  address: string | null;
  rating: number | null;
  phone: string | null;
  website: string | null;
  types: string[];
}

interface PlacesResponse {
  places?: Array<{
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
    rating?: number;
    nationalPhoneNumber?: string;
    websiteUri?: string;
    types?: string[];
  }>;
}

/** Google Places API (New) text search, biased to the family's home location. */
export async function searchPlaces(opts: {
  query: string;
  lat?: number | null;
  lng?: number | null;
  radiusMeters?: number;
  maxResults?: number;
}): Promise<Place[]> {
  if (!env.GOOGLE_PLACES_API_KEY) throw new Error("GOOGLE_PLACES_API_KEY is not configured");

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env.GOOGLE_PLACES_API_KEY,
      // Field masks keep each call in the cheaper billing SKU.
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.rating,places.nationalPhoneNumber,places.websiteUri,places.types",
    },
    body: JSON.stringify({
      textQuery: opts.query,
      maxResultCount: opts.maxResults ?? 6,
      ...(opts.lat != null && opts.lng != null
        ? {
            locationBias: {
              circle: {
                center: { latitude: opts.lat, longitude: opts.lng },
                radius: opts.radiusMeters ?? 15000,
              },
            },
          }
        : {}),
    }),
  });
  if (!res.ok) throw new Error(`Places API ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as PlacesResponse;

  return (data.places ?? []).map((p) => ({
    placeId: p.id,
    name: p.displayName?.text ?? "Unknown",
    address: p.formattedAddress ?? null,
    rating: p.rating ?? null,
    phone: p.nationalPhoneNumber ?? null,
    website: p.websiteUri ?? null,
    types: p.types ?? [],
  }));
}
