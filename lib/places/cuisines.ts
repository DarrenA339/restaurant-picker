/**
 * Google's `*_restaurant` place types (Places API New, Table A, "Food and
 * Drink") with readable labels, for the Cuisine filter. A place's `types`
 * array is checked against these on the server; a single pick also goes to
 * Text Search as `includedType`.
 */

export const CUISINE_TYPES = [
  ["afghani_restaurant", "Afghan"],
  ["african_restaurant", "African"],
  ["american_restaurant", "American"],
  ["argentinian_restaurant", "Argentinian"],
  ["asian_fusion_restaurant", "Asian fusion"],
  ["asian_restaurant", "Asian"],
  ["australian_restaurant", "Australian"],
  ["austrian_restaurant", "Austrian"],
  ["bangladeshi_restaurant", "Bangladeshi"],
  ["barbecue_restaurant", "Barbecue"],
  ["basque_restaurant", "Basque"],
  ["bavarian_restaurant", "Bavarian"],
  ["belgian_restaurant", "Belgian"],
  ["brazilian_restaurant", "Brazilian"],
  ["breakfast_restaurant", "Breakfast"],
  ["british_restaurant", "British"],
  ["brunch_restaurant", "Brunch"],
  ["buffet_restaurant", "Buffet"],
  ["burmese_restaurant", "Burmese"],
  ["burrito_restaurant", "Burritos"],
  ["cajun_restaurant", "Cajun"],
  ["californian_restaurant", "Californian"],
  ["cambodian_restaurant", "Cambodian"],
  ["cantonese_restaurant", "Cantonese"],
  ["caribbean_restaurant", "Caribbean"],
  ["chicken_restaurant", "Chicken"],
  ["chicken_wings_restaurant", "Chicken wings"],
  ["chilean_restaurant", "Chilean"],
  ["chinese_noodle_restaurant", "Chinese noodles"],
  ["chinese_restaurant", "Chinese"],
  ["colombian_restaurant", "Colombian"],
  ["croatian_restaurant", "Croatian"],
  ["cuban_restaurant", "Cuban"],
  ["czech_restaurant", "Czech"],
  ["danish_restaurant", "Danish"],
  ["dessert_restaurant", "Dessert"],
  ["dim_sum_restaurant", "Dim sum"],
  ["dumpling_restaurant", "Dumplings"],
  ["dutch_restaurant", "Dutch"],
  ["eastern_european_restaurant", "Eastern European"],
  ["ethiopian_restaurant", "Ethiopian"],
  ["european_restaurant", "European"],
  ["falafel_restaurant", "Falafel"],
  ["family_restaurant", "Family"],
  ["fast_food_restaurant", "Fast food"],
  ["filipino_restaurant", "Filipino"],
  ["fine_dining_restaurant", "Fine dining"],
  ["fish_and_chips_restaurant", "Fish and chips"],
  ["fondue_restaurant", "Fondue"],
  ["french_restaurant", "French"],
  ["fusion_restaurant", "Fusion"],
  ["german_restaurant", "German"],
  ["greek_restaurant", "Greek"],
  ["gyro_restaurant", "Gyros"],
  ["halal_restaurant", "Halal"],
  ["hamburger_restaurant", "Burgers"],
  ["hawaiian_restaurant", "Hawaiian"],
  ["hot_dog_restaurant", "Hot dogs"],
  ["hot_pot_restaurant", "Hot pot"],
  ["hungarian_restaurant", "Hungarian"],
  ["indian_restaurant", "Indian"],
  ["indonesian_restaurant", "Indonesian"],
  ["irish_restaurant", "Irish"],
  ["israeli_restaurant", "Israeli"],
  ["italian_restaurant", "Italian"],
  ["japanese_curry_restaurant", "Japanese curry"],
  ["japanese_izakaya_restaurant", "Izakaya"],
  ["japanese_restaurant", "Japanese"],
  ["korean_barbecue_restaurant", "Korean barbecue"],
  ["korean_restaurant", "Korean"],
  ["latin_american_restaurant", "Latin American"],
  ["lebanese_restaurant", "Lebanese"],
  ["malaysian_restaurant", "Malaysian"],
  ["mediterranean_restaurant", "Mediterranean"],
  ["mexican_restaurant", "Mexican"],
  ["middle_eastern_restaurant", "Middle Eastern"],
  ["mongolian_barbecue_restaurant", "Mongolian barbecue"],
  ["moroccan_restaurant", "Moroccan"],
  ["north_indian_restaurant", "North Indian"],
  ["oyster_bar_restaurant", "Oyster bar"],
  ["pakistani_restaurant", "Pakistani"],
  ["persian_restaurant", "Persian"],
  ["peruvian_restaurant", "Peruvian"],
  ["pizza_restaurant", "Pizza"],
  ["polish_restaurant", "Polish"],
  ["portuguese_restaurant", "Portuguese"],
  ["ramen_restaurant", "Ramen"],
  ["romanian_restaurant", "Romanian"],
  ["russian_restaurant", "Russian"],
  ["scandinavian_restaurant", "Scandinavian"],
  ["seafood_restaurant", "Seafood"],
  ["shawarma_restaurant", "Shawarma"],
  ["soul_food_restaurant", "Soul food"],
  ["soup_restaurant", "Soup"],
  ["south_american_restaurant", "South American"],
  ["south_indian_restaurant", "South Indian"],
  ["southwestern_us_restaurant", "Southwestern"],
  ["spanish_restaurant", "Spanish"],
  ["sri_lankan_restaurant", "Sri Lankan"],
  ["steak_house", "Steakhouse"],
  ["sushi_restaurant", "Sushi"],
  ["swiss_restaurant", "Swiss"],
  ["taco_restaurant", "Tacos"],
  ["taiwanese_restaurant", "Taiwanese"],
  ["tapas_restaurant", "Tapas"],
  ["tex_mex_restaurant", "Tex-Mex"],
  ["thai_restaurant", "Thai"],
  ["tibetan_restaurant", "Tibetan"],
  ["tonkatsu_restaurant", "Tonkatsu"],
  ["turkish_restaurant", "Turkish"],
  ["ukrainian_restaurant", "Ukrainian"],
  ["vegan_restaurant", "Vegan"],
  ["vegetarian_restaurant", "Vegetarian"],
  ["vietnamese_restaurant", "Vietnamese"],
  ["western_restaurant", "Western"],
  ["yakiniku_restaurant", "Yakiniku"],
  ["yakitori_restaurant", "Yakitori"],
] as const;

