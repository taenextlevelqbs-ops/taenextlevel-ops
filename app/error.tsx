"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="loading-screen">
      <h1>This view is temporarily unavailable.</h1>
      <p>Your data has not been replaced with estimates.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
