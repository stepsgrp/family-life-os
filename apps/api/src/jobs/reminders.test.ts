import { describe, expect, it } from "vitest";
import { isEntitled } from "../lib/billing";
import { upcomingWeekend } from "../ai/weekend";
import { localTime } from "./reminders";
import { guessCategory, normalizeIngredient } from "../lib/grocery-categories";

describe("localTime", () => {
  it("formats in the family's timezone", () => {
    const t = new Date("2026-01-15T13:05:00Z");
    expect(localTime(t, "America/New_York")).toBe("08:05");
    expect(localTime(t, "Asia/Kolkata")).toBe("18:35");
  });
});

describe("isEntitled", () => {
  const base = {
    id: "s",
    familyId: "f",
    source: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    updatedAt: new Date(),
  };
  const now = new Date("2026-06-01T00:00:00Z");
  it("free tier is not entitled", () => {
    expect(isEntitled({ ...base, tier: "FREE", status: "ACTIVE", currentPeriodEnd: null }, now)).toBe(false);
  });
  it("canceled keeps access until period end", () => {
    const end = new Date("2026-06-10T00:00:00Z");
    expect(isEntitled({ ...base, tier: "FAMILY", status: "CANCELED", currentPeriodEnd: end }, now)).toBe(true);
    expect(isEntitled({ ...base, tier: "FAMILY", status: "CANCELED", currentPeriodEnd: end }, new Date("2026-06-11"))).toBe(false);
  });
  it("past due gets a 3-day grace period", () => {
    const end = new Date("2026-05-30T00:00:00Z");
    expect(isEntitled({ ...base, tier: "FAMILY", status: "PAST_DUE", currentPeriodEnd: end }, now)).toBe(true);
  });
});

describe("upcomingWeekend", () => {
  it("returns next Saturday from a Wednesday", () => {
    expect(upcomingWeekend(new Date("2026-09-23T12:00:00Z"))).toEqual({ saturday: "2026-09-26", sunday: "2026-09-27" });
  });
  it("returns the current weekend on Sunday", () => {
    expect(upcomingWeekend(new Date("2026-09-27T12:00:00Z"))).toEqual({ saturday: "2026-09-26", sunday: "2026-09-27" });
  });
});

describe("grocery helpers", () => {
  it("categorizes and normalizes", () => {
    expect(guessCategory("Whole milk")).toBe("dairy");
    expect(normalizeIngredient("Tomatoes")).toBe(normalizeIngredient("tomato"));
  });
});
