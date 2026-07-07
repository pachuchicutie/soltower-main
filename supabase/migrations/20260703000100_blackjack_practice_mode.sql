alter table private.blackjack_hands
  add column if not exists practice_mode boolean not null default false;

alter table private.blackjack_hands
  drop constraint if exists blackjack_hands_bet_check,
  drop constraint if exists blackjack_hands_total_wager_check;

alter table private.blackjack_hands
  add constraint blackjack_hands_bet_check check (
    (practice_mode = true and bet = 0)
    or
    (practice_mode = false and bet > 0)
  ),
  add constraint blackjack_hands_total_wager_check check (
    (practice_mode = true and total_wager = 0)
    or
    (practice_mode = false and total_wager > 0)
  );

comment on column private.blackjack_hands.practice_mode is
  'Non-production-only zero-wager hand. Practice hands never debit or credit economy balances.';
