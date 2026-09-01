-- ============================================================
-- HEIRSPLIT — Demo Estate Seed
-- "Fam. Hansen sitt bo" — med 3 demo-arvinger og konflikter
--
-- Kjør dette i Supabase SQL Editor mens du er logget inn.
-- Du vil bli satt som admin. Demo-brukerne (Kari, Lars, Mona)
-- opprettes med passord: Demo1234!
--
-- REKKEFØLGE: Kjør supabase_setup.sql → v2 → v3 → v4 → v5 → DETTE
-- ============================================================

-- ============================================================
-- DEL 1: Demo-brukere i auth.users
-- Hvis dette feiler: opprett brukerne manuelt via
-- Supabase Dashboard → Authentication → Users
-- ============================================================

DO $$
DECLARE
  kari_id uuid := 'de000001-0000-0000-0000-000000000001';
  lars_id uuid := 'de000002-0000-0000-0000-000000000002';
  mona_id uuid := 'de000003-0000-0000-0000-000000000003';
  pw text := crypt('Demo1234!', gen_salt('bf'));
BEGIN

  -- instance_id, confirmation_token, recovery_token etc. are required for login to work
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, is_sso_user,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES
    (kari_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'kari.demo@heirsplit.no', pw, now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"display_name":"Kari Hansen"}'::jsonb,
     now(), now(), false, '', '', '', ''),
    (lars_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'lars.demo@heirsplit.no', pw, now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"display_name":"Lars Hansen"}'::jsonb,
     now(), now(), false, '', '', '', ''),
    (mona_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'mona.demo@heirsplit.no', pw, now(),
     '{"provider":"email","providers":["email"]}'::jsonb,
     '{"display_name":"Mona Hansen-Dahl"}'::jsonb,
     now(), now(), false, '', '', '', '')
  ON CONFLICT (id) DO UPDATE
    SET encrypted_password   = EXCLUDED.encrypted_password,
        email_confirmed_at   = EXCLUDED.email_confirmed_at,
        confirmation_token   = '',
        recovery_token       = '',
        email_change_token_new = '',
        email_change         = '';

  -- email_verified:true is required for password login
  INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at) VALUES
    (gen_random_uuid(), 'kari.demo@heirsplit.no', kari_id,
     json_build_object('sub', kari_id::text, 'email', 'kari.demo@heirsplit.no', 'email_verified', true, 'phone_verified', false)::jsonb,
     'email', now(), now(), now()),
    (gen_random_uuid(), 'lars.demo@heirsplit.no', lars_id,
     json_build_object('sub', lars_id::text, 'email', 'lars.demo@heirsplit.no', 'email_verified', true, 'phone_verified', false)::jsonb,
     'email', now(), now(), now()),
    (gen_random_uuid(), 'mona.demo@heirsplit.no', mona_id,
     json_build_object('sub', mona_id::text, 'email', 'mona.demo@heirsplit.no', 'email_verified', true, 'phone_verified', false)::jsonb,
     'email', now(), now(), now())
  ON CONFLICT (provider, provider_id) DO UPDATE
    SET identity_data = EXCLUDED.identity_data,
        updated_at    = now();

END $$;

-- ============================================================
-- DEL 2: Profiler for demo-brukerne
-- ============================================================

INSERT INTO profiles (user_id, display_name, avatar_color, email)
VALUES
  ('de000001-0000-0000-0000-000000000001', 'Kari Hansen',      '#c4855a', 'kari.demo@heirsplit.no'),
  ('de000002-0000-0000-0000-000000000002', 'Lars Hansen',      '#6b8fa8', 'lars.demo@heirsplit.no'),
  ('de000003-0000-0000-0000-000000000003', 'Mona Hansen-Dahl', '#7aaa7a', 'mona.demo@heirsplit.no')
ON CONFLICT (user_id) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      avatar_color = EXCLUDED.avatar_color;

-- ============================================================
-- DEL 3–6: Estate, kategorier, gjenstander og interesser
-- Finner automatisk din bruker-ID (den kontoen som ikke er demo)
-- ============================================================

