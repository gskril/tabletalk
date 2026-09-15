export default function NotFound() {
  return (
    <main className="shell">
      <a className="brand" href="/">
        tabletalk
      </a>
      <div className="empty" style={{ marginTop: 70 }}>
        <h1>This table is off the map.</h1>
        <p>The page may be private, deleted, or have a different address.</p>
        <a href="/" className="btn primary">
          Explore NYC
        </a>
      </div>
    </main>
  );
}
