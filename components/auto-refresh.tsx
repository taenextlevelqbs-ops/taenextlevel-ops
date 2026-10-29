"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
export function AutoRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(refresh, 65000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [router]);
  return (
    <button
      className="manual-refresh"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      aria-label="Refresh live business data"
    >
      <RefreshCw size={17} className={pending ? "spin" : ""} />
      <span>{pending ? "Refreshing…" : "Refresh"}</span>
    </button>
  );
}