DO $$
DECLARE
  my_id   uuid;
  demo_emails text[] := ARRAY['kari.demo@heirsplit.no','lars.demo@heirsplit.no','mona.demo@heirsplit.no'];
BEGIN

  -- Finn app-eierens bruker-ID (første ikke-demo-bruker, eldst først)
  SELECT id INTO my_id
  FROM auth.users
  WHERE email IS NOT NULL
    AND email <> ALL(demo_emails)
  ORDER BY created_at ASC
  LIMIT 1;

  IF my_id IS NULL THEN
    RAISE EXCEPTION 'Fant ingen bruker-konto. Sjekk at du er registrert under Authentication → Users i Supabase.';
  END IF;

  -- DEL 3: Estate
  INSERT INTO estates (id, name, description, owner_id, invite_code, status, total_value, split_mode)
  VALUES (
    'deed0001-0000-0000-0000-000000000001',
    'Fam. Hansen sitt bo',
    'Boet etter Astrid og Per Hansen – Bærum, 2025. Hus, innbo og familieklenodier fordeles mellom tre arvinger.',
    my_id,
    'HANSEN2025',
    'active',
    158400,
    'equal'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO estate_members (estate_id, user_id, role) VALUES
    ('deed0001-0000-0000-0000-000000000001', my_id,                                              'admin'),
    ('deed0001-0000-0000-0000-000000000001', 'de000001-0000-0000-0000-000000000001', 'member'),
    ('deed0001-0000-0000-0000-000000000001', 'de000002-0000-0000-0000-000000000002', 'member'),
    ('deed0001-0000-0000-0000-000000000001', 'de000003-0000-0000-0000-000000000003', 'member')
  ON CONFLICT (estate_id, user_id) DO NOTHING;

  INSERT INTO heirs (estate_id, name, email, relationship, percentage) VALUES
    ('deed0001-0000-0000-0000-000000000001', 'Kari Hansen',      'kari.demo@heirsplit.no', 'Barn', 33.3),
    ('deed0001-0000-0000-0000-000000000001', 'Lars Hansen',      'lars.demo@heirsplit.no', 'Barn', 33.3),
    ('deed0001-0000-0000-0000-000000000001', 'Mona Hansen-Dahl', 'mona.demo@heirsplit.no', 'Barn', 33.4)
  ON CONFLICT DO NOTHING;

  -- DEL 4: Kategorier
  INSERT INTO categories (id, label, emoji, estate_id) VALUES
    ('cafe0001-0000-0000-0000-000000000001', 'Møbler',               '🛋️', 'deed0001-0000-0000-0000-000000000001'),
    ('cafe0001-0000-0000-0000-000000000002', 'Kunst og bilder',      '🖼️', 'deed0001-0000-0000-0000-000000000001'),
    ('cafe0001-0000-0000-0000-000000000003', 'Smykker og ur',        '💍', 'deed0001-0000-0000-0000-000000000001'),
    ('cafe0001-0000-0000-0000-000000000004', 'Elektronikk',          '📺', 'deed0001-0000-0000-0000-000000000001'),
    ('cafe0001-0000-0000-0000-000000000005', 'Kjøkken og porselen',  '🍳', 'deed0001-0000-0000-0000-000000000001'),
    ('cafe0001-0000-0000-0000-000000000006', 'Minner og arvestykker','🪆', 'deed0001-0000-0000-0000-000000000001')
  ON CONFLICT (id) DO NOTHING;

  -- DEL 5: Gjenstander med bilder fra Unsplash
  INSERT INTO items (id, estate_id, title, description, category_id, image_url, estimated_value, condition, added_by_name, status) VALUES

  -- 🛋️ MØBLER
  ('face0001-0000-0000-0000-000000000001', 'deed0001-0000-0000-0000-000000000001',
   'Bestemors gyngestol',
   'Eiketre gyngestol fra 1960-tallet, håndlaget av bestefar Per. Har stått i stua i over 60 år. Original pute med blomstermønster.',
   'cafe0001-0000-0000-0000-000000000001',
   'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=600&q=80',
   8500, 'good', 'Demo', 'active'),

  ('face0002-0000-0000-0000-000000000002', 'deed0001-0000-0000-0000-000000000001',
   'Antikk eiketresbord',
   'Solid spisebord i eik, ca. 1920. Plass til 10 personer. Har vært familiens midtpunkt i tre generasjoner. Noe slitasje, men i god stand.',
   'cafe0001-0000-0000-0000-000000000001',
   'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80',
   24000, 'fair', 'Demo', 'active'),

  ('face0003-0000-0000-0000-000000000003', 'deed0001-0000-0000-0000-000000000001',
   'Mahognibokkhylle fra 1940',
   'Stor bokhylle i mahogni med glassdører. Plass til ca. 300 bøker. Tilhørende boksamling medfølger.',
   'cafe0001-0000-0000-0000-000000000001',
   'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&q=80',
   4800, 'good', 'Demo', 'active'),

  -- 🖼️ KUNST
  ('face0004-0000-0000-0000-000000000004', 'deed0001-0000-0000-0000-000000000001',
   'Oljemaleri «Fjord i solnedgang»',
   'Signert oljemaleri av norsk maler K. Andreassen, 1978. 80×120 cm. Har hengt i stua siden 1980. Originalt pynteramme i gull.',
   'cafe0001-0000-0000-0000-000000000002',
   'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&q=80',
   35000, 'excellent', 'Demo', 'active'),

  ('face0005-0000-0000-0000-000000000005', 'deed0001-0000-0000-0000-000000000001',
   'Kinesisk porselesvase, Qing-dynastiet',
   'Blå og hvit porselensvase, antagelig fra Qing-dynastiet (1800-tall). Trolig kopi, men av høy kvalitet. Ingen sprekker.',
   'cafe0001-0000-0000-0000-000000000002',
   'https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?w=600&q=80',
   6500, 'excellent', 'Demo', 'active'),

  -- 💍 SMYKKER
  ('face0006-0000-0000-0000-000000000006', 'deed0001-0000-0000-0000-000000000001',
   'Vintage Rolex Oyster (1962)',
   'Herreur i stål med originalt lær-armbånd. Fungerer, men bør vedlikeholdes. Kjøpt av Per Hansen i 1962. Originalkasse medfølger.',
   'cafe0001-0000-0000-0000-000000000003',
   'https://images.unsplash.com/photo-1606800052052-a08af7148866?w=600&q=80',
   45000, 'fair', 'Demo', 'active'),

  ('face0007-0000-0000-0000-000000000007', 'deed0001-0000-0000-0000-000000000001',
   'Perle- og diamanthalskjede',
   'Hvitt gull med 18 søsterperler og diamantlås. Bryllupsgave til Astrid i 1961. Sertifikat fra gullsmed medfølger.',
   'cafe0001-0000-0000-0000-000000000003',
   'https://images.unsplash.com/photo-1594736797933-d0401ba2fe65?w=600&q=80',
   18000, 'excellent', 'Demo', 'active'),

  -- 📺 ELEKTRONIKK
  ('face0008-0000-0000-0000-000000000008', 'deed0001-0000-0000-0000-000000000001',
   'Bang & Olufsen musikksystem',
   'B&O Beosound stereo fra 2019. Høyttalere + forsterker + CD-spiller. Verdi ca. kr 12 000 ny. Fungerer perfekt.',
   'cafe0001-0000-0000-0000-000000000004',
   'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=600&q=80',
   12000, 'good', 'Demo', 'active'),

  -- 🍳 KJØKKEN
  ('face0009-0000-0000-0000-000000000009', 'deed0001-0000-0000-0000-000000000001',
   'Stavangerflint porselen (18 deler)',
   'Komplett middagsservise i Stavangerflint, 1960-modellen «Flint Blue». 18 deler. Noe slitasje på tallerkener, ingen sprekker.',
   'cafe0001-0000-0000-0000-000000000005',
   'https://images.unsplash.com/photo-1577553698842-aba12d2d17e4?w=600&q=80',
   3200, 'fair', 'Demo', 'active'),

  ('face0010-0000-0000-0000-000000000010', 'deed0001-0000-0000-0000-000000000001',
   'Kristallglass (Hadeland, 12 stk)',
   'Hvitvinsglass fra Hadeland Glassverk, 1970-tallet. 12 stykk, ingen mangler. Originalt trekasse.',
   'cafe0001-0000-0000-0000-000000000005',
   'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=600&q=80',
   2400, 'excellent', 'Demo', 'active'),

  -- 🪆 MINNER
  ('face0011-0000-0000-0000-000000000011', 'deed0001-0000-0000-0000-000000000001',
   'Familiealbum 1958–2010',
   'Tre innbundne fotoalbum med over 400 familiefoto fra 1958 til 2010. Inkluderer bryllupsbilder, barndomsbilder og familieferier.',
   'cafe0001-0000-0000-0000-000000000006',
   'https://images.unsplash.com/photo-1567026734534-2c90e2a6fde5?w=600&q=80',
   NULL, 'good', 'Demo', 'active'),

  ('face0012-0000-0000-0000-000000000012', 'deed0001-0000-0000-0000-000000000001',
   'Husflid-sykmaskin (Singer, 1938)',
   'Elektrisk Singer-sykmaskin fra 1938, arvet fra oldemor. Sjelden modell i trefrems-utførelse. Fungerer med ny ledning.',
   'cafe0001-0000-0000-0000-000000000006',
   'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
   1200, 'fair', 'Demo', 'active')

  ON CONFLICT (id) DO NOTHING;

  -- DEL 6: Interesser — realistiske konflikter
  --   Gyngestol        → du + Kari        (emosjonell)
  --   Eiketresbord     → Lars + Mona      (materiell)
  --   Oljemaleri       → du + Lars + Mona (alle!)
  --   Rolex            → Kari + Mona      (materiell)
  --   B&O musikksystem → du + Lars        (materiell)
  --   Familiealbum     → alle tre demo    (emosjonell)

  -- Gyngestol: du + Kari
  INSERT INTO interests (item_id, user_id, reason) VALUES
    ('face0001-0000-0000-0000-000000000001', my_id,
     'Jeg husker den fra barndommen — bestemor satt alltid der og strikket'),
    ('face0001-0000-0000-0000-000000000001', 'de000001-0000-0000-0000-000000000001',
     'Mamma elsket den stolen. Jeg vil ta vare på den til barna mine')
  ON CONFLICT (item_id, user_id) DO NOTHING;

  -- Eiketresbord: Lars + Mona
  INSERT INTO interests (item_id, user_id, reason) VALUES
    ('face0002-0000-0000-0000-000000000002', 'de000002-0000-0000-0000-000000000002',
     'Vi har plass til det i stua og det vil passe perfekt med vår stil'),
    ('face0002-0000-0000-0000-000000000002', 'de000003-0000-0000-0000-000000000003',
     'Vi mangler et skikkelig spisebord — dette er drømmen')
  ON CONFLICT (item_id, user_id) DO NOTHING;

  -- Oljemaleri: du + Lars + Mona (3-veis!)
  INSERT INTO interests (item_id, user_id, reason) VALUES
    ('face0004-0000-0000-0000-000000000004', my_id,
     'Det hørte alltid til i stua. Jeg kan ikke forestille meg det noe annet sted'),
    ('face0004-0000-0000-0000-000000000004', 'de000002-0000-0000-0000-000000000002',
     'Pappa var veldig glad i dette maleriet. Jeg vil beholde minnet'),
    ('face0004-0000-0000-0000-000000000004', 'de000003-0000-0000-0000-000000000003',
     'Det er det mest verdifulle i boet — og det er vakkert')
  ON CONFLICT (item_id, user_id) DO NOTHING;

  -- Rolex: Kari + Mona
  INSERT INTO interests (item_id, user_id, reason) VALUES
    ('face0006-0000-0000-0000-000000000006', 'de000001-0000-0000-0000-000000000001',
     'Pappa hadde den på seg hver dag. Den betyr mye for meg'),
    ('face0006-0000-0000-0000-000000000006', 'de000003-0000-0000-0000-000000000003',
     'Jeg er den eneste som bruker ur, og det er et klassisk stykke')
  ON CONFLICT (item_id, user_id) DO NOTHING;

  -- B&O musikksystem: du + Lars
  INSERT INTO interests (item_id, user_id, reason) VALUES
    ('face0008-0000-0000-0000-000000000008', my_id,
     'Jeg bruker musikkanlegg daglig og dette er av fantastisk kvalitet'),
    ('face0008-0000-0000-0000-000000000008', 'de000002-0000-0000-0000-000000000002',
     'Er stor B&O-fan. Har alltid likt dette anlegget')
  ON CONFLICT (item_id, user_id) DO NOTHING;

  -- Familiealbum: alle tre demo-brukerne (3-veis, emosjonell)
  INSERT INTO interests (item_id, user_id, reason) VALUES
    ('face0011-0000-0000-0000-000000000011', 'de000001-0000-0000-0000-000000000001',
     'Bildene betyr alt. Jeg vil skanne dem og dele digitalt med alle'),
    ('face0011-0000-0000-0000-000000000011', 'de000002-0000-0000-0000-000000000002',
     'Vi bør alle ha tilgang — men noen må oppbevare originalene'),
    ('face0011-0000-0000-0000-000000000011', 'de000003-0000-0000-0000-000000000003',
     'Jeg har barn som ikke har sett disse bildene ennå')
  ON CONFLICT (item_id, user_id) DO NOTHING;

  -- Kinesisk vase: kun Kari
  INSERT INTO interests (item_id, user_id, reason) VALUES
    ('face0005-0000-0000-0000-000000000005', 'de000001-0000-0000-0000-000000000001',
     'Har alltid vært fascinert av den. Vil gjerne ha den i hylla mi')
  ON CONFLICT (item_id, user_id) DO NOTHING;

  -- Halskjede: kun Mona
  INSERT INTO interests (item_id, user_id, reason) VALUES
    ('face0007-0000-0000-0000-000000000007', 'de000003-0000-0000-0000-000000000003',
     'Jeg er eneste datter som bruker smykker — og det er mors smykke')
  ON CONFLICT (item_id, user_id) DO NOTHING;

  -- Bokhylle: kun Lars
  INSERT INTO interests (item_id, user_id, reason) VALUES
    ('face0003-0000-0000-0000-000000000003', 'de000002-0000-0000-0000-000000000002',
     'Jeg er den eneste som har plass til den — og jeg er bibliofil')
  ON CONFLICT (item_id, user_id) DO NOTHING;

  -- Porselen: kun Mona
  INSERT INTO interests (item_id, user_id, reason) VALUES
    ('face0009-0000-0000-0000-000000000009', 'de000003-0000-0000-0000-000000000003',
     'Stavangerflint er en norsk klassiker. Vil bruke det til jul')
  ON CONFLICT (item_id, user_id) DO NOTHING;

  -- Sykmaskin og Kristallglass: ingen interesserte (vises som "ingen vil ha")

END $$;

-- ============================================================
-- Ferdig! ✓
--
-- Demo-boet er nå klart med:
--   12 gjenstander
--    6 konflikter (🔥)
--    4 gjenstander med én interessert
--    2 gjenstander ingen vil ha
--
-- Logg inn med: kari.demo@heirsplit.no / Demo1234!
--               lars.demo@heirsplit.no / Demo1234!
--               mona.demo@heirsplit.no / Demo1234!
--
-- Åpne "Fam. Hansen sitt bo" og klikk 🔥 Konfliktløsning
-- for å prøve de tre fordelingsmodusene.
-- ============================================================
