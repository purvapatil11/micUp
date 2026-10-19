import { describe, it, expect } from "vitest";
import {
  haversineDistanceM,
  evaluateGeofence,
  isWithinCheckInWindow,
  isValidCoordinates,
} from "@/lib/geo";

describe("haversineDistanceM", () => {
  it("returns 0 for identical coordinates", () => {
    expect(haversineDistanceM(28.6139, 77.209, 28.6139, 77.209)).toBe(0);
  });

  it("computes a known distance (~1 degree of latitude ≈ 111 km)", () => {
    const d = haversineDistanceM(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it("computes a known short distance accurately", () => {
    // ~1.11 km between two nearby points
    const d = haversineDistanceM(12.9716, 77.5946, 12.9816, 77.5946);
    expect(d).toBeGreaterThan(1_000);
    expect(d).toBeLessThan(1_200);
  });

  it("is symmetric", () => {
    const d1 = haversineDistanceM(28.6, 77.2, 19.07, 72.87);
    const d2 = haversineDistanceM(19.07, 72.87, 28.6, 77.2);
    expect(Math.abs(d1 - d2)).toBeLessThan(1);
  });
});

describe("evaluateGeofence", () => {
  const venue = { latitude: 28.6139, longitude: 77.209, radiusM: 100 };

  it("accepts a point inside the radius", () => {
    const result = evaluateGeofence(venue, { latitude: 28.614, longitude: 77.2091 });
    expect(result.withinRadius).toBe(true);
    expect(result.distanceM).toBeLessThanOrEqual(100);
  });

  it("accepts a point exactly at the venue", () => {
    const result = evaluateGeofence(venue, { latitude: 28.6139, longitude: 77.209 });
    expect(result.withinRadius).toBe(true);
    expect(result.distanceM).toBe(0);
  });

  it("rejects a point outside the radius", () => {
    // ~1 km away
    const result = evaluateGeofence(venue, { latitude: 28.6239, longitude: 77.209 });
    expect(result.withinRadius).toBe(false);
    expect(result.distanceM).toBeGreaterThan(100);
  });

  it("rejects a point on the far side of the earth", () => {
    const result = evaluateGeofence(venue, { latitude: -28.6139, longitude: -77.209 });
    expect(result.withinRadius).toBe(false);
    expect(result.distanceM).toBeGreaterThan(1_000_000);
  });

  it("returns radiusM from the venue config", () => {
    const result = evaluateGeofence(venue, { latitude: 28.614, longitude: 77.2091 });
    expect(result.radiusM).toBe(100);
  });
});

describe("isWithinCheckInWindow", () => {
  const now = new Date("2026-01-15T10:00:00Z");

  it("accepts when no window is configured", () => {
    expect(isWithinCheckInWindow({ opensAt: null, closesAt: null }, now)).toBe(true);
  });

  it("accepts within an open window", () => {
    const window = {
      opensAt: new Date("2026-01-15T09:00:00Z"),
      closesAt: new Date("2026-01-15T11:00:00Z"),
    };
    expect(isWithinCheckInWindow(window, now)).toBe(true);
  });

  it("rejects before the window opens", () => {
    const window = {
      opensAt: new Date("2026-01-15T10:30:00Z"),
      closesAt: null,
    };
    expect(isWithinCheckInWindow(window, now)).toBe(false);
  });

  it("rejects after the window closes", () => {
    const window = {
      opensAt: null,
      closesAt: new Date("2026-01-15T09:30:00Z"),
    };
    expect(isWithinCheckInWindow(window, now)).toBe(false);
  });

  it("accepts exactly at the open boundary", () => {
    const window = {
      opensAt: now,
      closesAt: new Date("2026-01-15T11:00:00Z"),
    };
    expect(isWithinCheckInWindow(window, now)).toBe(true);
  });

  it("accepts exactly at the close boundary", () => {
    const window = {
      opensAt: new Date("2026-01-15T09:00:00Z"),
      closesAt: now,
    };
    expect(isWithinCheckInWindow(window, now)).toBe(true);
  });
});

describe("isValidCoordinates", () => {
  it("accepts valid coordinates", () => {
    expect(isValidCoordinates(0, 0)).toBe(true);
    expect(isValidCoordinates(28.6139, 77.209)).toBe(true);
    expect(isValidCoordinates(-90, -180)).toBe(true);
    expect(isValidCoordinates(90, 180)).toBe(true);
  });

  it("rejects out-of-range coordinates", () => {
    expect(isValidCoordinates(91, 0)).toBe(false);
    expect(isValidCoordinates(-91, 0)).toBe(false);
    expect(isValidCoordinates(0, 181)).toBe(false);
    expect(isValidCoordinates(0, -181)).toBe(false);
  });

  it("rejects non-finite values", () => {
    expect(isValidCoordinates(NaN, 0)).toBe(false);
    expect(isValidCoordinates(0, Infinity)).toBe(false);
    expect(isValidCoordinates(-Infinity, 0)).toBe(false);
  });
});
