import { requireUser } from "@/lib/auth";
import { Sidebar, MobileNav } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <div className="lg:pl-56">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b-[3px] border-foreground bg-[hsl(var(--background))] px-4 print:hidden">
          <div className="flex items-center gap-3 lg:hidden">
            <span className="text-sm font-semibold">MicUp</span>
          </div>
          <div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-none bg-success" aria-hidden />
              Private workspace
            </span>
          </div>
          <UserMenu profile={user.profile} />
        </header>
        <div className="print:hidden">
          <MobileNav />
        </div>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 print:max-w-none print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
