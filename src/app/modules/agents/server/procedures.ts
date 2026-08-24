// import { z } from "zod";
// import { TRPCError } from "@trpc/server";
// import { and, count, desc, eq, getTableColumns, ilike } from "drizzle-orm";

import { db } from "@/db";
import { agents, } from "@/db/schema";
import { createTRPCRouter, baseProcedure, } from "@/trpc/init";
// import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE } from "@/constants";

// import { agentsInsertSchema, agentsUpdateSchema } from "../schemas";

export const agentsRouter = createTRPCRouter({
  getMany: baseProcedure.query(async () => {
    const data = await db
      .select()
      .from(agents);

    return data;
  }),
});