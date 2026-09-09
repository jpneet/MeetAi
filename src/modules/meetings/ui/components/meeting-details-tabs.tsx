"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TranscriptTab } from "./transcript-tab";
import { RecordingTab } from "./recording-tab";
import { AskAiTab } from "./ask-ai-tab";
import { MeetingGetOne } from "../../types";

interface Props {
  meeting: MeetingGetOne;
}

export const MeetingDetailsTabs = ({ meeting }: Props) => {
  return (
    <div className="flex flex-col gap-y-6 w-full max-w-5xl">
      {/* Horizontal Tabs Bar */}
      <Tabs defaultValue="transcript" className="w-full">
        <TabsList
          variant="line"
          className="border-b w-full justify-start rounded-none h-auto p-0 gap-x-6 sm:gap-x-8 bg-transparent overflow-x-auto scrollbar-none"
        >
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
