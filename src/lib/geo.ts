/**
 * Geofence math for event-day attendance.
 * Pure functions — unit tested in tests/geo.test.ts and reused by the
 * Postgres fn_check_in function (which uses the same Haversine formula).
 */

const EARTH_RADIUS_M = 6_371_000;

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two coordinates, in metres. */
export function haversineDistanceM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

export interface GeofenceCheck {
  withinRadius: boolean;
  distanceM: number;
  radiusM: number;
}

/**
 * Decide whether submitted coordinates fall inside the event's geofence.
 * The caller (server action / database function) is responsible for pulling
 * the trusted venue coordinates and radius from the database — never from
 * the client.
 */
export function evaluateGeofence(
  venue: { latitude: number; longitude: number; radiusM: number },
  point: { latitude: number; longitude: number }
): GeofenceCheck {
  const distanceM = haversineDistanceM(
    venue.latitude,
    venue.longitude,
    point.latitude,
    point.longitude
  );
  return {
    withinRadius: distanceM <= venue.radiusM,
    distanceM,
    radiusM: venue.radiusM,
  };
}

export interface CheckInWindow {
  opensAt: Date | null;
  closesAt: Date | null;
}

/** Validates the configured check-in window at `now`. */
export function isWithinCheckInWindow(window: CheckInWindow, now: Date): boolean {
  if (window.opensAt && now < window.opensAt) return false;
  if (window.closesAt && now > window.closesAt) return false;
  return true;
}

/** Basic coordinate sanity check before touching the database. */
export function isValidCoordinates(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}
