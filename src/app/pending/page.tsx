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

export const metadata = { title: "Access pending" };

export default async function PendingPage() {
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

  if (profile?.status === "active") redirect("/dashboard");
  if (profile?.status === "suspended") redirect("/suspended");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <MicUpLogo size={44} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Access pending</CardTitle>
            <CardDescription>
              Your account exists but hasn&apos;t been approved yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              An Anchoring Officer needs to approve your profile before you can use
              MicUp. Once approved, sign in again to reach your dashboard.
            </p>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" className="w-full">
                Sign out
              </Button>
            </form>
            <p className="text-center text-xs">
              <Link href="/login" className="text-muted-foreground hover:text-foreground">
                Back to sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
