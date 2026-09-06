"use client";

import { format } from "date-fns";
import { SparklesIcon, TimerIcon } from "lucide-react";
import React from "react";

import { GeneratedAvatar } from "@/components/generated-avatar";
import { MeetingGetOne } from "../../types";

interface Props {
  meeting: MeetingGetOne;
}

interface SummarySection {
  title: string;
  items?: string[];
  paragraph?: string;
}

interface ParsedSummary {
  overview: string;
  notesSections: SummarySection[];
}

function parseMeetingSummary(rawSummary: string): ParsedSummary {
  const trimmed = rawSummary.trim();
  if (!trimmed) {
    return { overview: "", notesSections: [] };
  }

  // Split by markdown h2/h3 headings (e.g. ## Summary, ## Key Topics, ### Notes)
  const rawSections = trimmed
    .split(/(?=^#{1,3}\s+)/m)
    .map((s) => s.trim())
    .filter(Boolean);

  let overview = "";
  const notesSections: SummarySection[] = [];

  for (const sec of rawSections) {
    const lines = sec.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    const headerMatch = lines[0].match(/^#{1,3}\s+(.+)$/);
    const title = headerMatch ? headerMatch[1].trim() : "Notes";
    const bodyLines = headerMatch ? lines.slice(1) : lines;

    const lowerTitle = title.toLowerCase();

    // Check if this is the "Overview" or "Summary" section
    if ((lowerTitle === "summary" || lowerTitle === "overview" || lowerTitle === "general summary") && !overview) {
      overview = bodyLines
        .map((l) => l.replace(/^[-*•]\s+/, ""))
        .join(" ")
        .trim();
      continue;
    }

    const items: string[] = [];
    const paragraphs: string[] = [];

    for (const line of bodyLines) {
      if (/^[-*•]\s+/.test(line)) {
        items.push(line.replace(/^[-*•]\s+/, "").trim());
      } else if (/^\d+\.\s+/.test(line)) {
        items.push(line.replace(/^\d+\.\s+/, "").trim());
      } else {
        paragraphs.push(line);
      }
    }

    // Filter out filler sections like "None mentioned."
    const isNoneMentioned =
      (paragraphs.length === 1 && /^none(?:\s+mentioned)?\.?$/i.test(paragraphs[0])) ||
      (items.length === 1 && /^none(?:\s+mentioned)?\.?$/i.test(items[0]));

    if (!isNoneMentioned) {
      notesSections.push({
        title,
        items: items.length > 0 ? items : undefined,
        paragraph: paragraphs.length > 0 ? paragraphs.join(" ") : undefined,
      });
    }
  }

  // Fallback if no ## Summary heading was found
  if (!overview) {
    if (notesSections.length > 0 && notesSections[0].paragraph) {
      overview = notesSections[0].paragraph;
      notesSections.shift();
    } else {
      overview = trimmed;
    }
  }

  return { overview, notesSections };
}

function formatMeetingDuration(
  durationSec?: number | null,
  startedAt?: Date | string | null,
  endedAt?: Date | string | null
): string | null {
  let seconds = durationSec;
  if ((seconds === undefined || seconds === null || seconds <= 0) && startedAt && endedAt) {
    const diff = Math.floor((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000);
    if (diff > 0) seconds = diff;
  }

  if (seconds === undefined || seconds === null || isNaN(seconds) || seconds <= 0) {
    return null;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSecs = seconds % 60;

  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  }
  if (hours === 0 && (remainingSecs > 0 || parts.length === 0)) {
    parts.push(`${remainingSecs} ${remainingSecs === 1 ? "second" : "seconds"}`);
  }

  return parts.join(" ");
}

function renderFormattedText(text: string): React.ReactNode {
  // Strip any remaining markdown bold (**text**) and render as strong
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

export const SummaryContent = ({ meeting }: Props) => {
  const { overview, notesSections } = parseMeetingSummary(meeting.summary || "");

  const dateValue = meeting.startedAt || meeting.createdAt;
  const formattedDate = dateValue ? format(new Date(dateValue), "MMMM do, yyyy") : null;

  const durationStr = formatMeetingDuration(
    meeting.duration,
    meeting.startedAt,
    meeting.endedAt
  );

  return (
    <div className="bg-white dark:bg-card rounded-xl border p-6 sm:p-8 md:p-10 shadow-sm flex flex-col gap-y-8 max-w-4xl">
      {/* 1. Meeting Title & Metadata */}
      <div className="flex flex-col gap-y-3">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {meeting.name}
        </h1>

        <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
          {/* Agent info */}
          <div className="flex items-center gap-x-2.5">
            <GeneratedAvatar
              variant="botttsNeutral"
              seed={meeting.agent.name}
              className="size-7 rounded-full shrink-0 border"
            />
            <span className="font-medium text-foreground">{meeting.agent.name}</span>
          </div>

          {formattedDate && (
            <>
              <span className="text-muted-foreground/50 select-none">•</span>
              <span className="text-muted-foreground">{formattedDate}</span>
            </>
          )}
        </div>
      </div>

      {/* 2. General Summary Pill Badge & Duration */}
      <div className="flex items-center flex-wrap gap-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
          <SparklesIcon className="size-3.5" />
          <span>General summary</span>
        </div>

        {durationStr && (
          <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-muted-foreground px-2 py-0.5">
            <TimerIcon className="size-3.5 text-muted-foreground" />
            <span>{durationStr}</span>
          </div>
        )}
      </div>

      {/* 3. Overview Section */}
      {overview && (
        <div className="flex flex-col gap-y-3">
          <h2 className="text-lg font-bold text-foreground">Overview</h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {renderFormattedText(overview)}
          </p>
        </div>
      )}

      {/* 4. Notes Section */}
      {notesSections.length > 0 && (
        <div className="flex flex-col gap-y-6 pt-2 border-t border-border/50">
          <h2 className="text-lg font-bold text-foreground">Notes</h2>

          <div className="flex flex-col gap-y-6">
            {notesSections.map((sec, idx) => (
              <div key={idx} className="flex flex-col gap-y-2.5">
                <h3 className="text-sm sm:text-base font-semibold text-foreground">
                  {sec.title}
                </h3>

                {sec.paragraph && (
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    {renderFormattedText(sec.paragraph)}
                  </p>
                )}

                {sec.items && sec.items.length > 0 && (
                  <ul className="space-y-2">
                    {sec.items.map((item, itemIdx) => (
                      <li
                        key={itemIdx}
                        className="flex items-start gap-2.5 text-sm sm:text-base text-muted-foreground leading-relaxed"
                      >
                        <span className="text-foreground/80 font-bold select-none mt-0.5">
                          •
                        </span>
                        <span className="flex-1">{renderFormattedText(item)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
