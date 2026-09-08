import { meetingsRouter } from "@/modules/meetings/server/procedure/procedure";
import { createTRPCRouter } from "../init";

import { agentsRouter } from "@/modules/agents/server/procedures";
import { premiumRouter } from "@/modules/premium/server/procedure";

export const appRouter = createTRPCRouter({
  agents: agentsRouter,
  meetings: meetingsRouter,
  premium: premiumRouter,
});

export type AppRouter = typeof appRouter;