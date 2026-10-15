-- Rate limiting for the extract-letter function (abuse and cost protection).
--
-- Privacy: buckets are either "global" or a keyed hash of the client IP and the day,
-- computed in the function; raw IP addresses are never stored. Windows older than one
-- day are deleted on every call.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.rate_limit_counters (
  bucket text not null check (char_length(bucket) <= 100),
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (bucket, window_start)
);

create index rate_limit_counters_window_start_idx on private.rate_limit_counters (window_start);

-- Counts one request in the current window of `p_window_seconds` and returns whether the
-- bucket is still within `p_limit`. Only the edge function (service role) may call it.
create or replace function public.consume_rate_limit(
  p_bucket text,
  p_window_seconds integer,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  if p_window_seconds is null or p_window_seconds <= 0 or p_limit is null or p_limit < 0 then
    raise exception 'invalid rate limit parameters';
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into private.rate_limit_counters as c (bucket, window_start, count)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set count = c.count + 1
  returning c.count into v_count;

  delete from private.rate_limit_counters where window_start < now() - interval '1 day';

  return v_count <= p_limit;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
