"use client";

import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportCsvButton({
  filename,
  rows,
}: {
  filename: string;
  rows: string[][];
}) {
  function exportCsv() {
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" onClick={exportCsv}>
      <FileDown className="h-4 w-4" /> Export CSV
    </Button>
  );
}
