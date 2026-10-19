import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MicUpLogo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { logoutAction } from "@/actions/auth";

export const metadata = { title: "Account suspended" };

export default async function SuspendedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.status === "active") redirect("/dashboard");
  if (profile.status === "pending") redirect("/pending");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <MicUpLogo size={44} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Account suspended</CardTitle>
            <CardDescription>
              Your access to MicUp has been paused.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Contact an Anchoring Officer if you believe this is a mistake.
            </p>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" className="w-full">
                Sign out
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
