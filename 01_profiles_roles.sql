-- 01_profiles_roles.sql
-- AAC Migration Import
-- Run in Supabase SQL Editor AFTER applying schema migrations

-- profiles (15 rows)
INSERT INTO public.profiles (id, email, first_name, last_name, phone, created_at, updated_at, deactivated_at) VALUES
  ('976a874d-2c36-4799-b29e-db43604f01d8', 'charles.joseph@compass.com', NULL, NULL, NULL, '2025-11-12 00:17:55.925923+00', '2025-11-12 00:17:55.925923+00', NULL),
  ('4ef7789b-20d8-40d3-9fee-3c41fae2bdc5', 'betsy.mccombs@compass.com', NULL, NULL, NULL, '2025-11-14 21:38:32.485937+00', '2025-11-14 21:38:32.485937+00', NULL),
  ('6c4f5998-c6eb-4c6b-94e0-fc4d45dccc90', 'carmen.veradiaz@compass.com', NULL, NULL, NULL, '2025-11-14 23:41:59.453394+00', '2025-11-14 23:41:59.453394+00', NULL),
  ('1fc50da1-2664-4931-8cab-64e24dc5ed8c', 'chris@allagentconnect.com', NULL, NULL, NULL, '2025-12-22 17:16:04.633821+00', '2025-12-22 17:16:04.633821+00', NULL),
  ('ad7dc620-8509-490f-a3e0-f4b53deec8a0', 'arthur.cantor@cbrealty.com', NULL, NULL, NULL, '2026-01-06 16:43:48.769985+00', '2026-01-06 16:43:48.769985+00', NULL),
  ('93f6a854-84f5-4fcd-ae5c-418df2833712', 'bedjanovd@gmail.com', NULL, NULL, NULL, '2026-01-24 00:23:14.591734+00', '2026-01-24 00:23:14.591734+00', NULL),
  ('0ee5ab94-66d6-4d2b-a66d-f68d7a70f0dd', 'laura@customhomerealty.com', NULL, NULL, NULL, '2026-01-25 12:44:05.726546+00', '2026-01-25 12:44:05.726546+00', NULL),
  ('be095312-18f9-4696-93fa-6708cc5abd3a', 'kelvin@findyouraccess.com', NULL, NULL, NULL, '2026-01-30 15:22:52.01832+00', '2026-01-30 15:22:52.01832+00', NULL),
  ('0aacace2-8892-4af9-95cf-bf24cf2ba383', 'jorge@serhant.com', NULL, NULL, NULL, '2026-02-01 16:43:02.7907+00', '2026-02-01 16:43:02.7907+00', NULL),
  ('ea18faa4-700f-4143-8c8e-436795a623af', 'tuite.chris11@gmail.com', NULL, NULL, NULL, '2026-02-04 02:38:32.429576+00', '2026-02-04 02:38:32.429576+00', NULL),
  ('1bf94075-8694-4f59-b1ad-c494e4af2c08', 'christuitet11@gmail.com', NULL, NULL, NULL, '2026-02-10 23:16:53.178317+00', '2026-02-10 23:16:53.178317+00', NULL),
  ('4520f31d-d3a7-4b93-b582-6dde0ec3313c', 'chris.tuite@compass.com', 'chris', 'tuite', NULL, '2026-02-27 00:51:40.955675+00', '2026-02-27 00:51:41.731456+00', NULL),
  ('f7942f66-fa37-490f-ae07-45eceea4fb58', 'sikander0302khan@gmail.com', NULL, NULL, NULL, '2026-03-17 11:07:45.628196+00', '2026-03-17 11:07:45.628196+00', NULL),
  ('ad29ddb8-fbb6-49d8-82d2-a160fcc14726', 'christinerocha@rrgproperty.com', NULL, NULL, NULL, '2026-03-28 13:04:12.195097+00', '2026-03-28 13:04:12.195097+00', NULL),
  ('c5878695-a228-435a-bf58-aef04eecf307', 'paigerocha@rrgproperty.com', NULL, NULL, NULL, '2026-03-30 16:58:51.148284+00', '2026-03-30 16:58:51.148284+00', NULL)
