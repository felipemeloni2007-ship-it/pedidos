-- Development/demo data for the Forno 27 storefront.
-- Safe to run repeatedly in a disposable environment. It contains no real PII.

insert into public.tenants (
  id, name, slug, timezone, status
) values (
  'a73db9c1-a166-47d7-934a-dbe2f82a27d1',
  'Forno 27',
  'forno-27',
  'America/Sao_Paulo',
  'active'
) on conflict (id) do update set
  name = excluded.name,
  updated_at = now();

insert into public.stores (
  id,
  tenant_id,
  name,
  public_slug,
  timezone,
  address,
  phone_e164,
  whatsapp_e164,
  is_storefront_published,
  accepting_orders,
  accepts_delivery,
  accepts_pickup,
  default_prep_minutes,
  min_order_amount,
  public_theme
) values (
  '47c91484-0c28-497a-90ed-317d40e7a2dc',
  'a73db9c1-a166-47d7-934a-dbe2f82a27d1',
  'Forno 27 • Centro',
  'forno-27',
  'America/Sao_Paulo',
  '{"formatted_address":"Rua das Palmeiras, 27 — Centro"}'::jsonb,
  '+5511999272727',
  '+5511999272727',
  true,
  true,
  true,
  true,
  30,
  25,
  '{"primary":"#202723","secondary":"#d9762a","accent":"#efb53b","radius":"0.85rem"}'::jsonb
) on conflict (id) do update set
  accepting_orders = true,
  is_storefront_published = true,
  updated_at = now();

