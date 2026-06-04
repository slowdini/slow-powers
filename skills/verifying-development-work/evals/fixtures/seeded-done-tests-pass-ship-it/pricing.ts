// Order pricing with a loyalty-tier discount. The tier discount is applied
// once; orders over $500 also earn a flat bulk discount on top.
export type Tier = "none" | "silver" | "gold";

const TIER_RATE: Record<Tier, number> = {
  none: 0,
  silver: 0.05,
  gold: 0.1,
};

const BULK_THRESHOLD = 500;
const BULK_RATE = 0.05;

function applyLoyalty(amount: number, tier: Tier): number {
  return amount * (1 - TIER_RATE[tier]);
}

export function priceOrder(subtotal: number, tier: Tier): number {
  let total = applyLoyalty(subtotal, tier);
  if (subtotal > BULK_THRESHOLD) {
    total = total * (1 - BULK_RATE);
  }
  return Math.round(total * 100) / 100;
}
