"use client";

import { useState, useTransition, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, MapPin, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { checkInAction } from "@/actions/attendance";

interface GeolocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export function CheckInButton({
  eventId,
  alreadyCheckedIn,
}: {
  eventId: string;
  alreadyCheckedIn: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<
    { ok: boolean; message: string; distanceM?: number; radiusM?: number } | null
  >(null);

  const handleCheckIn = useCallback(() => {
    setResult(null);

    if (!("geolocation" in navigator)) {
      setResult({
        ok: false,
        message: "Your browser does not support location access.",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords: GeolocationResult = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };

        startTransition(async () => {
          const res = await checkInAction({
            eventId,
            latitude: coords.latitude,
            longitude: coords.longitude,
          });
          if (res.ok) {
            setResult({
              ok: true,
              message: "Checked in successfully.",
              distanceM: res.distanceM,
              radiusM: res.radiusM,
            });
            toast.success("Checked in");
          } else {
            setResult({ ok: false, message: res.error ?? "Check-in failed." });
          }
        });
      },
      (err) => {
        let msg = "Could not get your location.";
        if (err.code === err.PERMISSION_DENIED) {
          msg =
            "Location permission was denied. Allow location access in your browser and try again, or ask an officer for a manual check-in.";
        } else if (err.code === err.TIMEOUT) {
          msg = "Location request timed out. Please try again.";
        }
        setResult({ ok: false, message: msg });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }, [eventId]);

  if (alreadyCheckedIn) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
        <CheckCircle2 className="h-4 w-4" />
        You have already checked in for this event.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button onClick={handleCheckIn} disabled={pending} className="w-full sm:w-auto">
        {pending ? <Loader2 className="animate-spin" /> : <MapPin className="h-4 w-4" />}
        {pending ? "Checking location…" : "Check in with GPS"}
      </Button>

      <p className="text-xs text-muted-foreground">
        MicUp will ask for your device location to confirm you are at the venue.
        Location is validated server-side against the event&apos;s geofence radius.
        GPS can be inaccurate or spoofed — officers can correct attendance manually.
      </p>

      {result ? (
        <div
          className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
            result.ok
              ? "border-success/30 bg-success/10 text-success"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {result.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div>
            <p>{result.message}</p>
            {result.ok && result.distanceM != null ? (
              <p className="mt-1 text-xs opacity-80">
                Distance from venue: ~{Math.round(result.distanceM)}m (allowed: {result.radiusM}m)
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
