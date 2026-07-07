alter table private.wallet_login_nonces
  add column if not exists request_id text,
  add column if not exists provider text,
  add column if not exists message_base64 text,
  add column if not exists message_sha256 text;

create index if not exists idx_wallet_nonces_challenge_id
  on private.wallet_login_nonces(auth_user_id, id);
