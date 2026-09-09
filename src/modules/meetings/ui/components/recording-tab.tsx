"use client";

import { useState } from "react";
import { Download, Loader2, VideoIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

interface Props {
  recordingUrl?: string | null;
  meetingId?: string;
}

export const RecordingTab = ({ recordingUrl, meetingId }: Props) => {
  const [isDownloading, setIsDownloading] = useState(false);

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

  const handleDownload = async () => {
    if (!meetingId) {
      toast.error("Meeting identifier is missing");
      return;
    }

    setIsDownloading(true);
    try {
      const response = await fetch(`/api/meetings/${meetingId}/recording/download`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `Download failed (${response.status})`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `meet-ai-recording-${meetingId}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success("Recording downloaded successfully");
    } catch (error) {
      console.error("Recording download error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to download recording";
      toast.error(errorMessage);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-card rounded-xl border p-6 sm:p-8 shadow-sm flex flex-col gap-y-4 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-x-3">
          <div className="p-2.5 bg-primary/10 rounded-xl text-primary shrink-0">
            <VideoIcon className="size-5" />
          </div>
          <div className="flex flex-col">
            <h4 className="text-base sm:text-lg font-semibold text-foreground">
              Meeting Recording
            </h4>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Watch the recorded video and audio of this session
            </p>
          </div>
        </div>

        <Button
          id="download-recording-button"
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={isDownloading}
          className="shrink-0 gap-x-2 font-medium"
        >
          {isDownloading ? (
            <>
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
              <span>Downloading...</span>
            </>
          ) : (
            <>
              <Download className="size-4" />
              <span>Download Recording</span>
            </>
          )}
        </Button>
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
