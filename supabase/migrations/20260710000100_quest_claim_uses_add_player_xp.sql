-- Route quest XP claims through private.add_player_xp so level-ups always apply
-- and awards are recorded in the append-only XP ledger.

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
  v_xp_result record;
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
    select * into v_xp_result
    from private.add_player_xp(
      v_player_id,
      v_assignment.reward_xp,
      p_idempotency_key || ':xp',
      'QUEST_REWARD',
      'quest_assignment',
      p_assignment_id::text
    );
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

  return jsonb_build_object(
    'claim', to_jsonb(v_claim),
    'ledger', v_ledger,
    'xp', case
      when v_xp_result is null then null
      else jsonb_build_object(
        'accountLevel', v_xp_result.account_level,
        'xp', v_xp_result.xp,
        'applied', v_xp_result.applied
      )
    end,
    'claimed', true
  );
end;
$$;

revoke all on function private.claim_player_quest_reward(uuid, uuid, text) from public, anon, authenticated;
grant execute on function private.claim_player_quest_reward(uuid, uuid, text) to service_role;