ON CONFLICT DO NOTHING;


-- user_roles (16 rows)
INSERT INTO public.user_roles (id, user_id, role, created_at) VALUES
  ('e6d41dc6-fe65-495f-afdb-0f857e47d07c', '976a874d-2c36-4799-b29e-db43604f01d8', 'agent', '2025-11-12 00:17:56.622605+00'),
  ('f2d7308f-2d1f-47e2-8bab-fc9b0538b27e', '4ef7789b-20d8-40d3-9fee-3c41fae2bdc5', 'agent', '2025-11-14 21:38:33.263948+00'),
  ('e6f02529-2820-4706-b452-5e7b9a979548', '6c4f5998-c6eb-4c6b-94e0-fc4d45dccc90', 'agent', '2025-11-14 23:42:00.138582+00'),
  ('10f3202e-5f37-42e8-a318-83a82bb17214', '1fc50da1-2664-4931-8cab-64e24dc5ed8c', 'agent', '2025-12-22 17:16:07.211872+00'),
  ('35752488-0a31-4c03-93aa-c68fa14f70cf', '1fc50da1-2664-4931-8cab-64e24dc5ed8c', 'admin', '2025-12-23 00:47:18.739123+00'),
  ('3dbe440a-d80f-4030-86be-1ad87e307029', 'ad7dc620-8509-490f-a3e0-f4b53deec8a0', 'agent', '2026-01-06 16:43:51.461097+00'),
  ('f87556b0-ec7a-436e-b81a-330b9d8a2494', '93f6a854-84f5-4fcd-ae5c-418df2833712', 'agent', '2026-01-24 00:23:15.61995+00'),
  ('8cbcdd9a-ffde-4b25-ab17-2658e8d3020f', '0ee5ab94-66d6-4d2b-a66d-f68d7a70f0dd', 'agent', '2026-01-25 12:44:07.022481+00'),
  ('d3d003a6-8266-4dc8-a6ef-6df9ce5cff78', 'be095312-18f9-4696-93fa-6708cc5abd3a', 'agent', '2026-01-30 15:22:54.061428+00'),
  ('65b28193-4b3a-421b-ad07-c33177fef238', '0aacace2-8892-4af9-95cf-bf24cf2ba383', 'agent', '2026-02-01 16:43:03.897458+00'),
  ('76ddb119-96fb-4cf2-b627-e98b0fe9d6bf', 'ea18faa4-700f-4143-8c8e-436795a623af', 'agent', '2026-02-04 02:38:33.100821+00'),
  ('ca2700df-b2b4-4c11-b21e-b81792709e82', '1bf94075-8694-4f59-b1ad-c494e4af2c08', 'agent', '2026-02-10 23:16:54.164211+00'),
  ('d431ae1f-fbec-42e5-a843-c9834a196fb6', '4520f31d-d3a7-4b93-b582-6dde0ec3313c', 'buyer', '2026-02-27 00:51:41.913804+00'),
  ('9c39a83d-9ecc-4b48-b75d-dbeb952b6bfe', 'f7942f66-fa37-490f-ae07-45eceea4fb58', 'agent', '2026-03-17 11:07:46.892309+00'),
  ('744e3d2d-e00b-48b0-ab75-5f2354a8331c', 'ad29ddb8-fbb6-49d8-82d2-a160fcc14726', 'agent', '2026-03-28 13:04:13.493565+00'),
  ('cc43d000-ec12-4f0d-97fb-c152c730814d', 'c5878695-a228-435a-bf58-aef04eecf307', 'agent', '2026-03-30 16:58:52.382528+00')
ON CONFLICT DO NOTHING;

