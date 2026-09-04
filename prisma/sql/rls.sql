-- ============================================================================
-- TASKFLOW — Row-Level Security (RLS)
-- ----------------------------------------------------------------------------
-- Defense-in-depth multi-tenancy at the PostgreSQL layer, independent of the
-- application. Even if an API key / direct DB connection is leaked, RLS rows
-- are invisible outside the current tenant context.
--
-- HOW IT WORKS
--   1. Every tenant-scoped table carries a `workspace_id` UUID column.
--   2. The application sets a per-connection/transaction tenant context:
--        BEGIN;
--        SELECT app.set_workspace_context('<workspace_id>', '<user_id>');
--        ... application queries ...
--        COMMIT;
--   3. Policies filter by comparing `workspace_id` to the context, and the
--      membership table guarantees the caller is (still) a member.
--
-- SUPABASE VARIANT
--   If you run inside Supabase you can bind the context directly from JWT
--   claims instead of a session variable:
--       SELECT current_setting('request.jwt.claims', true)::jsonb
--             ->> 'workspace_id';
--   Custom claims are set server-side when issuing the session token.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Context helpers
-- ---------------------------------------------------------------------------

drop schema if exists app cascade;
create schema app;

create or replace function app.current_workspace_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.workspace_id', true), '')::uuid;
$$;

create or replace function app.current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.user_id', true), '')::uuid;
$$;

create or replace function app.set_workspace_context(workspace_uuid text, user_uuid text default null)
returns void
language plpgsql
security definer
as $$
begin
  perform set_config('app.workspace_id', workspace_uuid, true);
  if user_uuid is not null then
    perform set_config('app.user_id', user_uuid, true);
  end if;
end;
$$;

-- Intentionally permissive guard used by UNRESTRICTED roles (service account).
create or replace function app.is_workspace_member()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1
    from workspace_members wm
    where wm.workspace_id = app.current_workspace_id()
      and wm.user_id = app.current_user_id()
      and wm.status = 'ACTIVE'
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Generic policy templates
-- ---------------------------------------------------------------------------

-- Tenant-row policy: rows of THIS table belong to the current workspace.
-- Usage: `select app.enable_tenant_isolation('tasks')` (see block 4).

create or replace function app.enable_tenant_isolation(p_table text, workspace_col text default 'workspace_id')
returns void
language plpgsql
security definer
as $$
begin
  execute format(
    'alter table %I enable row level security', p_table
  );
  execute format(
    'drop policy if exists %I on %I', p_table || '_tenant_isolation', p_table
  );
  execute format(
    $$create policy %I on %I
      for all
      to authenticated
      using (%I = app.current_workspace_id() and app.is_workspace_member())
      with check (%I = app.current_workspace_id() and app.is_workspace_member())$$,
    p_table || '_tenant_isolation', p_table, workspace_col, workspace_col
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Users & cross-tenant tables (identity is globally visible)
-- ---------------------------------------------------------------------------

alter table users enable row level security;

drop policy if exists users_self_access on users;
create policy users_self_access on users
  for all
  to authenticated
  using (id = app.current_user_id())
  with check (id = app.current_user_id());

alter table accounts enable row level security;
alter table sessions enable row level security;
alter table verification_tokens enable row level security;

drop policy if exists sessions_self_access on sessions;
create policy sessions_self_access on sessions
  for all
  to authenticated
  using (user_id = app.current_user_id())
  with check (user_id = app.current_user_id());

drop policy if exists accounts_self_access on accounts;
create policy accounts_self_access on accounts
  for all
  to authenticated
  using (user_id = app.current_user_id())
  with check (user_id = app.current_user_id());

-- ---------------------------------------------------------------------------
-- 4. Tenant-scoped tables
--    Members can only ever see one workspace. A non-member gets ZERO rows.
-- ---------------------------------------------------------------------------

select app.enable_tenant_isolation('workspace_members');
select app.enable_tenant_isolation('invitations');
select app.enable_tenant_isolation('projects');
select app.enable_tenant_isolation('status_columns');
select app.enable_tenant_isolation('project_tags');
select app.enable_tenant_isolation('tasks');
select app.enable_tenant_isolation('task_assignments');
select app.enable_tenant_isolation('task_tag_relations');
select app.enable_tenant_isolation('task_mentions');
select app.enable_tenant_isolation('comments');
select app.enable_tenant_isolation('attachments');
select app.enable_tenant_isolation('time_entries');
select app.enable_tenant_isolation('active_timers');
select app.enable_tenant_isolation('notifications');
select app.enable_tenant_isolation('subscriptions');
select app.enable_tenant_isolation('billing_events');
select app.enable_tenant_isolation('activity_logs');
select app.enable_tenant_isolation('clients');
select app.enable_tenant_isolation('invoices');
select app.enable_tenant_isolation('invoice_items');
select app.enable_tenant_isolation('ai_conversations');
select app.enable_tenant_isolation('ai_messages');

-- Workspaces themselves: visible only to their active members (or the owner).
alter table workspaces enable row level security;

drop policy if exists workspaces_member_access on workspaces;
create policy workspaces_member_access on workspaces
  for all
  to authenticated
  using (
    id = app.current_workspace_id()
    and (
      exists (
        select 1 from workspace_members wm
        where wm.workspace_id = workspaces.id
          and wm.user_id = app.current_user_id()
          and wm.status = 'ACTIVE'
      )
      or workspaces.owner_id = app.current_user_id()
    )
  )
  with check (
    workspaces.owner_id = app.current_user_id()
  );

-- ---------------------------------------------------------------------------
-- 5. Optional: read-only enforcement per RLS policy is NOT sufficient.
--    Defense in depth also means the application NEVER trusts the client
--    for `workspace_id` — see src/services/* asserting membership first.
-- ---------------------------------------------------------------------------