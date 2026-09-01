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
BEGIN

INSERT INTO auth.users (
  id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, is_sso_user
) VALUES
  (kari_id, 'authenticated', 'authenticated',
   'kari.demo@heirsplit.no', crypt('Demo1234!', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}'::jsonb,
   '{"display_name":"Kari Hansen"}'::jsonb, now(), now(), false),
  (lars_id, 'authenticated', 'authenticated',
   'lars.demo@heirsplit.no', crypt('Demo1234!', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}'::jsonb,
   '{"display_name":"Lars Hansen"}'::jsonb, now(), now(), false),
  (mona_id, 'authenticated', 'authenticated',
   'mona.demo@heirsplit.no', crypt('Demo1234!', gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}'::jsonb,
   '{"display_name":"Mona Hansen-Dahl"}'::jsonb, now(), now(), false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at) VALUES
  (gen_random_uuid(), kari_id, json_build_object('sub', kari_id::text, 'email', 'kari.demo@heirsplit.no')::jsonb, 'email', 'kari.demo@heirsplit.no', now(), now(), now()),
  (gen_random_uuid(), lars_id, json_build_object('sub', lars_id::text, 'email', 'lars.demo@heirsplit.no')::jsonb, 'email', 'lars.demo@heirsplit.no', now(), now(), now()),
  (gen_random_uuid(), mona_id, json_build_object('sub', mona_id::text, 'email', 'mona.demo@heirsplit.no')::jsonb, 'email', 'mona.demo@heirsplit.no', now(), now(), now())
ON CONFLICT DO NOTHING;

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
-- DEL 3: Demo-boet — opprettes med deg (auth.uid()) som eier
-- ============================================================

INSERT INTO estates (id, name, description, owner_id, invite_code, status, total_value, split_mode)
VALUES (
  'e0demo01-0000-0000-0000-000000000001',
  'Fam. Hansen sitt bo',
  'Boet etter Astrid og Per Hansen – Bærum, 2025. Hus, innbo og familieklenodier fordeles mellom tre arvinger.',
  auth.uid(),
  'HANSEN2025',
  'active',
  158400,
  'equal'
) ON CONFLICT (id) DO NOTHING;

-- Legg deg som admin + demo-brukerne som medlemmer
INSERT INTO estate_members (estate_id, user_id, role)
VALUES
  ('e0demo01-0000-0000-0000-000000000001', auth.uid(),                                          'admin'),
  ('e0demo01-0000-0000-0000-000000000001', 'de000001-0000-0000-0000-000000000001', 'member'),
  ('e0demo01-0000-0000-0000-000000000001', 'de000002-0000-0000-0000-000000000002', 'member'),
  ('e0demo01-0000-0000-0000-000000000001', 'de000003-0000-0000-0000-000000000003', 'member')
ON CONFLICT (estate_id, user_id) DO NOTHING;

-- Arvinger (heirs-tabell — ikke samme som members)
INSERT INTO heirs (estate_id, name, email, relationship, percentage)
VALUES
  ('e0demo01-0000-0000-0000-000000000001', 'Kari Hansen',      'kari.demo@heirsplit.no',  'Barn', 33.3),
  ('e0demo01-0000-0000-0000-000000000001', 'Lars Hansen',      'lars.demo@heirsplit.no',  'Barn', 33.3),
  ('e0demo01-0000-0000-0000-000000000001', 'Mona Hansen-Dahl', 'mona.demo@heirsplit.no',  'Barn', 33.4)
ON CONFLICT DO NOTHING;

-- ============================================================
-- DEL 4: Kategorier (per-bo, fra v5)
-- ============================================================

