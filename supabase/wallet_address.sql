-- TypeRush · asociar wallet en player_profiles (pestaña Tú)
--
-- PREREQUISITO: 0_init.sql aplicado.
-- Seguro de re-ejecutar.

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'player_profiles'
      and policyname = 'player_profiles_update_wallet_public'
  ) then
    create policy "player_profiles_update_wallet_public"
      on public.player_profiles
      for update
      using (true)
      with check (true);
  end if;
end
$$;
