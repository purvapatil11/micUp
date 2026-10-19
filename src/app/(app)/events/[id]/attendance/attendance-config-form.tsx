"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateAttendanceConfigAction } from "@/actions/events";

interface Props {
  eventId: string;
  attendanceEnabled: boolean;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusM: number | null;
  checkInOpensAt: string | null;
  checkInClosesAt: string | null;
}

export function AttendanceConfigForm({
  eventId,
  attendanceEnabled: initialEnabled,
  latitude: initialLat,
  longitude: initialLng,
  geofenceRadiusM: initialRadius,
  checkInOpensAt: initialOpens,
  checkInClosesAt: initialCloses,
}: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [latitude, setLatitude] = useState(initialLat != null ? String(initialLat) : "");
  const [longitude, setLongitude] = useState(initialLng != null ? String(initialLng) : "");
  const [radius, setRadius] = useState(initialRadius != null ? String(initialRadius) : "");
  const [opensAt, setOpensAt] = useState(initialOpens ? toLocalInput(initialOpens) : "");
  const [closesAt, setClosesAt] = useState(initialCloses ? toLocalInput(initialCloses) : "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toLocalInput(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function detectLocation() {
    if (!("geolocation" in navigator)) {
      setError("Your browser does not support location access.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude.toFixed(6));
        setLongitude(pos.coords.longitude.toFixed(6));
      },
      () => {
        setError("Could not get your location. Enter coordinates manually.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (enabled) {
      if (!latitude || !longitude || !radius) {
        setError("Latitude, longitude and radius are required when attendance is enabled.");
        return;
      }
    }

    startTransition(async () => {
      const result = await updateAttendanceConfigAction({
        eventId,
        attendanceEnabled: enabled,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        geofenceRadiusM: radius ? parseInt(radius, 10) : null,
        checkInOpensAt: opensAt ? new Date(opensAt).toISOString() : null,
        checkInClosesAt: closesAt ? new Date(closesAt).toISOString() : null,
      });
      if (!result.ok) {
        setError(result.error ?? "Failed to save configuration.");
        return;
      }
      toast.success("Attendance configuration saved");
      window.location.reload();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 rounded-none border-2 border-foreground"
        />
        Enable GPS attendance for this event
      </label>

      {enabled ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lat">Latitude</Label>
              <Input
                id="lat"
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lng">Longitude</Label>
              <Input
                id="lng"
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                required
              />
            </div>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={detectLocation}>
            <MapPin className="h-4 w-4" /> Use my current location
          </Button>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="radius">Radius (metres)</Label>
              <Input
                id="radius"
                type="number"
                min={10}
                max={10000}
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="opensAt">Check-in opens</Label>
              <Input
                id="opensAt"
                type="datetime-local"
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="closesAt">Check-in closes</Label>
              <Input
                id="closesAt"
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
              />
            </div>
          </div>
        </>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {pending ? "Saving…" : "Save configuration"}
        </Button>
      </div>
    </form>
  );
}
