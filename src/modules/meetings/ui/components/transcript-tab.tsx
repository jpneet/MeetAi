"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { MessageSquareTextIcon, ClockIcon } from "lucide-react";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { GeneratedAvatar } from "@/components/generated-avatar";

interface Props {
  meetingId: string;
  agentName?: string;
}

function formatSeconds(secs?: number): string | null {
  if (secs === undefined || isNaN(secs)) return null;
  const total = Math.floor(secs);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const remM = m % 60;
    return `${h}:${remM.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function sanitizeSpeakerDisplayName(speaker: string, agentName?: string): string {
  if (!speaker) return "Speaker";

  // If speaker matches the agent
  if (agentName && speaker.toLowerCase() === agentName.toLowerCase()) {
    return agentName;
  }

  // If speaker is a raw stream ID (long alphanumeric string with no spaces)
  if (/^[a-zA-Z0-9_-]{16,}$/.test(speaker.trim())) {
    return "Participant";
  }

  return speaker;
}

export const TranscriptTab = ({ meetingId, agentName }: Props) => {
  const trpc = useTRPC();

  const { data, isLoading, isError, error, refetch } = useQuery(
    trpc.meetings.getTranscript.queryOptions({
      meetingId,
    })
  );

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-card rounded-xl border p-8 sm:p-12 flex items-center justify-center min-h-[360px] max-w-4xl shadow-sm">
        <LoadingState
          title="Loading transcript..."
          description="Fetching meeting transcript records"
        />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-white dark:bg-card rounded-xl border p-8 sm:p-12 flex flex-col items-center justify-center min-h-[360px] max-w-4xl shadow-sm gap-y-4">
        <ErrorState
          title="Error Loading Transcript"
          description={error?.message || "Could not retrieve transcript data"}
        />
        <button
          onClick={() => refetch()}
          className="text-xs text-primary underline font-medium hover:text-primary/80"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data?.items || data.items.length === 0) {
    return (
      <div className="bg-white dark:bg-card rounded-xl border p-8 sm:p-12 flex flex-col items-center justify-center min-h-[360px] max-w-4xl shadow-sm">
        <EmptyState
          image="/empty.svg"
          title="Transcript is not available yet"
          description="Transcripts will be available once the meeting recording is processed by Stream."
        />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-card rounded-xl border p-6 sm:p-8 shadow-sm flex flex-col gap-y-5 max-w-4xl">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-x-3">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary shrink-0">
            <MessageSquareTextIcon className="size-5" />
          </div>
          <div className="flex flex-col">
            <h4 className="text-base sm:text-lg font-semibold text-foreground">Meeting Transcript</h4>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {data.items.length} {data.items.length === 1 ? "utterance" : "utterances"} recorded
            </p>
          </div>
        </div>
      </div>

      <div className="max-h-[640px] overflow-y-auto pr-2 flex flex-col gap-y-4 divide-y divide-border/60">
        {data.items.map((item, idx) => {
          const timestamp = formatSeconds(item.startTime);
          const displayName = sanitizeSpeakerDisplayName(item.speaker, agentName);
          const isAgent = agentName && displayName.toLowerCase() === agentName.toLowerCase();

          return (
            <div key={idx} className="pt-4 first:pt-0 flex items-start gap-x-3.5">
              <GeneratedAvatar
                variant={isAgent ? "botttsNeutral" : "initials"}
                seed={displayName}
                className="size-8 mt-0.5 shrink-0 rounded-full border"
              />
              <div className="flex-1 flex flex-col gap-y-1 min-w-0">
                <div className="flex items-center gap-x-2">
                  <span className="text-sm font-semibold text-foreground capitalize">
                    {displayName}
                  </span>
                  {timestamp && (
                    <span className="text-xs text-muted-foreground flex items-center gap-x-1 font-mono">
                      <ClockIcon className="size-3" />
                      {timestamp}
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground/85 leading-relaxed break-words">
                  {item.text}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

