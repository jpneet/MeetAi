"use client";

import { SparklesIcon, SendIcon, HelpCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Props {
  meetingName: string;
}

const suggestedPrompts = [
  "What were the primary decisions made in this call?",
  "List all action items and responsible assignees",
  "Summarize key challenges or unresolved questions",
  "What was the main outcome of the discussion?",
];

export const AskAiTab = ({ meetingName }: Props) => {
  return (
    <div className="bg-white dark:bg-card rounded-xl border p-6 sm:p-8 shadow-sm flex flex-col gap-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 pb-4 border-b">
        <div className="flex items-center gap-x-3">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary shrink-0">
            <SparklesIcon className="size-5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-x-2">
              <h3 className="text-base sm:text-lg font-semibold text-foreground">
                Ask AI about this meeting
              </h3>
              <Badge variant="secondary" className="text-[11px] font-medium py-0">
                Preview
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Instant AI answers grounded directly in the transcript of &ldquo;{meetingName}&rdquo;.
            </p>
          </div>
        </div>
      </div>

      {/* Suggested prompts */}
      <div className="flex flex-col gap-y-2.5">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Suggested Questions
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {suggestedPrompts.map((prompt, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg border bg-muted/40 text-xs sm:text-sm text-foreground/80 flex items-start gap-2 select-none"
            >
              <HelpCircleIcon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
              <span>{prompt}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Mock Chat Input & Implementation Status Notice */}
      <div className="flex flex-col gap-y-3 pt-2">
        <div className="relative flex items-center">
          <Input
            disabled
            placeholder="Ask a question about this meeting... (Backend in development)"
            className="pr-12 bg-muted/30 cursor-not-allowed"
          />
          <Button
            size="icon"
            variant="ghost"
            disabled
            className="absolute right-1 size-8 text-muted-foreground"
          >
            <SendIcon className="size-4" />
          </Button>
        </div>

        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-900 dark:text-blue-200 flex items-center justify-between gap-2">
          <span>
            Meeting AI chat backend integration is currently in progress. The AI-generated overview, structured notes, and full transcript are available in the <strong>Summary</strong> and <strong>Transcript</strong> tabs.
          </span>
        </div>
      </div>
    </div>
  );
};