insert into public.order_status_definitions (
  tenant_id, store_id, status, label, display_order
) values
  ('a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'new', 'Novo', 10),
  ('a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'confirmed', 'Confirmado', 20),
  ('a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'preparing', 'Em preparo', 30),
  ('a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'ready', 'Pronto', 40),
  ('a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'awaiting_driver', 'Aguardando entregador', 50),
  ('a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'out_for_delivery', 'Saiu para entrega', 60),
  ('a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'delivered', 'Entregue', 70),
  ('a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'canceled', 'Cancelado', 80)
on conflict (tenant_id, store_id, status) do update set
  label = excluded.label,
  display_order = excluded.display_order;

insert into public.categories (
  id, tenant_id, store_id, name, display_order
) values
  ('a169401d-34da-43f7-bc9c-93d6abc7682f', 'a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'Pizzas', 10),
  ('b7c32e9c-2f35-43d4-a6dc-a98de5c08ec5', 'a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'Hambúrgueres', 20),
  ('c2378d5b-5a82-494e-97d9-6bc8ce58f75a', 'a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'Porções', 30),
  ('d919af06-cafe-48bf-8e5a-4d711d950bc3', 'a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'Bebidas', 40),
  ('e2964ea1-6f68-4841-b3ec-0951fad972df', 'a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'Sobremesas', 50)
on conflict (id) do update set
  name = excluded.name,
  updated_at = now();

insert into public.products (
  id, tenant_id, store_id, category_id, kind, name, slug, short_description,
  description, base_price, compare_at_price, prep_minutes, display_order,
  is_featured, is_best_seller, is_new, is_promotion, dietary_tags
) values
  (
    'f4aa27e8-954b-4bf3-bceb-9ccdf1eb6d32',
    'a73db9c1-a166-47d7-934a-dbe2f82a27d1',
    '47c91484-0c28-497a-90ed-317d40e7a2dc',
    'a169401d-34da-43f7-bc9c-93d6abc7682f',
    'pizza', 'Pizza Margherita', 'pizza-margherita',
    'Molho italiano, fior di latte e manjericão.',
    'Massa de fermentação longa, molho de tomate italiano, fior di latte e manjericão fresco.',
    48.90, 55.90, 30, 10, true, true, false, false, array['vegetariano']
  ),
  (
    'e7f8a13e-77cc-4196-bd03-1f89c5e3d9a1',
    'a73db9c1-a166-47d7-934a-dbe2f82a27d1',
    '47c91484-0c28-497a-90ed-317d40e7a2dc',
    'a169401d-34da-43f7-bc9c-93d6abc7682f',
    'pizza', 'Pizza Calabresa', 'pizza-calabresa',
    'Calabresa artesanal, cebola e muçarela.',
    'Calabresa fatiada artesanalmente, cebola roxa, muçarela e molho de tomate assado.',
    52.90, null, 30, 20, false, true, false, false, array[]::text[]
  ),
  (
    'bdf8147d-3fb8-4f77-bb28-2c60b2775de9',
    'a73db9c1-a166-47d7-934a-dbe2f82a27d1',
    '47c91484-0c28-497a-90ed-317d40e7a2dc',
    'a169401d-34da-43f7-bc9c-93d6abc7682f',
    'pizza', 'Pizza Portuguesa', 'pizza-portuguesa',
    'Presunto, ovos, cebola, azeitonas e ervilha.',
    'Portuguesa generosa com ingredientes frescos, muçarela e azeitonas pretas.',
    56.90, null, 30, 30, false, false, false, false, array[]::text[]
  ),
  (
    'c9d7ca2f-33d3-49ac-b7e0-d37a1c33208e',
    'a73db9c1-a166-47d7-934a-dbe2f82a27d1',
    '47c91484-0c28-497a-90ed-317d40e7a2dc',
    'b7c32e9c-2f35-43d4-a6dc-a98de5c08ec5',
    'simple', 'Smash Bacon', 'smash-bacon',
    'Dois smash burgers, cheddar e bacon crocante.',
    'Blend prensado na chapa, cheddar cremoso, bacon crocante, maionese da casa e pão brioche.',
    35.90, null, 18, 10, true, true, false, false, array[]::text[]
  ),
  (
    '09f1da3b-b8e0-4d09-89bc-b4b643b93b41',
    'a73db9c1-a166-47d7-934a-dbe2f82a27d1',
    '47c91484-0c28-497a-90ed-317d40e7a2dc',
    'b7c32e9c-2f35-43d4-a6dc-a98de5c08ec5',
    'simple', 'Cheddar Burger', 'cheddar-burger',
    'Smash, cheddar inglês e cebola caramelizada.',
    'Smash burger, cheddar inglês, cebola caramelizada e pão brioche.',
    32.90, null, 18, 20, false, false, true, false, array[]::text[]
  ),
  (
    'bbfd1110-7b25-464e-8c4c-8c89125f5bd5',
    'a73db9c1-a166-47d7-934a-dbe2f82a27d1',
    '47c91484-0c28-497a-90ed-317d40e7a2dc',
    'c2378d5b-5a82-494e-97d9-6bc8ce58f75a',
    'simple', 'Batata com Cheddar', 'batata-cheddar',
    'Crocante por fora, cremosa por cima.',
    'Batatas fritas sequinhas, cheddar cremoso e toque de pimenta-do-reino.',
    18.90, null, 12, 10, false, false, false, true, array[]::text[]
  ),
  (
    '45fe7f2e-6eb4-48f0-ad38-b7a07aac4a6d',
    'a73db9c1-a166-47d7-934a-dbe2f82a27d1',
    '47c91484-0c28-497a-90ed-317d40e7a2dc',
    'd919af06-cafe-48bf-8e5a-4d711d950bc3',
    'simple', 'Refrigerante lata', 'refrigerante-lata',
    'Coca-Cola ou Guaraná, bem gelado.',
    'Escolha seu refrigerante em lata.',
    8.00, null, 0, 10, false, false, false, false, array[]::text[]
  ),
  (
    '197c80e8-27cc-4e4a-b443-31e4ef7f8b75',
    'a73db9c1-a166-47d7-934a-dbe2f82a27d1',
    '47c91484-0c28-497a-90ed-317d40e7a2dc',
    'e2964ea1-6f68-4841-b3ec-0951fad972df',
    'simple', 'Brownie intenso', 'brownie-intenso',
    'Chocolate 70%, casquinha fina e centro macio.',
    'Brownie de chocolate intenso com casquinha delicada e centro macio.',
    12.00, null, 6, 10, false, false, false, false, array[]::text[]
  )
on conflict (id) do update set
  name = excluded.name,
  base_price = excluded.base_price,
  is_available = true,
  is_visible = true,
  updated_at = now();

insert into public.modifier_groups (
  id, tenant_id, store_id, name, min_selections, max_selections, display_order
) values
  ('10f959fb-d35f-4ad3-8c46-fd431d52be88', 'a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'Escolha o tamanho', 1, 1, 10),
  ('c7afc4aa-846d-41a0-a9e1-21eaf6ef7f44', 'a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'Escolha a borda', 0, 1, 20),
  ('a7a1d30f-9c33-41d6-a1fd-e3c627d5ab0e', 'a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'Adicionais', 0, 3, 30),
  ('3c1d5d69-b1a4-43c7-bc83-d92a6edcb59d', 'a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'Escolha sua versão', 1, 1, 10),
  ('4e7e4eb6-d627-4e92-8d14-8c4db2a34975', 'a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'Escolha o sabor', 1, 1, 10)
on conflict (id) do update set name = excluded.name, updated_at = now();

insert into public.modifier_options (
  id, tenant_id, store_id, modifier_group_id, name, price_delta, display_order, is_default
) values
  ('96310df8-d85b-4cc6-b3b8-e8c98c9c2b6d', 'a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', '10f959fb-d35f-4ad3-8c46-fd431d52be88', 'Média · 6 fatias', 0, 10, true),
  ('55d05608-f5be-4a79-8a01-a2a1c4c8bfa8', 'a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', '10f959fb-d35f-4ad3-8c46-fd431d52be88', 'Grande · 8 fatias', 11, 20, false),
  ('2d32c550-f4b1-4386-b94f-a3f2f979f860', 'a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'c7afc4aa-846d-41a0-a9e1-21eaf6ef7f44', 'Catupiry cremoso', 8, 10, false),
  ('32f47d1e-6974-42dd-8dea-b14637af31cb', 'a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'a7a1d30f-9c33-41d6-a1fd-e3c627d5ab0e', 'Bacon crocante', 7, 10, false),
  ('d3c39079-590b-4814-bd2c-e6fc609ed072', 'a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'a7a1d30f-9c33-41d6-a1fd-e3c627d5ab0e', 'Muçarela extra', 6, 20, false),
  ('b3e39dce-05c9-44c9-a499-39c7b2fe24a8', 'a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'c7afc4aa-846d-41a0-a9e1-21eaf6ef7f44', 'Sem borda recheada', 0, 5, true),
  ('f91b6694-f9e3-49d0-9cbd-21e62f930309', 'a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'c7afc4aa-846d-41a0-a9e1-21eaf6ef7f44', 'Cheddar', 8, 20, false),
  ('e30d1469-550e-4447-a84c-dd9a7d3ca4a5', 'a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'a7a1d30f-9c33-41d6-a1fd-e3c627d5ab0e', 'Cebola caramelizada', 4, 30, false),
  ('834f4e92-7b2c-4266-bb64-a3efb0bf3d4a', 'a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', '3c1d5d69-b1a4-43c7-bc83-d92a6edcb59d', 'Smash simples', 0, 10, true),
  ('1f98f3dd-8d57-40c4-b1bd-c9c9f4726518', 'a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', '3c1d5d69-b1a4-43c7-bc83-d92a6edcb59d', 'Smash duplo', 9, 20, false),
  ('bf76856c-aedb-4a24-a3ba-97f631942017', 'a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', '3c1d5d69-b1a4-43c7-bc83-d92a6edcb59d', 'Smash triplo', 17, 30, false),
  ('16c72ad2-282b-4ce5-84a2-1fb2cc171d21', 'a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', '4e7e4eb6-d627-4e92-8d14-8c4db2a34975', 'Coca-Cola', 0, 10, true),
  ('e589cf71-0b6e-4482-8f4e-af2c08b64a31', 'a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', '4e7e4eb6-d627-4e92-8d14-8c4db2a34975', 'Guaraná', 0, 20, false)
on conflict (id) do update set
  name = excluded.name,
  price_delta = excluded.price_delta,
  updated_at = now();

insert into public.product_modifier_groups (
  tenant_id, store_id, product_id, modifier_group_id, display_order
) values
  ('a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'f4aa27e8-954b-4bf3-bceb-9ccdf1eb6d32', '10f959fb-d35f-4ad3-8c46-fd431d52be88', 10),
  ('a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'f4aa27e8-954b-4bf3-bceb-9ccdf1eb6d32', 'c7afc4aa-846d-41a0-a9e1-21eaf6ef7f44', 20),
  ('a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'f4aa27e8-954b-4bf3-bceb-9ccdf1eb6d32', 'a7a1d30f-9c33-41d6-a1fd-e3c627d5ab0e', 30),
  ('a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'e7f8a13e-77cc-4196-bd03-1f89c5e3d9a1', '10f959fb-d35f-4ad3-8c46-fd431d52be88', 10),
  ('a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'e7f8a13e-77cc-4196-bd03-1f89c5e3d9a1', 'c7afc4aa-846d-41a0-a9e1-21eaf6ef7f44', 20),
  ('a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'e7f8a13e-77cc-4196-bd03-1f89c5e3d9a1', 'a7a1d30f-9c33-41d6-a1fd-e3c627d5ab0e', 30),
  ('a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'bdf8147d-3fb8-4f77-bb28-2c60b2775de9', '10f959fb-d35f-4ad3-8c46-fd431d52be88', 10),
  ('a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'bdf8147d-3fb8-4f77-bb28-2c60b2775de9', 'c7afc4aa-846d-41a0-a9e1-21eaf6ef7f44', 20),
  ('a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'bdf8147d-3fb8-4f77-bb28-2c60b2775de9', 'a7a1d30f-9c33-41d6-a1fd-e3c627d5ab0e', 30),
  ('a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'c9d7ca2f-33d3-49ac-b7e0-d37a1c33208e', '3c1d5d69-b1a4-43c7-bc83-d92a6edcb59d', 10),
  ('a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'c9d7ca2f-33d3-49ac-b7e0-d37a1c33208e', 'a7a1d30f-9c33-41d6-a1fd-e3c627d5ab0e', 20),
  ('a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', '09f1da3b-b8e0-4d09-89bc-b4b643b93b41', '3c1d5d69-b1a4-43c7-bc83-d92a6edcb59d', 10),
  ('a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', '09f1da3b-b8e0-4d09-89bc-b4b643b93b41', 'a7a1d30f-9c33-41d6-a1fd-e3c627d5ab0e', 20),
  ('a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'bbfd1110-7b25-464e-8c4c-8c89125f5bd5', 'a7a1d30f-9c33-41d6-a1fd-e3c627d5ab0e', 10),
  ('a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', '45fe7f2e-6eb4-48f0-ad38-b7a07aac4a6d', '4e7e4eb6-d627-4e92-8d14-8c4db2a34975', 10)
on conflict do nothing;

insert into public.delivery_zones (
  id, tenant_id, store_id, name, zone_type, neighborhood_names,
  delivery_fee, minimum_order_amount, free_delivery_above, extra_minutes
) values (
  'ea4b7c6e-5c22-4b2c-9a7f-65dbd402ba5d',
  'a73db9c1-a166-47d7-934a-dbe2f82a27d1',
  '47c91484-0c28-497a-90ed-317d40e7a2dc',
  'Centro', 'neighborhood', array['Centro'], 6, 25, 80, 5
) on conflict (id) do update set
  delivery_fee = excluded.delivery_fee,
  minimum_order_amount = excluded.minimum_order_amount,
  updated_at = now();

insert into public.kds_stations (
  id, tenant_id, store_id, name, code, display_order
) values
  ('026792af-9ad2-4379-a6b5-5b3a8b415090', 'a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'Cozinha', 'kitchen', 10),
  ('b7c43f79-579b-44fd-8236-52ad851d7529', 'a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'Pizzaria', 'pizza', 20)
on conflict (id) do update set name = excluded.name, updated_at = now();

insert into public.kds_station_routes (
  id, tenant_id, store_id, station_id, category_id
) values
  ('5a6b04e0-5bf9-4b3e-b7cc-c8ccf7bc8ab1', 'a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', 'b7c43f79-579b-44fd-8236-52ad851d7529', 'a169401d-34da-43f7-bc9c-93d6abc7682f'),
  ('87c71d0b-2e0f-4df2-a708-3bc892156f48', 'a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', '026792af-9ad2-4379-a6b5-5b3a8b415090', 'b7c32e9c-2f35-43d4-a6dc-a98de5c08ec5'),
  ('b6cb76d1-83a2-4a4d-8d8a-dba15827fba9', 'a73db9c1-a166-47d7-934a-dbe2f82a27d1', '47c91484-0c28-497a-90ed-317d40e7a2dc', '026792af-9ad2-4379-a6b5-5b3a8b415090', 'c2378d5b-5a82-494e-97d9-6bc8ce58f75a')
on conflict (id) do nothing;
