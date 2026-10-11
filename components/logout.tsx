"use client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
export function Logout() {
  const router = useRouter();
  return (
    <button
      className="icon-button logout"
      aria-label="Sign out"
      onClick={async () => {
        const r = await fetch("/api/auth/logout", { method: "POST" });
        if (r.ok) {
          router.replace("/login");
          router.refresh();
        }
      }}
    >
      <LogOut size={16} />
    </button>
  );
}
