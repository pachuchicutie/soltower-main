-- Rebalance repeatable quest Earned Gold to avoid DEV economy inflation.
-- Quest definitions are the server-side reward configuration consumed by Edge Functions.

with reward_config(id, reward_earned_gold, reward_xp) as (
  values
    ('daily-first-defense', 4, 60),
    ('daily-tower-watch', 5, 70),
    ('daily-party-up', 6, 90),
    ('daily-skill-in-motion', 4, 65),
    ('daily-bossbound', 6, 100),
    ('daily-steady-defender', 4, 60),
    ('weekly-full-crew', 20, 300),
    ('weekly-tower-vanguard', 18, 260),
    ('weekly-veteran-solbloom', 22, 340)
)
update public.quest_definitions q
set
  reward_earned_gold = c.reward_earned_gold,
  reward_xp = c.reward_xp,
  config = coalesce(q.config, '{}'::jsonb) || jsonb_build_object(
    'balanceVersion',
    '2026-06-29-conservative-repeatable-quest-rewards'
  )
from reward_config c
where q.id = c.id;
