-- Audit entry for every export of personal data (phase 4d). Records who
-- exported what (profile, format, filters, row count), never the data itself.
create function public.admin_log_export(
  p_profile text,
  p_format text,
  p_filters jsonb,
  p_row_count int
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.assert_admin();

  if p_profile is null or length(p_profile) > 50
     or p_format not in ('xlsx', 'csv')
     or p_row_count is null or p_row_count < 0
     or (p_filters is not null and jsonb_typeof(p_filters) <> 'object')
  then
    raise exception using errcode = 'PB103', message = 'INVALID_INPUT';
  end if;

  insert into public.audit_log (action, actor, entity_type, payload)
  values ('export', public.admin_actor(), 'export',
          jsonb_build_object('profile', p_profile, 'format', p_format,
                             'filters', coalesce(p_filters, '{}'::jsonb), 'row_count', p_row_count));
end;
$$;

revoke execute on function public.admin_log_export(text, text, jsonb, int) from public, anon, authenticated;
grant execute on function public.admin_log_export(text, text, jsonb, int) to authenticated;
