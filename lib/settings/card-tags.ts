import { usePersistedState } from "@/hooks/use-persisted-state";
import { CardTagSlot, CARD_TAG_SLOTS } from "@/lib/recipes/types";

/** Settings for card tag display */
export interface CardTagSettings {
  /** Show flavor tags on bottle cards */
  showBottleFlavorTags: boolean;
  /** Show flavor tags on homemade cards */
  showHomemadeTags: boolean;
  /** Max number of flavor tags to show per card (0 = all) */
  maxTagsPerCard: number;
  /** Show style tag on bottle cards */
  showBottleStyle: boolean;
  /** Show ABV on bottle cards */
  showBottleAbv: boolean;
  /** Show origin on bottle cards */
  showBottleOrigin: boolean;
  /** Show rating on bottle cards */
  showBottleRating: boolean;
  /** Show volume on bottle cards */
  showBottleVolume: boolean;
  /** Recipe card: slot display order (all 7 slots, user-sorted) */
  recipeCardSlotOrder: CardTagSlot[];
  /** Recipe card: which slots are hidden */
  recipeCardSlotHidden: CardTagSlot[];
  /** Recipe card: custom hex color per slot (empty string = use default) */
  recipeCardColors: Partial<Record<CardTagSlot, string>>;
}

export const DEFAULT_CARD_TAG_SETTINGS: CardTagSettings = {
  showBottleFlavorTags: true,
  showHomemadeTags: true,
  maxTagsPerCard: 3,
  showBottleStyle: true,
  showBottleAbv: true,
  showBottleOrigin: false,
  showBottleRating: true,
  showBottleVolume: true,
  recipeCardSlotOrder: [...CARD_TAG_SLOTS],
  recipeCardSlotHidden: [],
  recipeCardColors: {},
};

export function useCardTagSettings() {
  return usePersistedState<CardTagSettings>("card.tag.settings.v2", DEFAULT_CARD_TAG_SETTINGS);
}
