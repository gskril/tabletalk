// Retired endpoint: old clients cannot create accounts outside Blackbird OAuth.
export async function POST() {
  return Response.json(
    { error: "Demo sign-in has been removed. Sign in with Blackbird." },
    { status: 410 },
  );
}
