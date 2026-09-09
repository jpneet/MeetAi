import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { meetings } from "@/db/schema";
import { streamVideo } from "@/lib/stream-video";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ meetingId: string }> }
) {
  try {
    const { meetingId } = await params;

    if (!meetingId) {
      return NextResponse.json(
        { error: "Meeting ID is required" },
        { status: 400 }
      );
    }

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const [existingMeeting] = await db
      .select()
      .from(meetings)
      .where(
        and(
          eq(meetings.id, meetingId),
          eq(meetings.userId, session.user.id)
        )
      );

    if (!existingMeeting) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    let recordingUrl = existingMeeting.recordingUrl;

    // Fallback: If recordingUrl is not yet saved in DB, query Stream Video API directly
    if (!recordingUrl) {
      try {
        const call = streamVideo.video.call("default", meetingId);
        const { recordings } = await call.listRecordings();
        const sorted = recordings.sort(
          (a, b) =>
            new Date(b.end_time).getTime() - new Date(a.end_time).getTime()
        );
        if (sorted.length > 0 && sorted[0].url) {
          recordingUrl = sorted[0].url;
          await db
            .update(meetings)
            .set({ recordingUrl })
            .where(eq(meetings.id, meetingId));
        }
      } catch (err) {
        console.error("[RECORDING DOWNLOAD] Error fetching from Stream API:", err);
      }
    }

    if (!recordingUrl) {
      return NextResponse.json(
        { error: "Recording is not available yet" },
        { status: 404 }
      );
    }

    // Fetch the remote recording file stream from Stream CDN
    const recordingRes = await fetch(recordingUrl);
    if (!recordingRes.ok || !recordingRes.body) {
      return NextResponse.json(
        { error: "Failed to fetch recording from remote storage" },
        { status: recordingRes.status || 502 }
      );
    }

    const filename = `meet-ai-recording-${meetingId}.mp4`;
    const responseHeaders = new Headers();
    responseHeaders.set(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );
    responseHeaders.set(
      "Content-Type",
      recordingRes.headers.get("content-type") || "video/mp4"
    );

    const contentLength = recordingRes.headers.get("content-length");
    if (contentLength) {
      responseHeaders.set("Content-Length", contentLength);
    }

    responseHeaders.set(
      "Cache-Control",
      "private, no-cache, no-store, must-revalidate"
    );

    return new Response(recordingRes.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[RECORDING DOWNLOAD] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while downloading recording" },
      { status: 500 }
    );
  }
}
