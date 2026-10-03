import Link from "next/link";

export default function NotFound() {
  return (
    <main className="shell">
      <Link className="brand" href="/">
        tabletalk
      </Link>
      <div className="empty" style={{ marginTop: 70 }}>
        <h1>This table is off the map.</h1>
        <p>The page may be private, deleted, or have a different address.</p>
        <Link href="/" className="btn primary">
          Explore NYC
        </Link>
      </div>
    </main>
  );
}
