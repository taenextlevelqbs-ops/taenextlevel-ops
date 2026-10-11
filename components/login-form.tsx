"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        const form = new FormData(event.currentTarget);
        try {
          const response = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: form.get("email"),
              password: form.get("password"),
            }),
          });
          const data = await response.json();
          if (!response.ok) {
            setError(data.error || "Sign-in failed.");
            return;
          }
          router.replace("/");
          router.refresh();
        } catch {
          setError("Unable to reach the sign-in service.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Email address
        <input
          name="email"
          type="email"
          autoComplete="username"
          defaultValue="takwancrews@gmail.com"
          required
          maxLength={254}
        />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={256}
          placeholder="Enter your password"
        />
      </label>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <button className="button primary login-submit" disabled={busy}>
        {busy ? (
          <LoaderCircle className="spin" size={16} />
        ) : (
          <>
            Enter your workspace <ArrowRight size={17} />
          </>
        )}
      </button>
    </form>
  );
}
