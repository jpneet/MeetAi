"use client";

import { VideoIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

interface Props {
  recordingUrl?: string | null;
}

export const RecordingTab = ({ recordingUrl }: Props) => {
  if (!recordingUrl) {
    return (
      <div className="bg-white dark:bg-card rounded-xl border p-8 sm:p-12 flex flex-col items-center justify-center min-h-[360px] max-w-4xl shadow-sm">
        <EmptyState
          image="/empty.svg"
          title="Recording is not available yet"
          description="The meeting recording will appear here once it has been processed and saved by Stream."
        />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-card rounded-xl border p-6 sm:p-8 shadow-sm flex flex-col gap-y-4 max-w-4xl">
      <div className="flex items-center gap-x-3 border-b pb-4">
        <div className="p-2.5 bg-primary/10 rounded-xl text-primary shrink-0">
          <VideoIcon className="size-5" />
        </div>
        <div className="flex flex-col">
          <h4 className="text-base sm:text-lg font-semibold text-foreground">Meeting Recording</h4>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Watch the recorded video and audio of this session
          </p>
        </div>
      </div>

      <div className="w-full aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center shadow-md">
        <video
          src={recordingUrl}
          controls
          controlsList="nodownload"
          className="w-full h-full object-contain"
          preload="metadata"
        >
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  );
};

