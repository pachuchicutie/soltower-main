-- Mark the town Starlight Vault building ready now that the production local asset exists.
update public.manual_asset_registry
set asset_path = '/assets/soltower/environment/structures/starlight-vault.png',
    asset_status = 'ready',
    enabled_for_player_use = true,
    missing_assets = '{}'::text[],
    updated_at = now()
where id = 'town-starlight-vault-building';
