-- =====================================================================
-- Mejengas: seguridad y tiempo real
--
-- Antes de ejecutarlo:
--   Authentication > Sign In / Providers > activar "Allow anonymous sign-ins".
-- Después de ejecutarlo, en una consulta aparte del SQL Editor:
--   select private.definir_password('TU-CLAVE-NUEVA');
-- No guardes esa clave en este archivo: el repositorio es público.
--
-- Se puede ejecutar más de una vez.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Datos privados: el navegador no puede leerlos
-- ---------------------------------------------------------------------
create table if not exists private.admin (
    id            int primary key default 1 check (id = 1),
    password_hash text not null
);

-- Vive fuera de "jugadores" para que quitarse no reinicie la espera.
create table if not exists private.esperas (
    user_id        uuid primary key,
    ultimo_registro timestamptz not null
);

-- Dispositivos que abrieron la lista con la clave: pueden crear una nueva.
create table if not exists private.admins (
    user_id uuid primary key
);

create or replace function private.definir_password(p_password text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
    if p_password is null or length(p_password) < 8 then
        raise exception 'La clave debe tener al menos 8 caracteres';
    end if;

    insert into private.admin (id, password_hash)
    values (1, extensions.crypt(p_password, extensions.gen_salt('bf', 10)))
    on conflict (id) do update set password_hash = excluded.password_hash;

    return 'Clave actualizada';
end;
$$;

create or replace function private.password_valida(p_password text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(
        (select password_hash = extensions.crypt(coalesce(p_password, ''), password_hash)
         from private.admin where id = 1),
        false
    );
$$;

-- ---------------------------------------------------------------------
-- Tabla de jugadores
-- ---------------------------------------------------------------------
alter table public.jugadores add column if not exists user_id uuid;
alter table public.jugadores alter column user_id set default auth.uid();
-- device_id era visible para todos, así que no servía para probar identidad.
alter table public.jugadores drop column if exists device_id;

-- ---------------------------------------------------------------------
-- Permisos: el navegador solo lee. Todo cambio pasa por las funciones.
-- ---------------------------------------------------------------------
alter table public.jugadores     enable row level security;
alter table public.historial     enable row level security;
alter table public.configuracion enable row level security;

-- Las políticas anteriores se suman a las nuevas, por eso se eliminan.
do $$
declare
    p record;
begin
    for p in
        select schemaname, tablename, policyname
        from pg_policies
        where schemaname = 'public'
          and tablename in ('jugadores', 'historial', 'configuracion')
    loop
        execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    end loop;
end;
$$;

create policy lectura_publica on public.jugadores     for select to anon, authenticated using (true);
create policy lectura_publica on public.historial     for select to anon, authenticated using (true);
create policy lectura_publica on public.configuracion for select to anon, authenticated using (true);

revoke all on public.jugadores, public.historial, public.configuracion from anon, authenticated;
grant select on public.jugadores, public.historial, public.configuracion to anon, authenticated;

-- ---------------------------------------------------------------------
-- Funciones que usa la app
-- ---------------------------------------------------------------------
create or replace function public.segundos_espera()
returns int
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(
        (select greatest(0, ceil(60 - extract(epoch from (now() - ultimo_registro))))::int
         from private.esperas where user_id = auth.uid()),
        0
    );
$$;

create or replace function public.anotar_jugador(p_nombre text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user   uuid := auth.uid();
    v_nombre text := regexp_replace(btrim(coalesce(p_nombre, '')), '\s+', ' ', 'g');
    v_espera int;
begin
    if v_user is null then
        return jsonb_build_object('ok', false, 'error', 'sin_sesion');
    end if;

    if char_length(v_nombre) = 0 or char_length(v_nombre) > 20 then
        return jsonb_build_object('ok', false, 'error', 'nombre_invalido');
    end if;

    -- Atiende un registro a la vez: dos toques rápidos no pueden colarse.
    perform pg_advisory_xact_lock(hashtext('mejengas_lista'));

    if not coalesce((select lista_activa from public.configuracion where id = 1), false) then
        return jsonb_build_object('ok', false, 'error', 'lista_cerrada');
    end if;

    select greatest(0, ceil(60 - extract(epoch from (clock_timestamp() - ultimo_registro))))::int
    into v_espera
    from private.esperas
    where user_id = v_user;

    if coalesce(v_espera, 0) > 0 then
        return jsonb_build_object('ok', false, 'error', 'espera', 'segundos', v_espera);
    end if;

    if exists (select 1 from public.jugadores where lower(nombre) = lower(v_nombre)) then
        return jsonb_build_object('ok', false, 'error', 'nombre_repetido');
    end if;

    insert into public.jugadores (nombre, user_id) values (v_nombre, v_user);
    insert into public.historial (mensaje, tipo) values (v_nombre || ' se anotó en la lista.', 'info');

    insert into private.esperas (user_id, ultimo_registro)
    values (v_user, clock_timestamp())
    on conflict (user_id) do update set ultimo_registro = excluded.ultimo_registro;

    return jsonb_build_object('ok', true, 'segundos', 60);
end;
$$;

-- p_id es texto para funcionar igual si jugadores.id es número o uuid.
create or replace function public.quitar_jugador(p_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user    uuid := auth.uid();
    v_jugador record;
    v_mi_nombre text;
begin
    if v_user is null then
        return jsonb_build_object('ok', false, 'error', 'sin_sesion');
    end if;

    select id, nombre, user_id into v_jugador
    from public.jugadores
    where id::text = p_id;

    if not found then
        return jsonb_build_object('ok', false, 'error', 'no_existe');
    end if;

    if v_jugador.user_id is distinct from v_user then
        select nombre into v_mi_nombre
        from public.jugadores
        where user_id = v_user
        order by created_at desc
        limit 1;

        insert into public.historial (mensaje, tipo)
        values (coalesce(v_mi_nombre, 'Alguien') || ' intentó eliminar a ' || v_jugador.nombre, 'warning');

        return jsonb_build_object('ok', false, 'error', 'no_autorizado');
    end if;

    delete from public.jugadores where id = v_jugador.id;
    insert into public.historial (mensaje, tipo)
    values (v_jugador.nombre || ' se salió de la lista.', 'warning');

    return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (select 1 from private.admins where user_id = auth.uid());
$$;

create or replace function public.abrir_lista(p_password text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    if auth.uid() is null or not private.password_valida(p_password) then
        return false;
    end if;

    insert into private.admins (user_id) values (auth.uid())
    on conflict (user_id) do nothing;

    update public.configuracion set lista_activa = true where id = 1;
    return true;
end;
$$;

create or replace function public.nueva_lista()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
    if not exists (select 1 from private.admins where user_id = auth.uid()) then
        return false;
    end if;

    -- "where true" es necesario: Supabase rechaza DELETE sin WHERE.
    delete from public.jugadores where true;
    delete from public.historial where true;
    delete from private.esperas where true;
    update public.configuracion set lista_activa = false where id = 1;
    return true;
end;
$$;

-- ---------------------------------------------------------------------
-- Quién puede llamar a cada función
-- ---------------------------------------------------------------------
revoke all on function private.definir_password(text) from public, anon, authenticated;
revoke all on function private.password_valida(text)  from public, anon, authenticated;

revoke all on function public.segundos_espera()      from public, anon;
revoke all on function public.anotar_jugador(text)   from public, anon;
revoke all on function public.quitar_jugador(text)   from public, anon;
revoke all on function public.abrir_lista(text)      from public, anon;
revoke all on function public.nueva_lista()          from public, anon;
revoke all on function public.es_admin()             from public, anon;

grant execute on function public.segundos_espera()    to authenticated;
grant execute on function public.anotar_jugador(text) to authenticated;
grant execute on function public.quitar_jugador(text) to authenticated;
grant execute on function public.abrir_lista(text)    to authenticated;
grant execute on function public.nueva_lista()        to authenticated;
grant execute on function public.es_admin()           to authenticated;

-- ---------------------------------------------------------------------
-- Tiempo real: sin esto, los cambios no llegan a las pantallas abiertas
-- ---------------------------------------------------------------------
do $$
declare
    t text;
begin
    foreach t in array array['jugadores', 'historial', 'configuracion']
    loop
        if not exists (
            select 1 from pg_publication_tables
            where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
        ) then
            execute format('alter publication supabase_realtime add table public.%I', t);
        end if;
    end loop;
end;
$$;
