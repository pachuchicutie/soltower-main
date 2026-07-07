create table if not exists public.quest_definitions (
  id text primary key,
  cadence text not null check (cadence in ('DAILY', 'WEEKLY', 'ACHIEVEMENT')),
  title text not null,
  description text not null,
  metric text not null,
  target_value integer not null default 1 check (target_value > 0),
  reward_earned_gold integer not null default 0 check (reward_earned_gold >= 0),
  reward_xp integer not null default 0 check (reward_xp >= 0),
  enabled boolean not null default true,
  requires_boss boolean not null default false,
  requires_party boolean not null default false,
  requires_full_party boolean not null default false,
  requires_skill_events boolean not null default false,
  sort_order integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_quest_assignments (
  id uuid primary key default gen_random_uuid(),
  player_id text not null references public.player_profiles(player_id) on delete cascade,
  quest_definition_id text not null references public.quest_definitions(id) on delete restrict,
  cadence text not null check (cadence in ('DAILY', 'WEEKLY')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  grace_until timestamptz not null,
  progress integer not null default 0 check (progress >= 0),
  target_value integer not null check (target_value > 0),
  completed_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(player_id, quest_definition_id, period_start)
);

create table if not exists public.quest_progress_events (
  id uuid primary key default gen_random_uuid(),
  player_id text not null references public.player_profiles(player_id) on delete cascade,
  assignment_id uuid not null references public.player_quest_assignments(id) on delete cascade,
  quest_definition_id text not null references public.quest_definitions(id) on delete restrict,
  source_type text not null,
  source_id text not null,
  amount integer not null check (amount > 0),
  idempotency_key text unique not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.player_achievements (
  player_id text not null references public.player_profiles(player_id) on delete cascade,
  achievement_id text not null references public.quest_definitions(id) on delete restrict,
  unlocked_at timestamptz,
  claimed_at timestamptz,
  source_type text,
  source_id text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(player_id, achievement_id)
);

create table if not exists public.quest_reward_claims (
  id uuid primary key default gen_random_uuid(),
  player_id text not null references public.player_profiles(player_id) on delete cascade,
  assignment_id uuid references public.player_quest_assignments(id) on delete cascade,
  achievement_id text references public.quest_definitions(id) on delete restrict,
  idempotency_key text unique not null,
  ledger_id uuid references public.economy_ledger(id) on delete set null,
  reward_earned_gold integer not null default 0,
  reward_xp integer not null default 0,
  created_at timestamptz not null default now(),
  check (assignment_id is not null or achievement_id is not null)
);

create unique index if not exists idx_quest_reward_claim_assignment
  on public.quest_reward_claims(assignment_id)
  where assignment_id is not null;

create unique index if not exists idx_quest_reward_claim_achievement
  on public.quest_reward_claims(player_id, achievement_id)
  where achievement_id is not null;

create index if not exists idx_quest_assignments_player_period
  on public.player_quest_assignments(player_id, cadence, period_start desc);
create index if not exists idx_quest_progress_assignment
  on public.quest_progress_events(assignment_id, created_at desc);
create index if not exists idx_player_achievements_player
  on public.player_achievements(player_id, achievement_id);

alter table public.quest_definitions enable row level security;
alter table public.player_quest_assignments enable row level security;
alter table public.quest_progress_events enable row level security;
alter table public.player_achievements enable row level security;
alter table public.quest_reward_claims enable row level security;

create policy "quest definitions are readable"
  on public.quest_definitions for select
  using (enabled);

create policy "players can read own quest assignments"
  on public.player_quest_assignments for select
  using (exists (
    select 1 from public.player_profiles p
    where p.player_id = player_quest_assignments.player_id and p.auth_user_id = auth.uid()
  ));

create policy "players can read own quest progress events"
  on public.quest_progress_events for select
  using (exists (
    select 1 from public.player_profiles p
    where p.player_id = quest_progress_events.player_id and p.auth_user_id = auth.uid()
  ));

create policy "players can read own achievements"
  on public.player_achievements for select
  using (exists (
    select 1 from public.player_profiles p
    where p.player_id = player_achievements.player_id and p.auth_user_id = auth.uid()
  ));

create policy "players can read own quest reward claims"
  on public.quest_reward_claims for select
  using (exists (
    select 1 from public.player_profiles p
    where p.player_id = quest_reward_claims.player_id and p.auth_user_id = auth.uid()
  ));

insert into public.quest_definitions(
  id,
  cadence,
  title,
  description,
  metric,
  target_value,
  reward_earned_gold,
  reward_xp,
  requires_boss,
  requires_party,
  requires_full_party,
  requires_skill_events,
  sort_order,
  config
)
values
  ('daily-first-defense', 'DAILY', 'First Defense', 'Complete 1 raid.', 'raid_completed', 1, 10, 60, false, false, false, false, 10, '{}'::jsonb),
  ('daily-tower-watch', 'DAILY', 'Tower Watch', 'Clear 12 total waves across raids.', 'waves_cleared', 12, 10, 70, false, false, false, false, 20, '{}'::jsonb),
  ('daily-party-up', 'DAILY', 'Party Up', 'Complete 2 raids with at least 2 active players.', 'party_raid_completed', 2, 15, 90, false, true, false, false, 30, '{}'::jsonb),
  ('daily-skill-in-motion', 'DAILY', 'Skill in Motion', 'Use active Hero skills 8 times in raids.', 'skill_uses', 8, 10, 70, false, false, false, true, 40, '{}'::jsonb),
  ('daily-bossbound', 'DAILY', 'Bossbound', 'Defeat 1 raid boss.', 'boss_defeated', 1, 15, 100, true, false, false, false, 50, '{}'::jsonb),
  ('daily-steady-defender', 'DAILY', 'Steady Defender', 'Finish 1 raid without being flagged AFK.', 'non_afk_raid_completed', 1, 10, 60, false, false, false, false, 60, '{}'::jsonb),
  ('weekly-full-crew', 'WEEKLY', 'Full Crew', 'Complete 3 raids with a full active party of 4 players.', 'full_party_raid_completed', 3, 50, 350, false, true, true, false, 110, '{}'::jsonb),
  ('weekly-tower-vanguard', 'WEEKLY', 'Tower Vanguard', 'Complete 5 raids during the week.', 'raid_completed', 5, 40, 300, false, false, false, false, 120, '{}'::jsonb),
  ('weekly-veteran-solbloom', 'WEEKLY', 'Veteran of SolBloom', 'Defeat 3 raid bosses during the week.', 'boss_defeated', 3, 50, 400, true, false, false, false, 130, '{}'::jsonb),
  ('achievement-first-steps', 'ACHIEVEMENT', 'First Steps', 'Complete your first raid.', 'first_raid_completed', 1, 0, 0, false, false, false, false, 210, '{}'::jsonb),
  ('achievement-party-starter', 'ACHIEVEMENT', 'Party Starter', 'Complete your first party raid.', 'first_party_raid_completed', 1, 0, 0, false, true, false, false, 220, '{}'::jsonb),
  ('achievement-full-house', 'ACHIEVEMENT', 'Full House', 'Complete your first full 4-player raid.', 'first_full_party_raid_completed', 1, 0, 0, false, true, true, false, 230, '{}'::jsonb),
  ('achievement-tower-climber', 'ACHIEVEMENT', 'Tower Climber', 'Unlock Tower 1-2.', 'unlock_tower_1_2', 1, 0, 0, false, false, false, false, 240, '{}'::jsonb),
  ('achievement-tower-veteran', 'ACHIEVEMENT', 'Tower Veteran', 'Unlock Tower 1-3.', 'unlock_tower_1_3', 1, 0, 0, false, false, false, false, 250, '{}'::jsonb),
  ('achievement-gear-up', 'ACHIEVEMENT', 'Gear Up', 'Equip your first non-starter item.', 'equip_non_starter_item', 1, 0, 0, false, false, false, false, 260, '{}'::jsonb),
  ('achievement-social-spark', 'ACHIEVEMENT', 'Social Spark', 'Add your first friend.', 'first_friend_added', 1, 0, 0, false, false, false, false, 270, '{}'::jsonb)
on conflict (id) do update
set
  cadence = excluded.cadence,
  title = excluded.title,
  description = excluded.description,
  metric = excluded.metric,
  target_value = excluded.target_value,
  reward_earned_gold = excluded.reward_earned_gold,
  reward_xp = excluded.reward_xp,
  enabled = true,
  requires_boss = excluded.requires_boss,
  requires_party = excluded.requires_party,
  requires_full_party = excluded.requires_full_party,
  requires_skill_events = excluded.requires_skill_events,
  sort_order = excluded.sort_order,
  config = excluded.config,
  updated_at = now();

create or replace function private.record_quest_progress(
  p_player_id text,
  p_assignment_id uuid,
  p_source_type text,
  p_source_id text,
  p_amount integer,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_assignment public.player_quest_assignments%rowtype;
  v_event public.quest_progress_events%rowtype;
  v_next_progress integer;
begin
  if p_amount <= 0 then
    raise exception 'Quest progress amount must be positive';
  end if;

  select * into v_assignment
  from public.player_quest_assignments
  where id = p_assignment_id and player_id = p_player_id
  for update;

  if not found then
    raise exception 'Quest assignment not found';
  end if;

  if v_assignment.claimed_at is not null then
    return jsonb_build_object('assignmentId', v_assignment.id, 'duplicate', false, 'claimed', true);
  end if;

  insert into public.quest_progress_events(
    player_id,
    assignment_id,
    quest_definition_id,
    source_type,
    source_id,
    amount,
    idempotency_key,
    metadata
  )
  values (
    p_player_id,
    p_assignment_id,
    v_assignment.quest_definition_id,
    p_source_type,
    p_source_id,
    p_amount,
    p_idempotency_key,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (idempotency_key) do nothing
  returning * into v_event;

  if not found then
    return jsonb_build_object('assignmentId', v_assignment.id, 'duplicate', true);
  end if;

  v_next_progress := least(v_assignment.progress + p_amount, v_assignment.target_value);

  update public.player_quest_assignments
  set
    progress = v_next_progress,
    completed_at = case
      when v_next_progress >= target_value and completed_at is null then now()
      else completed_at
    end,
    updated_at = now()
  where id = v_assignment.id
  returning * into v_assignment;

  return to_jsonb(v_assignment);
end;
$$;

create or replace function private.claim_player_quest_reward(
  p_auth_user_id uuid,
  p_assignment_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id text;
  v_assignment record;
  v_existing_claim public.quest_reward_claims%rowtype;
  v_claim public.quest_reward_claims%rowtype;
  v_ledger jsonb := null;
begin
  select player_id into v_player_id
  from public.player_profiles
  where auth_user_id = p_auth_user_id;

  if v_player_id is null then
    raise exception 'Player profile required';
  end if;

  select * into v_existing_claim
  from public.quest_reward_claims
  where idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object('claim', to_jsonb(v_existing_claim), 'idempotent', true);
  end if;

  select
    a.*,
    d.title,
    d.reward_earned_gold,
    d.reward_xp
  into v_assignment
  from public.player_quest_assignments a
  join public.quest_definitions d on d.id = a.quest_definition_id
  where a.id = p_assignment_id and a.player_id = v_player_id
  for update of a;

  if not found then
    raise exception 'Quest assignment not found';
  end if;

  if v_assignment.completed_at is null then
    raise exception 'Quest is not complete';
  end if;

  if v_assignment.claimed_at is not null then
    select * into v_existing_claim
    from public.quest_reward_claims
    where assignment_id = p_assignment_id;

    return jsonb_build_object('claim', to_jsonb(v_existing_claim), 'alreadyClaimed', true);
  end if;

  if v_assignment.reward_earned_gold > 0 then
    v_ledger := private.apply_balance_delta(
      v_player_id,
      'EARNED_GOLD',
      'QUEST_REWARD',
      'CREDIT',
      v_assignment.reward_earned_gold,
      'Quest reward: ' || v_assignment.title,
      p_idempotency_key || ':earned-gold',
      'quest_assignment',
      p_assignment_id::text,
      jsonb_build_object('questDefinitionId', v_assignment.quest_definition_id)
    );
  end if;

  if v_assignment.reward_xp > 0 then
    update public.player_profiles
    set xp = xp + v_assignment.reward_xp, updated_at = now()
    where player_id = v_player_id;
  end if;

  update public.player_quest_assignments
  set claimed_at = now(), updated_at = now()
  where id = p_assignment_id;

  insert into public.quest_reward_claims(
    player_id,
    assignment_id,
    idempotency_key,
    ledger_id,
    reward_earned_gold,
    reward_xp
  )
  values (
    v_player_id,
    p_assignment_id,
    p_idempotency_key,
    nullif(v_ledger->>'id', '')::uuid,
    v_assignment.reward_earned_gold,
    v_assignment.reward_xp
  )
  returning * into v_claim;

  return jsonb_build_object('claim', to_jsonb(v_claim), 'ledger', v_ledger, 'claimed', true);
end;
$$;

create or replace function private.claim_player_achievement(
  p_auth_user_id uuid,
  p_achievement_id text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_player_id text;
  v_achievement public.player_achievements%rowtype;
  v_existing_claim public.quest_reward_claims%rowtype;
  v_claim public.quest_reward_claims%rowtype;
begin
  select player_id into v_player_id
  from public.player_profiles
  where auth_user_id = p_auth_user_id;

  if v_player_id is null then
    raise exception 'Player profile required';
  end if;

  select * into v_existing_claim
  from public.quest_reward_claims
  where idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object('claim', to_jsonb(v_existing_claim), 'idempotent', true);
  end if;

  select * into v_achievement
  from public.player_achievements
  where player_id = v_player_id and achievement_id = p_achievement_id
  for update;

  if not found or v_achievement.unlocked_at is null then
    raise exception 'Achievement is not unlocked';
  end if;

  if v_achievement.claimed_at is not null then
    select * into v_existing_claim
    from public.quest_reward_claims
    where player_id = v_player_id and achievement_id = p_achievement_id;

    return jsonb_build_object('claim', to_jsonb(v_existing_claim), 'alreadyClaimed', true);
  end if;

  update public.player_achievements
  set claimed_at = now(), updated_at = now()
  where player_id = v_player_id and achievement_id = p_achievement_id
  returning * into v_achievement;

  insert into public.quest_reward_claims(
    player_id,
    achievement_id,
    idempotency_key,
    reward_earned_gold,
    reward_xp
  )
  values (v_player_id, p_achievement_id, p_idempotency_key, 0, 0)
  returning * into v_claim;

  return jsonb_build_object('claim', to_jsonb(v_claim), 'achievement', to_jsonb(v_achievement), 'claimed', true);
end;
$$;

revoke all on function private.record_quest_progress(text, uuid, text, text, integer, text, jsonb) from public, anon, authenticated;
revoke all on function private.claim_player_quest_reward(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.claim_player_achievement(uuid, text, text) from public, anon, authenticated;

grant execute on function private.record_quest_progress(text, uuid, text, text, integer, text, jsonb) to service_role;
grant execute on function private.claim_player_quest_reward(uuid, uuid, text) to service_role;
grant execute on function private.claim_player_achievement(uuid, text, text) to service_role;
