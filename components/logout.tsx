"use client";
import { useState } from "react";
import { LogOut } from "lucide-react";
export function Logout() {
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <span>
      <button
        className="icon-button logout"
        aria-label="Sign out"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            const response = await fetch("/api/auth/logout", {
              method: "POST",
            });
            if (!response.ok) throw Error("Sign-out failed. Please retry.");
            window.location.replace("/login");
          } catch {
            setError("Unable to sign out. Check your connection and retry.");
            setPending(false);
          }
        }}
      >
        <LogOut size={16} />
      </button>
      {error && <span role="alert">{error}</span>}
    </span>
  );
}
