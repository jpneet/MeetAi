import { eq, not, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import {
  CallEndedEvent,
  CallRecordingReadyEvent,
  CallSessionEndedEvent,
  CallSessionParticipantLeftEvent,
  CallSessionStartedEvent,
  CallTranscriptionReadyEvent,
} from "@stream-io/node-sdk";

import { db } from "@/db";
import { agents, meetings } from "@/db/schema";
import { streamVideo } from "@/lib/stream-video";
import { inngest } from "@/inngest/client";

export async function POST(req: NextRequest) {
  console.log("[WEBHOOK] Incoming request");

  const signature = req.headers.get("x-signature");
  const receivedApiKey = req.headers.get("x-api-key");
  const contentEncoding = req.headers.get("content-encoding");

  console.log("[WEBHOOK] x-signature present:", !!signature);
  console.log("[WEBHOOK] x-api-key matches configured key:", receivedApiKey === process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY);
  console.log("[WEBHOOK] content-encoding:", contentEncoding ?? "none");

  if (!signature || !receivedApiKey) {
    console.log("[WEBHOOK] Missing signature or API key — returning 400");
    return NextResponse.json(
      { error: "Missing signature or API key" },
      { status: 400 }
    );
  }

  // Read the raw bytes BEFORE any decompression.
  // req.text() causes Next.js to decompress gzip payloads transparently,
  // which means verifyWebhook() would compute HMAC over the decompressed
  // string while Stream computed it over the original gzip bytes → mismatch.
  // req.arrayBuffer() returns the untouched wire bytes.
  const rawBytes = await req.arrayBuffer();
  const rawBody = Buffer.from(rawBytes);

  console.log("[WEBHOOK] Body byte length:", rawBody.length);

  // verifyAndParseWebhook handles gzip detection, decompression, HMAC
  // verification, and JSON parsing in a single call.
  let payload: Record<string, unknown>;
  try {
    payload = streamVideo.verifyAndParseWebhook(rawBody, signature) as unknown as Record<string, unknown>;
  } catch (err) {
    console.log("[WEBHOOK] Signature/parse failed:", String(err));
    return NextResponse.json(
      { error: "Invalid signature or malformed payload" },
      { status: 401 }
    );
  }

  console.log("[WEBHOOK] Signature valid: true");

  const eventType = payload.type as string | undefined;
  console.log("[WEBHOOK] Event type:", eventType);

  if (eventType === "call.session_started") {
    const event = payload as unknown as CallSessionStartedEvent;
    const meetingId = event.call.custom?.meetingId;

    console.log("[WEBHOOK] Meeting ID from event:", meetingId);

    if (!meetingId) {
      console.log("[WEBHOOK] Missing meetingId in call.custom — returning 400");
      return NextResponse.json(
        { error: "Missing meetingId" },
        { status: 400 }
      );
    }

    // Allow both "upcoming" and "active" status — the session_started event
    // fires only once per session, so we must not exclude "active" meetings
    // in case of retries or reconnects.
    const [existingMeeting] = await db
      .select()
      .from(meetings)
      .where(
        and(
          eq(meetings.id, meetingId),
          not(eq(meetings.status, "completed")),
          not(eq(meetings.status, "cancelled")),
          not(eq(meetings.status, "processing"))
        )
      );

    console.log("[WEBHOOK] Meeting found:", !!existingMeeting, existingMeeting?.status);

    if (!existingMeeting) {
      console.log("[WEBHOOK] Meeting not found or in terminal status — returning 404");
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    await db
      .update(meetings)
      .set({
        status: "active",
        startedAt: existingMeeting.startedAt ?? new Date(),
      })
      .where(eq(meetings.id, existingMeeting.id));

    console.log(`[Meeting Lifecycle] ACTIVE: Meeting ${meetingId} status set to active`);

    const [existingAgent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, existingMeeting.agentId));

    console.log("[WEBHOOK] Agent found:", !!existingAgent, existingAgent?.id);

    if (!existingAgent) {
      console.log("[WEBHOOK] Agent not found — returning 404");
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    const visionAgentUrl = process.env.VISION_AGENT_URL || "http://127.0.0.1:8080";
    console.log(`[WEBHOOK] Requesting Vision Agent at ${visionAgentUrl} for meeting: ${meetingId}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const agentRes = await fetch(`${visionAgentUrl}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callType: "default",
          callId: meetingId,
          agentId: existingAgent.id,
          agentName: existingAgent.name,
          instructions: existingAgent.instructions,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const agentData = await agentRes.json().catch(() => ({}));
      console.log("[WEBHOOK] Vision Agent response:", agentRes.status, agentData);

      if (!agentRes.ok) {
        console.error("[WEBHOOK] Vision Agent returned non-OK status:", agentRes.status, agentData);
      }
    } catch (err) {
      console.error("[WEBHOOK] Could not connect to Vision Agent service (is it running on port 8080?):", err);
    }

    return NextResponse.json({ status: "ok" });

  } else if (eventType === "call.session_participant_left") {
    const event = payload as unknown as CallSessionParticipantLeftEvent;
    const meetingId =
      event.call_cid?.split(":")[1] ||
      ((payload as { call?: { custom?: { meetingId?: string } } }).call?.custom?.meetingId);

    const participantId = event.participant?.user?.id ?? "unknown";
    console.log(`[Meeting Lifecycle] Participant left: ${participantId} from meeting: ${meetingId}. Call/session is still running — meeting remains ACTIVE.`);

    if (!meetingId) {
      return NextResponse.json(
        { error: "Missing meetingId" },
        { status: 400 }
      );
    }

    // DO NOT mark the meeting as processing.
    // DO NOT mark the meeting as completed.
    // DO NOT end the meeting.
    // The meeting must remain ACTIVE while the call/session is still running.
    return NextResponse.json({ status: "ok" });

  } else if (eventType === "call.session_ended" || eventType === "call.ended") {
    const event = payload as unknown as (CallSessionEndedEvent | CallEndedEvent);
    const meetingId =
      event.call_cid?.split(":")[1] ||
      (event.call?.custom as { meetingId?: string } | undefined)?.meetingId;

    console.log(`[Meeting Lifecycle] Call session ended for meeting ID: ${meetingId}`);

    if (!meetingId) {
      console.log("[WEBHOOK] Missing meetingId in session_ended — returning 400");
      return NextResponse.json(
        { error: "Missing meetingId" },
        { status: 400 }
      );
    }

    const [existingMeeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, meetingId));

    if (existingMeeting) {
      // Transition meeting to processing (unless already in terminal status)
      // Do NOT mark it completed immediately. Do NOT mark it cancelled.
      const nextStatus =
        existingMeeting.status === "completed" || existingMeeting.status === "cancelled"
          ? existingMeeting.status
          : "processing";

      const [updatedMeeting] = await db
        .update(meetings)
        .set({
          status: nextStatus,
          endedAt: existingMeeting.endedAt ?? new Date(),
        })
        .where(eq(meetings.id, existingMeeting.id))
        .returning();

      if (nextStatus === "processing") {
        console.log(`[Meeting Lifecycle] PROCESSING: Meeting ${meetingId} status set to processing`);
      }

      // Handle Scenario B (call.transcription_ready arrived BEFORE call.session_ended):
      // If transcriptUrl is already present and meeting transitioned to processing, trigger Inngest now!
      if (updatedMeeting.status === "processing" && updatedMeeting.transcriptUrl) {
        console.log(`[Meeting Lifecycle] Transcript already available for meeting ${meetingId} (Scenario B) — triggering Inngest processing`);
        try {
          await inngest.send({
            name: "meetings/processing",
            data: {
              meetingId: updatedMeeting.id,
              transcriptUrl: updatedMeeting.transcriptUrl,
            },
          });
          console.log(`[Meeting Lifecycle] Inngest processing event sent for meeting: ${meetingId}`);
        } catch (inngestErr) {
          console.error("[WEBHOOK] Error sending Inngest event meetings/processing:", inngestErr);
          return NextResponse.json(
            { error: "Failed to send Inngest event", details: String(inngestErr) },
            { status: 500 }
          );
        }
      }
    } else {
      console.log("[WEBHOOK] Meeting not found for session_ended:", meetingId);
    }

    return NextResponse.json({ status: "ok" });

  } else if (eventType === "call.transcription_ready") {
    const event = payload as unknown as CallTranscriptionReadyEvent;
    const meetingId = event.call_cid?.split(":")[1];
    const transcriptUrl = event.call_transcription?.url;

    console.log(`[Meeting Lifecycle] Transcript ready for meeting ID: ${meetingId}, URL: ${transcriptUrl}`);

    if (!meetingId) {
      return NextResponse.json(
        { error: "Missing meetingId" },
        { status: 400 }
      );
    }

    if (!transcriptUrl) {
      return NextResponse.json(
        { error: "Missing transcriptUrl" },
        { status: 400 }
      );
    }

    const [existingMeeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.id, meetingId));

    if (!existingMeeting) {
      console.log("[WEBHOOK] Meeting not found for transcription_ready:", meetingId);
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    // Save the transcript URL.
    // If meeting is already in "processing" (Scenario A: session_ended arrived first),
    // keep status "processing" and trigger Inngest.
    // If meeting is still "active" (Scenario B: transcription_ready arrived first),
    // keep status "active" (preserving call session) and save transcriptUrl.
    // session_ended will trigger Inngest when the call finishes.
    const isCallEnded =
      existingMeeting.status === "processing" ||
      existingMeeting.endedAt !== null;

    const nextStatus =
      existingMeeting.status === "completed" || existingMeeting.status === "cancelled"
        ? existingMeeting.status
        : isCallEnded
        ? "processing"
        : existingMeeting.status;

    const [updatedMeeting] = await db
      .update(meetings)
      .set({
        transcriptUrl,
        status: nextStatus,
      })
      .where(eq(meetings.id, meetingId))
      .returning();

    console.log(`[WEBHOOK] Meeting ${meetingId} transcriptUrl saved. Status: ${updatedMeeting.status}`);

    // If meeting is in "processing", trigger Inngest (Scenario A)
    if (updatedMeeting.status === "processing") {
      try {
        await inngest.send({
          name: "meetings/processing",
          data: {
            meetingId: updatedMeeting.id,
            transcriptUrl: updatedMeeting.transcriptUrl!,
          },
        });

        console.log(`[Meeting Lifecycle] Inngest processing event sent for meeting: ${updatedMeeting.id}`);
      } catch (inngestErr) {
        console.error("[WEBHOOK] Error sending Inngest event meetings/processing:", inngestErr);
        return NextResponse.json(
          { error: "Failed to send Inngest event", details: String(inngestErr) },
          { status: 500 }
        );
      }
    } else {
      console.log(`[Meeting Lifecycle] Call is still in status '${updatedMeeting.status}'. Transcript URL saved. Waiting for call.session_ended to trigger Inngest.`);
    }

    return NextResponse.json({ status: "ok" });

  } else if (eventType === "call.recording_ready") {
    const event = payload as unknown as CallRecordingReadyEvent;
    const meetingId = event.call_cid?.split(":")[1];
    const recordingUrl = event.call_recording?.url;

    console.log("[WEBHOOK] Recording ready for meeting ID:", meetingId, "URL:", recordingUrl);

    if (!meetingId) {
      return NextResponse.json(
        { error: "Missing meetingId" },
        { status: 400 }
      );
    }

    const [updatedMeeting] = await db
      .update(meetings)
      .set({
        recordingUrl,
      })
      .where(eq(meetings.id, meetingId))
      .returning();

    if (!updatedMeeting) {
      console.log("[WEBHOOK] Meeting not found for recording_ready:", meetingId);
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    console.log("[WEBHOOK] Meeting recordingUrl updated:", updatedMeeting.id);

    return NextResponse.json({ status: "ok" });
  }

  console.log("[WEBHOOK] Unhandled event type:", eventType);
  return NextResponse.json({ status: "ok" });
}