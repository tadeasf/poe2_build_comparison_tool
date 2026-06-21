import { redirect } from "next/navigation";
import { login } from "@/app/auth/actions";
import { AuthForm } from "@/components/auth-form";
import { getUser } from "@/lib/supabase/auth";

export default async function LoginPage() {
  if (await getUser()) redirect("/builds");
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <AuthForm mode="login" action={login} />
    </main>
  );
}
