import { redirect } from "next/navigation";
import { createClient } from "./server";

/** Returns the current authenticated user, or null. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Returns the current user or redirects to /login. */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
