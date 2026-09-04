import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SearchParams } from "nuqs";

import { getSession } from "@/trpc/init";
import { getQueryClient, trpc } from "@/trpc/server";

import {
  AgentsView,
  AgentsViewLoading,
} from "@/modules/agents/ui/views/agents-view";

import { AgentsListHeader } from "@/modules/agents/ui/components/agents-list-header";
import { loadSearchParams } from "@/modules/agents/params";

interface Props {
  searchParams: Promise<SearchParams>;
};

const Page = async ({ searchParams }: Props) => {
  const filters = await loadSearchParams(searchParams);
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(
    trpc.agents.getMany.queryOptions({
      ...filters,
    })
  );

  return (
    <>
      <AgentsListHeader />

      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<AgentsViewLoading />}>
          <AgentsView />
        </Suspense>
      </HydrationBoundary>
    </>
  );
};

export default Page;