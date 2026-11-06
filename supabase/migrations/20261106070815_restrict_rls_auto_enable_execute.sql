-- The security advisor flagged public.rls_auto_enable() (the event-trigger
-- function from Supabase's "auto-enable RLS" recipe) as a SECURITY DEFINER
-- function callable by anon and authenticated over /rest/v1/rpc. Event triggers
-- don't need EXECUTE to fire, so revoke it from the API roles.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
