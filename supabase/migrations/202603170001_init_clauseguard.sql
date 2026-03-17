create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'industry_type') then
    create type industry_type as enum ('saas', 'manufacturing', 'realestate', 'service', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'plan_type') then
    create type plan_type as enum ('free', 'starter', 'professional', 'team');
  end if;
  if not exists (select 1 from pg_type where typname = 'org_role') then
    create type org_role as enum ('owner', 'admin', 'member', 'viewer');
  end if;
  if not exists (select 1 from pg_type where typname = 'member_status') then
    create type member_status as enum ('active', 'pending', 'deactivated');
  end if;
  if not exists (select 1 from pg_type where typname = 'auth_provider') then
    create type auth_provider as enum ('email', 'google');
  end if;
  if not exists (select 1 from pg_type where typname = 'role_preference') then
    create type role_preference as enum ('executive', 'legal', 'sales', 'freelancer');
  end if;
  if not exists (select 1 from pg_type where typname = 'file_type') then
    create type file_type as enum ('pdf', 'docx', 'hwp');
  end if;
  if not exists (select 1 from pg_type where typname = 'contract_status') then
    create type contract_status as enum ('uploaded', 'parsing', 'analyzing', 'completed', 'failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'risk_level') then
    create type risk_level as enum ('high', 'medium', 'low');
  end if;
  if not exists (select 1 from pg_type where typname = 'contract_type') then
    create type contract_type as enum ('subscription', 'nda', 'service', 'partnership', 'lease', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'party_position') then
    create type party_position as enum ('provider', 'consumer');
  end if;
  if not exists (select 1 from pg_type where typname = 'analysis_status') then
    create type analysis_status as enum ('parsing', 'classifying', 'risk_analyzing', 'suggesting', 'reporting', 'completed', 'failed');
  end if;
  if not exists (select 1 from pg_type where typname = 'clause_category') then
    create type clause_category as enum ('liability', 'termination', 'renewal', 'ip', 'indemnity', 'confidentiality', 'payment', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'share_scope') then
    create type share_scope as enum ('full_report', 'high_risk_only');
  end if;
  if not exists (select 1 from pg_type where typname = 'subscription_status') then
    create type subscription_status as enum ('active', 'past_due', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'billing_cycle') then
    create type billing_cycle as enum ('monthly', 'annual');
  end if;
  if not exists (select 1 from pg_type where typname = 'audit_action') then
    create type audit_action as enum ('upload', 'analyze', 'export', 'delete', 'share', 'invite', 'role_change', 'login', 'settings_change');
  end if;
  if not exists (select 1 from pg_type where typname = 'document_language') then
    create type document_language as enum ('ko', 'en', 'mixed');
  end if;
  if not exists (select 1 from pg_type where typname = 'user_language') then
    create type user_language as enum ('ko', 'en');
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name varchar(200) not null,
  industry industry_type not null default 'other',
  plan plan_type not null default 'free',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.users (
  id uuid primary key,
  email varchar(320) not null unique,
  name varchar(100) not null,
  auth_provider auth_provider not null default 'email',
  role_preference role_preference null,
  mfa_enabled boolean not null default false,
  mfa_secret varchar(256) null,
  language user_language not null default 'ko',
  created_at timestamptz not null default timezone('utc', now()),
  last_login_at timestamptz null
);

create table if not exists public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid null references public.users(id) on delete cascade,
  role org_role not null default 'member',
  invited_at timestamptz not null default timezone('utc', now()),
  joined_at timestamptz null,
  status member_status not null default 'pending',
  invite_email varchar(320) null,
  invite_token varchar(64) null unique
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  uploaded_by uuid not null references public.users(id) on delete restrict,
  file_name varchar(500) not null,
  file_type file_type not null,
  file_size_bytes bigint not null,
  file_storage_key varchar(1024) not null,
  page_count integer null,
  language document_language null,
  industry industry_type not null,
  contract_type contract_type not null,
  party_position party_position not null default 'provider',
  status contract_status not null default 'uploaded',
  overall_risk_score integer null,
  risk_level risk_level null,
  template_id uuid null,
  expires_at timestamptz not null,
  deleted_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  status analysis_status not null default 'parsing',
  progress_pct integer not null default 0 check (progress_pct >= 0 and progress_pct <= 100),
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz null,
  duration_ms integer null,
  model_version varchar(50) not null default 'claude-3-5-sonnet',
  error_message text null,
  focus_areas jsonb null
);

