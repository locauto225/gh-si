import { useCallback, useState } from "react";

type AsyncStatus = "idle" | "loading" | "success" | "error";

export function useAsyncTask() {
  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T,>(task: () => Promise<T>): Promise<T> => {
    setStatus("loading");
    setError(null);
    try {
      const result = await task();
      setStatus("success");
      return result;
    } catch (e) {
      const message = (e as { message?: string })?.message ?? "Erreur";
      setError(message);
      setStatus("error");
      throw e;
    }
  }, []);

  return {
    status,
    loading: status === "loading",
    success: status === "success",
    isError: status === "error",
    error,
    reset: () => {
      setStatus("idle");
      setError(null);
    },
    run,
  };
}

