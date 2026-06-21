"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthState } from "@/app/auth/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Action = (prev: AuthState, formData: FormData) => Promise<AuthState>;

export function AuthForm({
  mode,
  action,
}: {
  mode: "login" | "signup";
  action: Action;
}) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, null);
  const isSignup = mode === "signup";

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{isSignup ? "Create account" : "Welcome back"}</CardTitle>
        <CardDescription>
          {isSignup
            ? "Sign up to save and compare builds."
            : "Sign in to your build library."}
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="space-y-4">
          {isSignup && (
            <div className="space-y-2">
              <Label htmlFor="display_name">Display name</Label>
              <Input
                id="display_name"
                name="display_name"
                placeholder="Exile"
                autoComplete="nickname"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete={isSignup ? "new-password" : "current-password"}
            />
          </div>
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          {state?.message && (
            <Alert>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-3">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
          </Button>
          <p className="text-sm text-muted-foreground">
            {isSignup ? (
              <>
                Already have an account?{" "}
                <Link className="underline" href="/login">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                No account?{" "}
                <Link className="underline" href="/signup">
                  Create one
                </Link>
              </>
            )}
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
