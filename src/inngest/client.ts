import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "meet-ai",
  isDev:
    process.env.INNGEST_DEV !== undefined
      ? process.env.INNGEST_DEV === "true" || process.env.INNGEST_DEV === "1"
      : process.env.NODE_ENV === "development" || !process.env.INNGEST_EVENT_KEY,
  baseUrl: process.env.INNGEST_BASE_URL || undefined,
  eventKey: process.env.INNGEST_EVENT_KEY || undefined,
});

