import { eq, not, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import {
  CallSessionParticipantLeftEvent,
  CallSessionStartedEvent,
} from "@stream-io/node-sdk";

import { db } from "@/db";
import { agents, meetings } from "@/db/schema";
import { streamVideo } from "@/lib/stream-video";

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
        startedAt: new Date(),
      })
      .where(eq(meetings.id, existingMeeting.id));

    console.log("[WEBHOOK] Meeting status updated to active");

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
    const meetingId = event.call_cid.split(":")[1];

    console.log("[WEBHOOK] Participant left, meeting ID:", meetingId);

    if (!meetingId) {
      return NextResponse.json(
        { error: "Missing meetingId" },
        { status: 400 }
      );
    }

    return NextResponse.json({ status: "ok" });
  }

  console.log("[WEBHOOK] Unhandled event type:", eventType);
  return NextResponse.json({ status: "ok" });
}