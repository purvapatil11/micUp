"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScriptContent } from "@/components/script/script-content";
import { ScriptStatusBadge, ScriptCategoryBadge } from "@/components/domain-badges";
import { formatDate } from "@/lib/utils";
import type { ScriptStatus, ScriptCategory } from "@/types/database";

export interface ExportableScript {
  id: string;
  title: string;
  content: unknown;
  status: ScriptStatus;
  category: ScriptCategory;
  deadline: string | null;
  updated_at: string;
  event: { name: string; event_date: string } | null;
  creatorName: string | null;
}

export function ScriptExport({ script }: { script: ExportableScript }) {
  const [ready, setReady] = useState(false);
  const printedRef = useRef(false);

  useEffect(() => {
    document.title = `${script.title} · MicUp`;
  }, [script.title]);

  // Auto-open the print dialog (Save as PDF) once the content has rendered.
  useEffect(() => {
    if (!ready || printedRef.current) return;
    printedRef.current = true;
    const t = setTimeout(() => window.print(), 150);
    return () => clearTimeout(t);
  }, [ready]);

  const meta = [
    script.event ? `${script.event.name} · ${formatDate(script.event.event_date)}` : null,
    script.creatorName ? `Created by ${script.creatorName}` : null,
    `Updated ${formatDate(script.updated_at)}`,
    script.deadline ? `Deadline ${formatDate(script.deadline)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link href="/scripts">
            <ArrowLeft className="h-4 w-4" /> Back to scripts
          </Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <FileDown className="h-4 w-4" /> Save as PDF
        </Button>
      </div>

      <article className="script-export-doc rounded-lg border border-border bg-card/60 p-6 sm:p-8 print:border-0 print:p-0">
        <header className="mb-6 border-b border-border pb-4">
          <h1 className="text-2xl font-bold">{script.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 print:hidden">
            <ScriptStatusBadge status={script.status} />
            <ScriptCategoryBadge category={script.category} />
          </div>
          {meta ? (
            <p className="mt-3 text-xs text-muted-foreground">{meta}</p>
          ) : null}
        </header>

        <ScriptContent content={script.content} onReady={() => setReady(true)} />

        {!ready ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground print:hidden">
            <Loader2 className="h-4 w-4 animate-spin" /> Preparing preview…
          </p>
        ) : null}
      </article>
    </div>
  );
}