export type CuisineType = (typeof CUISINE_TYPES)[number][0];

/** The dozen shown before anyone searches the list. */
export const POPULAR_CUISINES: readonly CuisineType[] = [
  "american_restaurant",
  "chinese_restaurant",
  "indian_restaurant",
  "italian_restaurant",
  "japanese_restaurant",
  "korean_restaurant",
  "mediterranean_restaurant",
  "mexican_restaurant",
  "pizza_restaurant",
  "seafood_restaurant",
  "sushi_restaurant",
  "thai_restaurant",
  "vietnamese_restaurant",
  "hamburger_restaurant",
];

const LABELS = new Map<string, string>(CUISINE_TYPES);
const TYPE_SET = new Set<string>(CUISINE_TYPES.map(([type]) => type));

export function isCuisineType(value: unknown): value is CuisineType {
  return typeof value === "string" && TYPE_SET.has(value);
}

/** "korean_restaurant" → "Korean". */
export function cuisineLabel(type: CuisineType): string {
  return LABELS.get(type) ?? type;
}

/** The old filters stored a few plain names; they map onto types so those sessions still parse. */
const LEGACY_NAMES: Record<string, CuisineType> = {
  Korean: "korean_restaurant",
  Japanese: "japanese_restaurant",
  Mexican: "mexican_restaurant",
  Thai: "thai_restaurant",
  Italian: "italian_restaurant",
  Indian: "indian_restaurant",
  Mediterranean: "mediterranean_restaurant",
  Pizza: "pizza_restaurant",
};

export function toCuisineType(value: unknown): CuisineType | null {
  if (isCuisineType(value)) return value;
  if (typeof value === "string" && value in LEGACY_NAMES) return LEGACY_NAMES[value];
  return null;
}

/** The types whose label (or type) contains the query, case-insensitively; everything when the query is blank. */
export function searchCuisines(query: string): CuisineType[] {
  const q = query.trim().toLowerCase();
  return CUISINE_TYPES.filter(([type, label]) => !q || label.toLowerCase().includes(q) || type.includes(q.replace(/\s+/g, "_"))).map(
    ([type]) => type,
  );
}
