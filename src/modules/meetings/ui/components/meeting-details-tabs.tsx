"use client";

import { LoaderIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SummaryTab } from "./summary-tab";
import { TranscriptTab } from "./transcript-tab";
import { RecordingTab } from "./recording-tab";
import { AskAiTab } from "./ask-ai-tab";
import { MeetingGetOne } from "../../types";

interface Props {
  meeting: MeetingGetOne;
}

export const MeetingDetailsTabs = ({ meeting }: Props) => {
  const isProcessing = meeting.status === "processing";

  return (
    <div className="flex flex-col gap-y-6 w-full max-w-5xl">
      {/* Processing Notice if meeting is currently being summarized */}
      {isProcessing && (
        <div className="flex items-center gap-x-2.5 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-900 dark:text-blue-200">
          <LoaderIcon className="size-4 animate-spin text-primary shrink-0" />
          <span>
            Meeting audio and transcript are being processed by AI. Summary will refresh automatically once completed.
          </span>
          <Badge variant="outline" className="ml-auto text-[10px] uppercase font-semibold">
            Processing
          </Badge>
        </div>
      )}

      {/* Horizontal Tabs Bar */}
      <Tabs defaultValue="summary" className="w-full">
        <TabsList
          variant="line"
          className="border-b w-full justify-start rounded-none h-auto p-0 gap-x-6 sm:gap-x-8 bg-transparent overflow-x-auto scrollbar-none"
        >
          <TabsTrigger
            value="summary"
            className="rounded-none border-b-2 border-transparent px-1 pb-3 pt-2 font-medium text-sm text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent shadow-none"
          >
            Summary
          </TabsTrigger>
          <TabsTrigger
            value="transcript"
            className="rounded-none border-b-2 border-transparent px-1 pb-3 pt-2 font-medium text-sm text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent shadow-none"
          >
            Transcript
          </TabsTrigger>
          <TabsTrigger
            value="recording"
            className="rounded-none border-b-2 border-transparent px-1 pb-3 pt-2 font-medium text-sm text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent shadow-none"
          >
            Recording
          </TabsTrigger>
          <TabsTrigger
            value="ask-ai"
            className="rounded-none border-b-2 border-transparent px-1 pb-3 pt-2 font-medium text-sm text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent shadow-none"
          >
            Ask AI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-6">
          <SummaryTab meeting={meeting} />
        </TabsContent>

        <TabsContent value="transcript" className="mt-6">
          <TranscriptTab meetingId={meeting.id} agentName={meeting.agent.name} />
        </TabsContent>

        <TabsContent value="recording" className="mt-6">
          <RecordingTab recordingUrl={meeting.recordingUrl} />
        </TabsContent>

        <TabsContent value="ask-ai" className="mt-6">
          <AskAiTab meetingName={meeting.name} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

