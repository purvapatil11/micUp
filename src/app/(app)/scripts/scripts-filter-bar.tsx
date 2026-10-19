"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SCRIPT_STATUSES,
  SCRIPT_STATUS_LABELS,
  SCRIPT_CATEGORIES,
  SCRIPT_CATEGORY_LABELS,
} from "@/types/database";

export function ScriptsFilterBar({
  q,
  status,
  category,
}: {
  q: string;
  status: string;
  category: string;
}) {
  const router = useRouter();

  function updateParam(key: "status" | "category", value: string) {
    const url = new URL(window.location.href);
    if (value === "all") url.searchParams.delete(key);
    else url.searchParams.set(key, value);
    router.push(url.toString());
  }

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
      <form className="flex-1" method="GET">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search by title…"
            className="pl-9"
          />
        </div>
        <input type="hidden" name="status" value={status === "all" ? "" : status} />
        <input type="hidden" name="category" value={category === "all" ? "" : category} />
      </form>
      <div className="flex gap-2">
        <Select value={status} onValueChange={(v) => updateParam("status", v)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {SCRIPT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {SCRIPT_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={(v) => updateParam("category", v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {SCRIPT_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {SCRIPT_CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
