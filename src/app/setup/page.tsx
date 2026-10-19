import { AlertTriangle } from "lucide-react";
import { MicUpLogo } from "@/components/logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Setup required" };

export default function SetupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <MicUpLogo size={56} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Configuration needed
            </CardTitle>
            <CardDescription>
              MicUp cannot start until the Supabase environment variables are set.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Copy <code className="rounded-none bg-secondary px-1.5 py-0.5">.env.example</code> to{" "}
              <code className="rounded-none bg-secondary px-1.5 py-0.5">.env.local</code> and fill in
              your Supabase project values, then restart the dev server.
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <code>NEXT_PUBLIC_SUPABASE_URL</code> — your project URL
              </li>
              <li>
                <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> — the anon/public key
              </li>
              <li>
                <code>SUPABASE_SERVICE_ROLE_KEY</code> — server-only, for invites and
                administrative corrections
              </li>
            </ul>
            <p>
              See the README for full setup instructions, including running the SQL
              migrations against your Supabase project.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
