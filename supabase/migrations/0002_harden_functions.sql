-- Address Supabase security advisor warnings.

-- Pin a stable search_path on the updated_at trigger function.
alter function public.set_updated_at() set search_path = '';

-- handle_new_user is a SECURITY DEFINER trigger function; it must not be
-- callable directly via the REST RPC endpoint.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
