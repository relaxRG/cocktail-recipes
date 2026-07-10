import { usePersistedState } from "@/hooks/use-persisted-state";

/** Settings for card tag display (bottle cards, homemade cards) */
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
};

export function useCardTagSettings() {
  return usePersistedState<CardTagSettings>("card.tag.settings.v1", DEFAULT_CARD_TAG_SETTINGS);
}
