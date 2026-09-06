import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@/db";
import * as schema from "@/db/schema";

// Base trusted origins always include both localhost variants.
const baseTrustedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

// BETTER_AUTH_TRUSTED_ORIGINS can be a comma-separated list of additional
// origins (e.g. an ngrok URL) added without touching existing env values.
const extraOrigins = process.env.BETTER_AUTH_TRUSTED_ORIGINS
  ? process.env.BETTER_AUTH_TRUSTED_ORIGINS
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean)
  : [];

const trustedOrigins = [...baseTrustedOrigins, ...extraOrigins];

export const auth = betterAuth({
  // baseURL drives the auth server's own URL (used for cookie domain, etc.)
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",

  // Allow requests from localhost and any extra origins (e.g. ngrok tunnel).
  trustedOrigins,

  socialProviders: {
    github: { 
      clientId: process.env.GITHUB_CLIENT_ID as string, 
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string, 
    },
    google: { 
      clientId: process.env.GOOGLE_CLIENT_ID as string, 
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string, 
    }, 
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),

  emailAndPassword: {
    enabled: true,
  },
});