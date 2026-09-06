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

    const call = streamVideo.video.call("default", meetingId);
    console.log("[WEBHOOK] Connecting AI agent:", existingAgent.id, "to call:", call.cid);

    try {
      const realtimeClient = await streamVideo.video.connectOpenAi({
        call,
        openAiApiKey: process.env.OPENAI_API_KEY!,
        agentUserId: existingAgent.id,
      });

      console.log("[WEBHOOK] AI agent connected successfully");

      realtimeClient.updateSession({
        instructions: existingAgent.instructions,
      });

      console.log("[WEBHOOK] Session instructions applied");
    } catch (err) {
      console.error("[WEBHOOK] ERROR connecting AI agent:", err);
      return NextResponse.json(
        { error: "Failed to connect AI agent", details: String(err) },
        { status: 500 }
      );
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