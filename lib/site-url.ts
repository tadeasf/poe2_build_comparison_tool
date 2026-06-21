/**
 * Absolute base URL of the deployed app, used for auth email redirect links so
 * confirmation emails point at production rather than localhost.
 *
 * Precedence: NEXT_PUBLIC_SITE_URL (set this in Vercel) → Vercel's production URL
 * → request-time VERCEL_URL → localhost. NOTE: Supabase still requires the same
 * Site URL configured in the dashboard (Auth → URL Configuration).
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod.replace(/\/+$/, "")}`;

  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}
