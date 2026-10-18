import { Badge } from "@/components/ui/badge";
import {
  SCRIPT_STATUS_LABELS,
  SCRIPT_CATEGORY_LABELS,
  EVENT_STATUS_LABELS,
  ANNOUNCEMENT_PRIORITY_LABELS,
  type ScriptStatus,
  type ScriptCategory,
  type EventStatus,
  type AnnouncementPriority,
} from "@/types/database";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<ScriptStatus, "secondary" | "info" | "warning" | "success"> = {
  draft: "secondary",
  in_progress: "info",
  need_review: "warning",
  ready: "success",
};

export function ScriptStatusBadge({
  status,
  className,
}: {
  status: ScriptStatus;
  className?: string;
}) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={className}>
      {SCRIPT_STATUS_LABELS[status]}
    </Badge>
  );
}

export function ScriptCategoryBadge({
  category,
  className,
}: {
  category: ScriptCategory;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("font-normal", className)}>
      {SCRIPT_CATEGORY_LABELS[category]}
    </Badge>
  );
}

const EVENT_VARIANT: Record<EventStatus, "info" | "warning" | "success" | "destructive"> = {
  upcoming: "info",
  in_progress: "warning",
  completed: "success",
  cancelled: "destructive",
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return <Badge variant={EVENT_VARIANT[status]}>{EVENT_STATUS_LABELS[status]}</Badge>;
}

const PRIORITY_VARIANT: Record<AnnouncementPriority, "secondary" | "warning" | "destructive"> = {
  normal: "secondary",
  important: "warning",
  urgent: "destructive",
};

export function PriorityBadge({ priority }: { priority: AnnouncementPriority }) {
  if (priority === "normal") return null;
  return <Badge variant={PRIORITY_VARIANT[priority]}>{ANNOUNCEMENT_PRIORITY_LABELS[priority]}</Badge>;
}
