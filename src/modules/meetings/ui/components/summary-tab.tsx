"use client";

import { Loader2Icon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MeetingGetOne } from "../../types";
import { SummaryContent } from "./summary-content";

interface Props {
  meeting: MeetingGetOne;
}

export const SummaryTab = ({ meeting }: Props) => {
  const isProcessing = meeting.status === "processing";

  if (!meeting.summary && isProcessing) {
    return (
      <div className="bg-white dark:bg-card rounded-xl border p-8 sm:p-12 flex flex-col items-center justify-center gap-y-4 text-center min-h-[360px] max-w-4xl shadow-sm">
        <div className="p-3 bg-primary/10 rounded-full text-primary">
          <Loader2Icon className="size-8 animate-spin" />
        </div>
        <div className="flex flex-col gap-y-1.5 max-w-md">
          <h5 className="text-base font-semibold text-foreground">Summary is being generated...</h5>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The meeting transcript is currently being processed by our AI analyst. The overview and detailed notes will appear here shortly.
          </p>
        </div>
      </div>
    );
  }

  if (!meeting.summary) {
    return (
      <div className="bg-white dark:bg-card rounded-xl border p-8 flex flex-col items-center justify-center min-h-[360px] max-w-4xl shadow-sm">
        <EmptyState
          image="/empty.svg"
          title="Summary is not available yet"
          description="A structured summary will be generated once meeting transcript processing completes."
        />
      </div>
    );
  }

  return <SummaryContent meeting={meeting} />;
};

