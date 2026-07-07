alter table public.chat_messages
  add column if not exists town_channel text not null default 'solbloom-1';

alter table public.player_presence
  alter column town_channel set default 'solbloom-1';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chat_messages_town_channel_check'
      and conrelid = 'public.chat_messages'::regclass
  ) then
    alter table public.chat_messages
      add constraint chat_messages_town_channel_check
      check (town_channel in ('solbloom-1', 'solbloom-2', 'solbloom-3', 'solbloom-4', 'solbloom-5'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'player_presence_town_channel_check'
      and conrelid = 'public.player_presence'::regclass
  ) then
    alter table public.player_presence
      add constraint player_presence_town_channel_check
      check (town_channel in ('solbloom-1', 'solbloom-2', 'solbloom-3', 'solbloom-4', 'solbloom-5'));
  end if;
end $$;

create index if not exists idx_chat_town_channel_created
  on public.chat_messages(town_channel, created_at desc)
  where moderation_state = 'VISIBLE';

create index if not exists idx_player_presence_town_channel
  on public.player_presence(town_channel, presence_status, last_seen_at desc);