INSERT INTO categories (id, label, emoji, estate_id) VALUES
  ('c0demo01-0000-0000-0000-000000000001', 'Møbler',              '🛋️', 'e0demo01-0000-0000-0000-000000000001'),
  ('c0demo01-0000-0000-0000-000000000002', 'Kunst og bilder',     '🖼️', 'e0demo01-0000-0000-0000-000000000001'),
  ('c0demo01-0000-0000-0000-000000000003', 'Smykker og ur',       '💍', 'e0demo01-0000-0000-0000-000000000001'),
  ('c0demo01-0000-0000-0000-000000000004', 'Elektronikk',         '📺', 'e0demo01-0000-0000-0000-000000000001'),
  ('c0demo01-0000-0000-0000-000000000005', 'Kjøkken og porselen', '🍳', 'e0demo01-0000-0000-0000-000000000001'),
  ('c0demo01-0000-0000-0000-000000000006', 'Minner og arvestykker','🪆', 'e0demo01-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DEL 5: Gjenstander med bilder fra Unsplash
-- ============================================================

INSERT INTO items (id, estate_id, title, description, category_id, image_url, estimated_value, condition, added_by_name, status)
VALUES

-- 🛋️ MØBLER
('i0demo01-0000-0000-0000-000000000001', 'e0demo01-0000-0000-0000-000000000001',
 'Bestemors gyngestol',
 'Eiketre gyngestol fra 1960-tallet, håndlaget av bestefar Per. Har stått i stua i over 60 år. Original pute med blomstermønster.',
 'c0demo01-0000-0000-0000-000000000001',
 'https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=600&q=80',
 8500, 'good', 'Demo', 'active'),

('i0demo02-0000-0000-0000-000000000002', 'e0demo01-0000-0000-0000-000000000001',
 'Antikk eiketresbord',
 'Solid spisebord i eik, ca. 1920. Plass til 10 personer. Har vært familiens midtpunkt i tre generasjoner. Noe slitasje, men i god stand.',
 'c0demo01-0000-0000-0000-000000000001',
 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80',
 24000, 'fair', 'Demo', 'active'),

('i0demo03-0000-0000-0000-000000000003', 'e0demo01-0000-0000-0000-000000000001',
 'Mahognibokkhylle fra 1940',
 'Stor bokhylle i mahogni med glassdører. Plass til ca. 300 bøker. Tilhørende boksamling medfølger.',
 'c0demo01-0000-0000-0000-000000000001',
 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600&q=80',
 4800, 'good', 'Demo', 'active'),

-- 🖼️ KUNST
('i0demo04-0000-0000-0000-000000000004', 'e0demo01-0000-0000-0000-000000000001',
 'Oljemaleri «Fjord i solnedgang»',
 'Signert oljemaleri av norsk maler K. Andreassen, 1978. 80×120 cm. Har hengt i stua siden 1980. Originalt pynteramme i gull.',
 'c0demo01-0000-0000-0000-000000000002',
 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&q=80',
 35000, 'excellent', 'Demo', 'active'),

('i0demo05-0000-0000-0000-000000000005', 'e0demo01-0000-0000-0000-000000000001',
 'Kinesisk porselesvase, Qing-dynastiet',
 'Blå og hvit porselensvase, antagelig fra Qing-dynastiet (1800-tall). Trolig kopi, men av høy kvalitet. Ingen sprekker.',
 'c0demo01-0000-0000-0000-000000000002',
 'https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?w=600&q=80',
 6500, 'excellent', 'Demo', 'active'),

-- 💍 SMYKKER
('i0demo06-0000-0000-0000-000000000006', 'e0demo01-0000-0000-0000-000000000001',
 'Vintage Rolex Oyster (1962)',
 'Herreur i stål med originalt lær-armbånd. Fungerer, men bør vedlikeholdes. Kjøpt av Per Hansen i 1962. Originalkasse medfølger.',
 'c0demo01-0000-0000-0000-000000000003',
 'https://images.unsplash.com/photo-1606800052052-a08af7148866?w=600&q=80',
 45000, 'fair', 'Demo', 'active'),

('i0demo07-0000-0000-0000-000000000007', 'e0demo01-0000-0000-0000-000000000001',
 'Perle- og diamanthalskjede',
 'Hvitt gull med 18 søsterperler og diamantlås. Bryllupsgave til Astrid i 1961. Sertifikat fra gullsmed medfølger.',
 'c0demo01-0000-0000-0000-000000000003',
 'https://images.unsplash.com/photo-1594736797933-d0401ba2fe65?w=600&q=80',
 18000, 'excellent', 'Demo', 'active'),

-- 📺 ELEKTRONIKK
('i0demo08-0000-0000-0000-000000000008', 'e0demo01-0000-0000-0000-000000000001',
 'Bang & Olufsen musikksystem',
 'B&O Beosound stereo fra 2019. Høyttalere + forsterker + CD-spiller. Verdi ca. kr 12 000 ny. Fungerer perfekt.',
 'c0demo01-0000-0000-0000-000000000004',
 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=600&q=80',
 12000, 'good', 'Demo', 'active'),

-- 🍳 KJØKKEN
('i0demo09-0000-0000-0000-000000000009', 'e0demo01-0000-0000-0000-000000000001',
 'Stavangerflint porselen (18 deler)',
 'Komplett middagsservise i Stavangerflint, 1960-modellen «Flint Blue». 18 deler. Noe slitasje på tallerkener, ingen sprekker.',
 'c0demo01-0000-0000-0000-000000000005',
 'https://images.unsplash.com/photo-1577553698842-aba12d2d17e4?w=600&q=80',
 3200, 'fair', 'Demo', 'active'),

('i0demo10-0000-0000-0000-000000000010', 'e0demo01-0000-0000-0000-000000000001',
 'Kristallglass (Hadeland, 12 stk)',
 'Hvitvinsglass fra Hadeland Glassverk, 1970-tallet. 12 stykk, ingen mangler. Originalt trekasse.',
 'c0demo01-0000-0000-0000-000000000005',
 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=600&q=80',
 2400, 'excellent', 'Demo', 'active'),

-- 🪆 MINNER
('i0demo11-0000-0000-0000-000000000011', 'e0demo01-0000-0000-0000-000000000001',
 'Familiealbum 1958–2010',
 'Tre innbundne fotoalbum med over 400 familiefoto fra 1958 til 2010. Inkluderer bryllupsbilder, barndomsbilder og familieferier.',
 'c0demo01-0000-0000-0000-000000000006',
 'https://images.unsplash.com/photo-1567026734534-2c90e2a6fde5?w=600&q=80',
 NULL, 'good', 'Demo', 'active'),

('i0demo12-0000-0000-0000-000000000012', 'e0demo01-0000-0000-0000-000000000001',
 'Husflid-sykmaskin (Singer, 1938)',
 'Elektrisk Singer-sykmaskin fra 1938, arvet fra oldemor. Sjelden modell i trefrems-utførelse. Fungerer med ny ledning.',
 'c0demo01-0000-0000-0000-000000000006',
 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
 1200, 'fair', 'Demo', 'active')

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- DEL 6: Interesser — realistiske konflikter
--
-- Konflikter (🔥):
--   Gyngestol        → du + Kari        (emosjonell)
--   Eiketresbord     → Lars + Mona      (materiell)
--   Oljemaleri       → du + Lars + Mona (alle!)
--   Rolex            → Kari + Mona      (materiell)
--   B&O musikksystem → du + Lars        (materiell)
--   Familiealbum     → alle tre demo    (emosjonell)
--
-- Ukrevde: Bokhylle, Kinesisk vase, Halskjede, Porselen, Kristallglass, Sykmaskin
-- ============================================================

-- Gyngestol: du (auth.uid()) + Kari
INSERT INTO interests (item_id, user_id, reason) VALUES
  ('i0demo01-0000-0000-0000-000000000001', auth.uid(),
   'Jeg husker den fra barndommen — bestemor satt alltid der og strikket'),
  ('i0demo01-0000-0000-0000-000000000001', 'de000001-0000-0000-0000-000000000001',
   'Mamma elsket den stolen. Jeg vil ta vare på den til barna mine')
ON CONFLICT (item_id, user_id) DO NOTHING;

-- Eiketresbord: Lars + Mona
INSERT INTO interests (item_id, user_id, reason) VALUES
  ('i0demo02-0000-0000-0000-000000000002', 'de000002-0000-0000-0000-000000000002',
   'Vi har plass til det i stua og det vil passe perfekt med vår stil'),
  ('i0demo02-0000-0000-0000-000000000002', 'de000003-0000-0000-0000-000000000003',
   'Vi mangler et skikkelig spisebord — dette er drømmen')
ON CONFLICT (item_id, user_id) DO NOTHING;

-- Oljemaleri: du + Lars + Mona (3-veis konflikt!)
INSERT INTO interests (item_id, user_id, reason) VALUES
  ('i0demo04-0000-0000-0000-000000000004', auth.uid(),
   'Det hørte alltid til i stua. Jeg kan ikke forestille meg det noe annet sted'),
  ('i0demo04-0000-0000-0000-000000000004', 'de000002-0000-0000-0000-000000000002',
   'Pappa var veldig glad i dette maleriet. Jeg vil beholde minnet'),
  ('i0demo04-0000-0000-0000-000000000004', 'de000003-0000-0000-0000-000000000003',
   'Det er det mest verdifulle i boet — og det er vakkert')
ON CONFLICT (item_id, user_id) DO NOTHING;

-- Rolex: Kari + Mona
INSERT INTO interests (item_id, user_id, reason) VALUES
  ('i0demo06-0000-0000-0000-000000000006', 'de000001-0000-0000-0000-000000000001',
   'Pappa hadde den på seg hver dag. Den betyr mye for meg'),
  ('i0demo06-0000-0000-0000-000000000006', 'de000003-0000-0000-0000-000000000003',
   'Jeg er den eneste som bruker ur, og det er et klassisk stykke')
ON CONFLICT (item_id, user_id) DO NOTHING;

-- B&O musikksystem: du + Lars (2-veis)
INSERT INTO interests (item_id, user_id, reason) VALUES
  ('i0demo08-0000-0000-0000-000000000008', auth.uid(),
   'Jeg bruker musikkanlegg daglig og dette er av fantastisk kvalitet'),
  ('i0demo08-0000-0000-0000-000000000008', 'de000002-0000-0000-0000-000000000002',
   'Er stor B&O-fan. Har alltid likt dette anlegget')
ON CONFLICT (item_id, user_id) DO NOTHING;

-- Familiealbum: alle tre demo-brukerne (3-veis, emosjonell)
INSERT INTO interests (item_id, user_id, reason) VALUES
  ('i0demo11-0000-0000-0000-000000000011', 'de000001-0000-0000-0000-000000000001',
   'Bildene betyr alt. Jeg vil skanne dem og dele digitalt med alle'),
  ('i0demo11-0000-0000-0000-000000000011', 'de000002-0000-0000-0000-000000000002',
   'Vi bør alle ha tilgang — men noen må oppbevare originalene'),
  ('i0demo11-0000-0000-0000-000000000011', 'de000003-0000-0000-0000-000000000003',
   'Jeg har barn som ikke har sett disse bildene ennå')
ON CONFLICT (item_id, user_id) DO NOTHING;

-- Kinesisk vase: kun Kari (ingen konflikt)
INSERT INTO interests (item_id, user_id, reason) VALUES
  ('i0demo05-0000-0000-0000-000000000005', 'de000001-0000-0000-0000-000000000001',
   'Har alltid vært fascinert av den. Vil gjerne ha den i hylla mi')
ON CONFLICT (item_id, user_id) DO NOTHING;

-- Halskjede: kun Mona (ingen konflikt)
INSERT INTO interests (item_id, user_id, reason) VALUES
  ('i0demo07-0000-0000-0000-000000000007', 'de000003-0000-0000-0000-000000000003',
   'Jeg er eneste datter som bruker smykker — og det er mors smykke')
ON CONFLICT (item_id, user_id) DO NOTHING;

-- Bokhylle: kun Lars (ingen konflikt)
INSERT INTO interests (item_id, user_id, reason) VALUES
  ('i0demo03-0000-0000-0000-000000000003', 'de000002-0000-0000-0000-000000000002',
   'Jeg er den eneste som har plass til den — og jeg er bibliofil')
ON CONFLICT (item_id, user_id) DO NOTHING;

-- Porselen: kun Mona
INSERT INTO interests (item_id, user_id, reason) VALUES
  ('i0demo09-0000-0000-0000-000000000009', 'de000003-0000-0000-0000-000000000003',
   'Stavangerflint er en norsk klassiker. Vil bruke det til jul')
ON CONFLICT (item_id, user_id) DO NOTHING;

-- Sykmaskin og Kristallglass: ingen interesserte (vises som "ingen vil ha")

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
