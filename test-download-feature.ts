import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { db } from "./src/db";
import { session, meetings } from "./src/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "./src/lib/auth";

function signCookie(value: string, secret: string) {
  const hmac = crypto.createHmac("sha256", secret).update(value).digest("base64");
  return `${value}.${hmac}`;
}

async function runTests() {
  console.log("==================================================");
  console.log("   MEET AI - DOWNLOAD RECORDING TEST SUITE        ");
  console.log("==================================================");

  const ctx = await (auth as any).$context;
  const secret = ctx.secret;

  // ----------------------------------------------------
  // TEST 1: Unauthenticated request should return 401
  // ----------------------------------------------------
  console.log("\n[TEST 1] Testing unauthenticated download request...");
  const unauthRes = await fetch("http://localhost:3000/api/meetings/kupp9kwML0o4FXr7v1yd4/recording/download");
  console.log(`Response status: ${unauthRes.status} ${unauthRes.statusText}`);
  const unauthBody = await unauthRes.json();
  console.log("Response body:", unauthBody);
  if (unauthRes.status !== 401) {
    throw new Error(`Test 1 Failed: Expected 401 Unauthorized but got ${unauthRes.status}`);
  }
  console.log("PASS: Unauthenticated request correctly rejected with 401 Unauthorized.");

  // ----------------------------------------------------
  // TEST 2: Prepare sessions for User A and User B
  // ----------------------------------------------------
  console.log("\n[TEST 2] Preparing test sessions for authorization tests...");
  // User A: XBjda4nrE1bQqjKiihHSPVU3C8woZQNm (owns kupp9kwML0o4FXr7v1yd4)
  // User B: dVz4JUrXLxA4ve9d2u2KWlaFYD60qy8S (owns zwxDbFmDZHeQ9ZxxxIXwO)
  const tokenA = "kNs4YjLdKW2oTiAIuZSiNDKMMToM45F9";
  const tokenB = "7l0g1UvkUqZ9TvjJPBoWIaIW1cjgGC4e";

  const signedCookieA = signCookie(tokenA, secret);
  const signedCookieB = signCookie(tokenB, secret);

  const cookieHeaderA = `better-auth.session_token=${encodeURIComponent(signedCookieA)}`;
  const cookieHeaderB = `better-auth.session_token=${encodeURIComponent(signedCookieB)}`;

  // Verify sessions via getSession
  const sessionA = await auth.api.getSession({ headers: new Headers({ cookie: cookieHeaderA }) });
  const sessionB = await auth.api.getSession({ headers: new Headers({ cookie: cookieHeaderB }) });

  console.log(`User A session verified: ${sessionA?.user.email} (ID: ${sessionA?.user.id})`);
  console.log(`User B session verified: ${sessionB?.user.email} (ID: ${sessionB?.user.id})`);

  if (!sessionA || !sessionB) {
    throw new Error("Failed to verify sessions for User A and User B");
  }

  // ----------------------------------------------------
  // TEST 3: User B tries to download User A's meeting (Unauthorized)
  // ----------------------------------------------------
  console.log("\n[TEST 3] Testing cross-user authorization (User B accessing User A's meeting)...");
  const crossUserRes = await fetch("http://localhost:3000/api/meetings/kupp9kwML0o4FXr7v1yd4/recording/download", {
    headers: { Cookie: cookieHeaderB },
  });
  console.log(`Response status: ${crossUserRes.status} ${crossUserRes.statusText}`);
  const crossUserBody = await crossUserRes.json();
  console.log("Response body:", crossUserBody);
  if (crossUserRes.status !== 404) {
    throw new Error(`Test 3 Failed: Expected 404 Not Found for unauthorized meeting but got ${crossUserRes.status}`);
  }
  console.log("PASS: Cross-user access securely forbidden (returns 404 without leaking data).");

  // ----------------------------------------------------
  // TEST 4: Non-existent meeting ID returns 404
  // ----------------------------------------------------
  console.log("\n[TEST 4] Testing non-existent meeting ID...");
  const nonExistentRes = await fetch("http://localhost:3000/api/meetings/random-non-existent-id/recording/download", {
    headers: { Cookie: cookieHeaderA },
  });
  console.log(`Response status: ${nonExistentRes.status} ${nonExistentRes.statusText}`);
  if (nonExistentRes.status !== 404) {
    throw new Error(`Test 4 Failed: Expected 404 for non-existent meeting but got ${nonExistentRes.status}`);
  }
  console.log("PASS: Non-existent meeting returns 404.");

  // ----------------------------------------------------
  // TEST 5: User A downloading their meeting kupp9kwML0o4FXr7v1yd4
  // ----------------------------------------------------
  console.log("\n[TEST 5] Testing authorized recording download for User A (meeting: kupp9kwML0o4FXr7v1yd4)...");
  const downloadResA = await fetch("http://localhost:3000/api/meetings/kupp9kwML0o4FXr7v1yd4/recording/download", {
    headers: { Cookie: cookieHeaderA },
  });

  console.log(`Response status: ${downloadResA.status} ${downloadResA.statusText}`);
  const dispositionA = downloadResA.headers.get("content-disposition");
  const typeA = downloadResA.headers.get("content-type");
  const lengthA = downloadResA.headers.get("content-length");

  console.log(`Content-Disposition: ${dispositionA}`);
  console.log(`Content-Type: ${typeA}`);
  console.log(`Content-Length: ${lengthA} bytes`);

  if (downloadResA.status !== 200) {
    const err = await downloadResA.text();
    throw new Error(`Test 5 Failed: Status ${downloadResA.status} - ${err}`);
  }

  const expectedDispositionA = 'attachment; filename="meet-ai-recording-kupp9kwML0o4FXr7v1yd4.mp4"';
  if (dispositionA !== expectedDispositionA) {
    throw new Error(`Test 5 Failed: Content-Disposition mismatch. Expected: ${expectedDispositionA}, got: ${dispositionA}`);
  }
  console.log("PASS: Correct attachment Content-Disposition header verified.");

  // Download and write file to verify bit-for-bit validity
  console.log("Streaming video payload to disk...");
  const arrayBufferA = await downloadResA.arrayBuffer();
  const bufferA = Buffer.from(arrayBufferA);
  console.log(`Downloaded ${bufferA.length} bytes.`);

  const outputPathA = path.join(process.cwd(), "meet-ai-recording-kupp9kwML0o4FXr7v1yd4.mp4");
  fs.writeFileSync(outputPathA, bufferA);
  console.log(`Saved downloaded video to: ${outputPathA}`);

  // Validate MP4 container
  const ftypBox = bufferA.subarray(4, 8).toString("ascii");
  const majorBrand = bufferA.subarray(8, 12).toString("ascii");
  console.log(`Container header: box = '${ftypBox}', major_brand = '${majorBrand}'`);
  if (ftypBox !== "ftyp") {
    throw new Error(`Test 5 Failed: Invalid MP4 container magic box '${ftypBox}'`);
  }
  console.log("PASS: Valid MP4 container structure verified.");

  // ----------------------------------------------------
  // TEST 6: User B downloading their meeting zwxDbFmDZHeQ9ZxxxIXwO
  // ----------------------------------------------------
  console.log("\n[TEST 6] Testing authorized recording download for User B (meeting: zwxDbFmDZHeQ9ZxxxIXwO)...");
  const downloadResB = await fetch("http://localhost:3000/api/meetings/zwxDbFmDZHeQ9ZxxxIXwO/recording/download", {
    headers: { Cookie: cookieHeaderB },
  });

  console.log(`Response status: ${downloadResB.status} ${downloadResB.statusText}`);
  const dispositionB = downloadResB.headers.get("content-disposition");
  console.log(`Content-Disposition: ${dispositionB}`);
  if (downloadResB.status !== 200) {
    throw new Error(`Test 6 Failed: User B download returned status ${downloadResB.status}`);
  }
  const expectedDispositionB = 'attachment; filename="meet-ai-recording-zwxDbFmDZHeQ9ZxxxIXwO.mp4"';
  if (dispositionB !== expectedDispositionB) {
    throw new Error(`Test 6 Failed: Content-Disposition mismatch: ${dispositionB}`);
  }
  console.log("PASS: User B authorized download verified.");

  // ----------------------------------------------------
  // TEST 7: Meeting with no recording returns 404
  // ----------------------------------------------------
  console.log("\n[TEST 7] Testing meeting with no recording...");
  // Create a temporary meeting without recording
  const tempMeetingId = `test-norec-${Date.now()}`;
  const [userAMeeting] = await db.select().from(meetings).where(eq(meetings.userId, sessionA.user.id)).limit(1);
  await db.insert(meetings).values({
    id: tempMeetingId,
    name: "Test Meeting Without Recording",
    userId: sessionA.user.id,
    agentId: userAMeeting.agentId,
    recordingUrl: null,
  });

  try {
    const noRecRes = await fetch(`http://localhost:3000/api/meetings/${tempMeetingId}/recording/download`, {
      headers: { Cookie: cookieHeaderA },
    });
    console.log(`No-recording response status: ${noRecRes.status} ${noRecRes.statusText}`);
    const noRecBody = await noRecRes.json();
    console.log("No-recording response body:", noRecBody);
    if (noRecRes.status !== 404) {
      throw new Error(`Test 7 Failed: Expected 404 for missing recording but got ${noRecRes.status}`);
    }
    console.log("PASS: Meeting with no recording correctly returns 404.");
  } finally {
    // Clean up temporary test meeting
    await db.delete(meetings).where(eq(meetings.id, tempMeetingId));
    console.log("Cleaned up temporary test meeting.");
  }

  console.log("\n==================================================");
  console.log("   ALL 7 TESTS PASSED SUCCESSFULLY!               ");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
