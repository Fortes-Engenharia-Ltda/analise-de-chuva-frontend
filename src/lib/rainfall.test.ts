import { describe, expect, it } from "vitest";
import { aggregate, DEFAULT_WEIGHTS, type ImpactPerMonth } from "@/lib/rainfall";

const baseMonthly: ImpactPerMonth[] = Array.from({ length: 12 }, (_, index) => ({
  month: index + 1,
  monthLabel: "",
  none: 0,
  low: 1,
  moderate: 2,
  high: 3,
  severe: 4,
  rainy: 10,
  total: 10,
}));

describe("aggregate", () => {
  it("applies the selected severe share only to earthworks unproductivity", () => {
    const fullSevere = aggregate(baseMonthly, DEFAULT_WEIGHTS, {
      earthworksSevereShare: 1,
    });
    const halfSevere = aggregate(baseMonthly, DEFAULT_WEIGHTS, {
      earthworksSevereShare: 0.5,
    });

    expect(halfSevere.unprodCovered).toBe(fullSevere.unprodCovered);
    expect(halfSevere.unprodOutsideIndustrial).toBe(fullSevere.unprodOutsideIndustrial);
    expect(halfSevere.unprodCommonIndustrial).toBe(fullSevere.unprodCommonIndustrial);
    expect(halfSevere.unprodEarthworks).toBeLessThan(fullSevere.unprodEarthworks);
  });
});
