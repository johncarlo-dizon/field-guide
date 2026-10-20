import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import LoginScreen from "@/components/LoginScreen";

export const dynamic = "force-dynamic";

export default async function Home() {
  const me = await getCurrentUser();

  // Already logged in: go straight to the app, with no login screen in between.
  if (me && !me.mustChangePin) redirect("/errors");

  // Logged in but still on a temporary PIN: show the "set your own PIN" screen.
  if (me) {
    return (
      <LoginScreen
        people={[]}
        user={{ id: me.id, displayName: me.displayName, position: me.position, role: me.role, mustChangePin: true }}
      />
    );
  }

  // Not logged in: show the login with the names already loaded.
  const people = await db
    .select({ id: users.id, displayName: users.displayName, position: users.position })
    .from(users)
    .where(eq(users.isActive, true))
    .orderBy(asc(users.displayName));

  return <LoginScreen people={people} user={null} />;
}