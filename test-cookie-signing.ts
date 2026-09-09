import "dotenv/config";
import crypto from "crypto";
import { auth } from "./src/lib/auth";

function signCookie(value: string, secret: string) {
  const hmac = crypto.createHmac("sha256", secret).update(value).digest("base64");
  return `${value}.${hmac}`;
}

async function testSign() {
  const ctx = await (auth as any).$context;
  const token = "kNs4YjLdKW2oTiAIuZSiNDKMMToM45F9";
  const signed = signCookie(token, ctx.secret);
  console.log("Signed token:", signed);

  const headers = new Headers();
  headers.set("cookie", `better-auth.session_token=${signed}`);
  const session = await auth.api.getSession({ headers });
  console.log("Session verified:", session ? `User: ${session.user.email} (ID: ${session.user.id})` : "FAILED");
}

testSign().catch(console.error);
