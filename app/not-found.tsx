import Link from "next/link";
export default function NotFound() {
  return (
    <main className="loading-screen">
      <h1>Website not found.</h1>
      <Link className="button secondary" href="/sites">
        Return to your portfolio
      </Link>
    </main>
  );
}
