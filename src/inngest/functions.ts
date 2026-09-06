import { inngest } from "./client";
import { parseTranscript } from "./transcript-parser";
import { db } from "@/db";
import { agents, meetings, user } from "@/db/schema";
import { eq } from "drizzle-orm";
import OpenAI from "openai";

const getOpenAIClient = () =>
  new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

const SYSTEM_PROMPT = `You are a professional meeting analyst.

Analyze the provided meeting transcript and create an accurate, concise summary.

Only use information explicitly supported by the transcript. Never invent decisions, action items, names, deadlines, or facts.

Return the result with these sections:

## Summary
A concise overview of the meeting.

## Key Topics
The main subjects discussed.

## Decisions
Important decisions that were actually made.

## Action Items
List each actionable task and, when clearly stated, identify the responsible person and deadline.

## Unresolved Questions
Questions, blockers, or issues that remain unresolved.

## Important Details
Important dates, numbers, requirements, or other details that should not be forgotten.

If a section has no relevant information, write "None mentioned."

Make the result easy to read and useful for someone who did not attend the meeting.`;

export const processMeetingTranscript = inngest.createFunction(
  {
    id: "process-meeting-transcript",
    name: "Process Meeting Transcript",
    retries: 3,
    triggers: [{ event: "meetings/processing" }],
  },
  async ({ event, step }) => {
    const { meetingId, transcriptUrl } = (event.data || {}) as {
      meetingId?: string;
      transcriptUrl?: string;
    };

    if (!meetingId) {
      throw new Error("Missing meetingId in event data");
    }

    if (!transcriptUrl) {
      throw new Error("Missing transcriptUrl in event data");
    }

    console.log(`[Meeting Lifecycle] Inngest processing started for meeting: ${meetingId}`);

    // 1. Find meeting, associated agent, and user in the database
    const meetingData = await step.run("fetch-meeting-and-agent", async () => {
      const [existingMeeting] = await db
        .select()
        .from(meetings)
        .where(eq(meetings.id, meetingId));

      if (!existingMeeting) {
        throw new Error(`Meeting not found in database: ${meetingId}`);
      }

      // If already completed, do not re-process
      if (existingMeeting.status === "completed") {
        console.log(`[Meeting Lifecycle] Meeting ${meetingId} is already marked completed. Skipping.`);
        return {
          meeting: existingMeeting,
          agent: null,
          meetingUser: null,
          alreadyCompleted: true,
        };
      }

      const [existingAgent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, existingMeeting.agentId));

      const [existingUser] = await db
        .select()
        .from(user)
        .where(eq(user.id, existingMeeting.userId));

      return {
        meeting: existingMeeting,
        agent: existingAgent || null,
        meetingUser: existingUser || null,
        alreadyCompleted: false,
      };
    });

    if (meetingData.alreadyCompleted) {
      return {
        meetingId,
        status: "completed",
      };
    }

    const { meeting, agent, meetingUser } = meetingData;

    // Safety guard: If meeting is still active (e.g. event triggered prematurely before session_ended),
    // wait for call session to end so meeting is not marked completed while call is still running.
    if (meeting.status === "active") {
      console.log(`[Meeting Lifecycle] Meeting ${meetingId} is still active. Waiting for call session to end...`);
      await step.sleep("wait-for-session-end", "5s");

      const [recheckedMeeting] = await db
        .select()
        .from(meetings)
        .where(eq(meetings.id, meetingId));

      if (recheckedMeeting && recheckedMeeting.status === "active") {
        throw new Error(`[Meeting Lifecycle] Meeting ${meetingId} is still in active status. Call session has not ended yet.`);
      }
    }

    // 2. Fetch & parse the transcript with human-readable speaker names
    const transcriptText = await step.run("fetch-and-parse-transcript", async () => {
      console.log(`[INNGEST] Fetching transcript for meeting: ${meetingId} from ${transcriptUrl}`);
      const res = await fetch(transcriptUrl);
      if (!res.ok) {
        throw new Error(`Failed to fetch transcript from URL: ${res.status} ${res.statusText}`);
      }
      const rawBody = await res.text();

      const speakerMap: Record<string, string> = {
        ...(agent ? { [agent.id]: agent.name } : {}),
        ...(meetingUser ? { [meetingUser.id]: meetingUser.name } : {}),
        ...(agent ? { agent: agent.name, assistant: agent.name, ai: agent.name, bot: agent.name } : {}),
        ...(meetingUser ? { user: meetingUser.name, participant: meetingUser.name } : {}),
      };

      const parsed = parseTranscript(rawBody, speakerMap);
      if (!parsed || parsed.trim().length === 0) {
        console.warn(`[INNGEST] Parsed transcript is empty for meeting: ${meetingId}`);
        return "No speech was detected or recorded in the meeting transcript.";
      }
      return parsed;
    });

    // 3. Generate summary with OpenAI
    const summary = await step.run("generate-summary", async () => {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is not configured");
      }

      const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

      const agentContext = agent
        ? `Meeting Name: ${meeting.name}\nMeeting AI Assistant: ${agent.name} (${agent.instructions})\n\n`
        : `Meeting Name: ${meeting.name}\n\n`;

      const userContent = `${agentContext}Meeting Transcript:\n"""\n${transcriptText}\n"""`;

      const openai = getOpenAIClient();
      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        temperature: 0.2,
      });

      const generatedSummary = response.choices[0]?.message?.content?.trim();
      if (!generatedSummary) {
        throw new Error("OpenAI returned an empty summary");
      }

      console.log(`[Meeting Lifecycle] Summary generated for meeting: ${meetingId}`);
      return generatedSummary;
    });

    // 4. Update meeting with generated summary and mark status completed ONLY after successful summary generation
    await step.run("update-meeting-status", async () => {
      if (!summary || summary.trim().length === 0) {
        throw new Error("Cannot complete meeting: Summary is missing or empty");
      }

      await db
        .update(meetings)
        .set({
          summary,
          status: "completed",
        })
        .where(eq(meetings.id, meetingId));

      console.log(`[Meeting Lifecycle] COMPLETED: Meeting ${meetingId} status set to completed`);
    });

    return {
      meetingId,
      status: "completed",
    };
  }
);