create table if not exists public.clauses (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  clause_number varchar(20) not null,
  page integer not null,
  category clause_category not null,
  original_text text not null,
  summary text not null,
  order_index integer not null default 0
);

create table if not exists public.risks (
  id uuid primary key default gen_random_uuid(),
  clause_id uuid not null references public.clauses(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  severity risk_level not null,
  risk_type varchar(100) not null,
  title varchar(300) not null,
  description text not null,
  industry_benchmark text null,
  benchmark_pct integer null,
  order_index integer not null default 0
);

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  risk_id uuid not null references public.risks(id) on delete cascade,
  suggested_text text not null,
  change_rationale text not null,
  negotiation_tip text null,
  accepted boolean null
);

create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid null references public.organizations(id) on delete cascade,
  name varchar(200) not null,
  industry industry_type not null,
  contract_type contract_type not null,
  is_system boolean not null default false,
  base_template_id uuid null references public.templates(id) on delete set null,
  rule_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.template_rules (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  clause_category clause_category not null,
  rule_description text not null,
  severity_if_violated risk_level not null,
  benchmark_text text null,
  order_index integer not null default 0
);

create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete cascade,
  token varchar(64) not null unique,
  recipient_email varchar(320) null,
  scope share_scope not null default 'full_report',
  expires_at timestamptz not null,
  accessed_at timestamptz null
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations(id) on delete cascade,
  plan plan_type not null,
  status subscription_status not null default 'active',
  billing_cycle billing_cycle not null,
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  stripe_customer_id varchar(255) not null,
  stripe_subscription_id varchar(255) not null,
  seat_limit integer not null default 1,
  api_call_limit integer null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  action audit_action not null,
  resource_type varchar(50) not null,
  resource_id uuid not null,
  metadata jsonb null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  key text not null,
  key_prefix varchar(32) not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_org_members_org_id on public.org_members(org_id);
create index if not exists idx_org_members_user_id on public.org_members(user_id);
create index if not exists idx_contracts_org_id on public.contracts(org_id);
create index if not exists idx_contracts_created_at on public.contracts(created_at desc);
create index if not exists idx_contracts_status on public.contracts(status);
create index if not exists idx_analyses_contract_id on public.analyses(contract_id);
create index if not exists idx_clauses_contract_id on public.clauses(contract_id);
create index if not exists idx_risks_contract_id on public.risks(contract_id);
create index if not exists idx_suggestions_risk_id on public.suggestions(risk_id);
create index if not exists idx_templates_org_id on public.templates(org_id);
create index if not exists idx_share_links_contract_id on public.share_links(contract_id);
create index if not exists idx_audit_logs_org_id_created_at on public.audit_logs(org_id, created_at desc);

drop trigger if exists set_organizations_updated_at on public.organizations;
create trigger set_organizations_updated_at
before update on public.organizations
for each row execute procedure public.set_updated_at();

drop trigger if exists set_templates_updated_at on public.templates;
create trigger set_templates_updated_at
before update on public.templates
for each row execute procedure public.set_updated_at();

drop trigger if exists set_subscriptions_updated_at on public.subscriptions;
create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row execute procedure public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.org_members enable row level security;
alter table public.contracts enable row level security;
alter table public.analyses enable row level security;
alter table public.clauses enable row level security;
alter table public.risks enable row level security;
alter table public.suggestions enable row level security;
alter table public.templates enable row level security;
alter table public.template_rules enable row level security;
alter table public.share_links enable row level security;
alter table public.subscriptions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.api_keys enable row level security;

insert into storage.buckets (id, name, public)
values
  ('contracts', 'contracts', false),
  ('reports', 'reports', false)
on conflict (id) do nothing;
