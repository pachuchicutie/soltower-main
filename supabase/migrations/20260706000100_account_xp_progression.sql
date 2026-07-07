create table if not exists private.player_xp_ledger (
  id uuid primary key default gen_random_uuid(),
  player_id text not null references public.player_profiles(player_id),
  source_type text not null,
  xp_amount integer not null check (xp_amount > 0),
  before_account_level integer not null,
  before_xp integer not null,
  after_account_level integer not null,
  after_xp integer not null,
  idempotency_key text not null unique,
  reference_entity_type text,
  reference_entity_id text,
  created_at timestamptz not null default now()
);

comment on table private.player_xp_ledger is
  'Append-only account XP awards with before/after progression snapshots.';

create or replace function private.reject_player_xp_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Player XP ledger entries are append-only';
end;
$$;

drop trigger if exists reject_player_xp_ledger_mutation_trigger on private.player_xp_ledger;
create trigger reject_player_xp_ledger_mutation_trigger
before update or delete on private.player_xp_ledger
for each row
execute function private.reject_player_xp_ledger_mutation();

create or replace function private.normalize_player_profile_xp()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  required_xp integer;
begin
  new.account_level := greatest(coalesce(new.account_level, 1), 1);
  new.xp := greatest(coalesce(new.xp, 0), 0);

  loop
    required_xp := 100 + ((new.account_level - 1) * 50);
    exit when new.xp < required_xp;
    new.xp := new.xp - required_xp;
    new.account_level := new.account_level + 1;
  end loop;

  return new;
end;
$$;

drop trigger if exists normalize_player_profile_xp_trigger on public.player_profiles;
create trigger normalize_player_profile_xp_trigger
before insert or update of xp, account_level on public.player_profiles
for each row
execute function private.normalize_player_profile_xp();

create or replace function private.add_player_xp(
  p_player_id text,
  p_reward_xp integer,
  p_idempotency_key text,
  p_source_type text,
  p_reference_entity_type text default null,
  p_reference_entity_id text default null
)
returns table (
  account_level integer,
  xp integer,
  applied boolean
)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  before_level integer;
  before_xp integer;
  after_level integer;
  after_xp integer;
begin
  if p_reward_xp <= 0 then
    raise exception 'XP reward must be positive';
  end if;

  select ledger.after_account_level, ledger.after_xp
    into after_level, after_xp
  from private.player_xp_ledger ledger
  where ledger.idempotency_key = p_idempotency_key;

  if found then
    return query select after_level, after_xp, false;
    return;
  end if;

  select profile.account_level, profile.xp
    into before_level, before_xp
  from public.player_profiles profile
  where profile.player_id = p_player_id
  for update;

  if not found then
    raise exception 'Player profile not found';
  end if;

  select ledger.after_account_level, ledger.after_xp
    into after_level, after_xp
  from private.player_xp_ledger ledger
  where ledger.idempotency_key = p_idempotency_key;

  if found then
    return query select after_level, after_xp, false;
    return;
  end if;

  update public.player_profiles profile
  set
    xp = profile.xp + p_reward_xp,
    updated_at = now()
  where profile.player_id = p_player_id
  returning profile.account_level, profile.xp
    into after_level, after_xp;

  insert into private.player_xp_ledger (
    player_id,
    source_type,
    xp_amount,
    before_account_level,
    before_xp,
    after_account_level,
    after_xp,
    idempotency_key,
    reference_entity_type,
    reference_entity_id
  )
  values (
    p_player_id,
    p_source_type,
    p_reward_xp,
    before_level,
    before_xp,
    after_level,
    after_xp,
    p_idempotency_key,
    p_reference_entity_type,
    p_reference_entity_id
  );

  return query select after_level, after_xp, true;
end;
$$;

revoke all on private.player_xp_ledger from public, anon, authenticated;
revoke all on function private.add_player_xp(text, integer, text, text, text, text)
  from public, anon, authenticated;
grant execute on function private.add_player_xp(text, integer, text, text, text, text)
  to service_role;

update public.player_profiles
set
  xp = xp,
  account_level = account_level;
