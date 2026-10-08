import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ToastProvider } from "@/components/ui/Toast";
import App from "./App";
import "./index.css";

function Root() {
  const [queryClient] = useState(() => {
    const qc: QueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: true, staleTime: 5_000 } },
      mutationCache: new MutationCache({
        onError: (err) => {
          if (!(err instanceof TRPCClientError)) return;
          const code = err.data?.code;
          // Stale screen or session: drop cached data so nothing of another state survives.
          if (code === "UNAUTHORIZED" || (code === "CONFLICT" && err.message === "company_changed")) void qc.resetQueries();
          else if (code === "CONFLICT") void qc.invalidateQueries();
        },
      }),
    });
    return qc;
  });
  const [trpcClient] = useState(() => trpc.createClient({ links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })] }));
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
