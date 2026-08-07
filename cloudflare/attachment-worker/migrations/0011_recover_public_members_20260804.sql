-- Portal v6.47.2 / Worker v1.13.2
-- Recuperação corretiva e não destrutiva do diretório público de associados.
-- Fonte: backup dados.json de 2026-08-04T15:02:49.013Z.
--
-- Esta migração:
--   * restaura 32 registros públicos por UPSERT;
--   * preserva dados mais recentes já existentes no D1;
--   * recupera somente campos públicos do cadastro;
--   * preenche data de nascimento e foto somente quando ausentes;
--   * não altera tabelas de tesouraria, grupos, mensalidades, Mútuas ou anexos;
--   * mantém o schema_version em 9, pois não há alteração estrutural.

INSERT INTO portal_members
  (id, sort_order, name, member_number, status, active, mutual, payload, updated_at)
VALUES
  ('b_ms3xe4af_85o3yp', 0, 'João Augusto Batista de Paula', '26766037', 'Ativo', 1, 0, '{"id":"b_ms3xe4af_85o3yp","memberNumber":"26766037","name":"João Augusto Batista de Paula","birthDate":"1995-01-02","photo":"./public/members/b_ms3xe4af_85o3yp-0vufniq.jpg","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_ms3xfcuq_bi8m42', 1, 'Adriano Moreira', '5422860', 'Ativo', 1, 0, '{"id":"b_ms3xfcuq_bi8m42","memberNumber":"5422860","name":"Adriano Moreira","birthDate":"1986-04-09","photo":"./public/members/b_ms3xfcuq_bi8m42-1fjpvgj.jpg","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_ms3xfobh_l0tq8n', 2, 'Amanda Cristina Gozzi', '4513801', 'Ativo', 1, 0, '{"id":"b_ms3xfobh_l0tq8n","memberNumber":"4513801","name":"Amanda Cristina Gozzi","birthDate":"1985-09-11","photo":"./public/members/b_ms3xfobh_l0tq8n-0sse4y8.jpg","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_ms3xg16k_59dtg6', 3, 'Ana Elisa Almeida', '6050953', 'Ativo', 1, 0, '{"id":"b_ms3xg16k_59dtg6","memberNumber":"6050953","name":"Ana Elisa Almeida","birthDate":"1982-12-26","photo":"./public/members/b_ms3xg16k_59dtg6-0dn6bo1.jpg","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_ms3xh5de_4qya3j', 4, 'Daniel Flávio Gozzi', '2952240', 'Ativo', 1, 0, '{"id":"b_ms3xh5de_4qya3j","memberNumber":"2952240","name":"Daniel Flávio Gozzi","birthDate":"1981-03-18","photo":"./public/members/b_ms3xh5de_4qya3j-0wm9squ.jpg","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_ms3xhsbp_w6a41l', 5, 'Denis Coelho', '6268378', 'Ativo', 1, 0, '{"id":"b_ms3xhsbp_w6a41l","memberNumber":"6268378","name":"Denis Coelho","birthDate":"1984-08-26","photo":"./public/members/b_ms3xhsbp_w6a41l-1meip7w.jpg","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_ms3xi4tc_b25op6', 6, 'Evelin do Nascimento Ferreira', '5434595', 'Ativo', 1, 0, '{"id":"b_ms3xi4tc_b25op6","memberNumber":"5434595","name":"Evelin do Nascimento Ferreira","birthDate":"1985-11-04","photo":"./public/members/b_ms3xi4tc_b25op6-0aae7x6.jpg","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_ms3xkgot_6anwnv', 7, 'Fernanda Bolfarini Franciscatte', '4369494', 'Ativo', 1, 0, '{"id":"b_ms3xkgot_6anwnv","memberNumber":"4369494","name":"Fernanda Bolfarini Franciscatte","birthDate":"1981-08-21","photo":"./public/members/b_ms3xkgot_6anwnv-1ua47i7.jpg","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_ms3xlhbw_3m6x55', 8, 'Larissa Baldesserra', '6268385', 'Ativo', 1, 0, '{"id":"b_ms3xlhbw_3m6x55","memberNumber":"6268385","name":"Larissa Baldesserra","birthDate":"1986-07-31","photo":"./public/members/b_ms3xlhbw_3m6x55-1c3jbl8.jpg","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_ms3xlpvb_50kztj', 9, 'Luiz Henrique Franciscatte', '3180578', 'Ativo', 1, 0, '{"id":"b_ms3xlpvb_50kztj","memberNumber":"3180578","name":"Luiz Henrique Franciscatte","birthDate":"1979-08-22","photo":"./public/members/b_ms3xlpvb_50kztj-06h8bs9.jpg","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_ms3xmb4t_6ypluu', 10, 'Marcelo Facina', '4899771', 'Ativo', 1, 0, '{"id":"b_ms3xmb4t_6ypluu","memberNumber":"4899771","name":"Marcelo Facina","birthDate":"1974-11-18","photo":"./public/members/b_ms3xmb4t_6ypluu-1dxaqc0.jpg","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_ms3xmsdr_8ui1ex', 11, 'Marcos Antônio de Almeida', '3180579', 'Ativo', 1, 0, '{"id":"b_ms3xmsdr_8ui1ex","memberNumber":"3180579","name":"Marcos Antônio de Almeida","birthDate":"1974-10-30","photo":"./public/members/b_ms3xmsdr_8ui1ex-0j8m4in.jpg","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_ms3xn2nf_jifrzi', 12, 'Maria Aparecida Gonçalves', '6268395', 'Ativo', 1, 0, '{"id":"b_ms3xn2nf_jifrzi","memberNumber":"6268395","name":"Maria Aparecida Gonçalves","birthDate":"1960-06-13","photo":"./public/members/b_ms3xn2nf_jifrzi-0833oql.jpg","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_ms3xnmv9_jt5r46', 13, 'Maria Madalena da Rocha', '4399595', 'Ativo', 1, 0, '{"id":"b_ms3xnmv9_jt5r46","memberNumber":"4399595","name":"Maria Madalena da Rocha","birthDate":"1957-03-10","photo":"./public/members/b_ms3xnmv9_jt5r46-0b81ktu.jpg","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_ms3xnxct_7h4wxe', 14, 'Mario Gozzi', '1269624', 'Ativo', 1, 0, '{"id":"b_ms3xnxct_7h4wxe","memberNumber":"1269624","name":"Mario Gozzi","birthDate":"1954-04-15","photo":"./public/members/b_ms3xnxct_7h4wxe-08qplbh.jpg","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_ms3xo8wh_z97ryn', 15, 'Matheus Prado', '6018451', 'Ativo', 1, 0, '{"id":"b_ms3xo8wh_z97ryn","memberNumber":"6018451","name":"Matheus Prado","birthDate":"1991-02-08","photo":"./public/members/b_ms3xo8wh_z97ryn-1yd86hz.jpg","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_ms3xojdz_4w1hbv', 16, 'Michel Carvalho da Silva', '3730065', 'Ativo', 1, 0, '{"id":"b_ms3xojdz_4w1hbv","memberNumber":"3730065","name":"Michel Carvalho da Silva","birthDate":"1988-08-06","photo":"./public/members/b_ms3xojdz_4w1hbv-01l2sy1.jpg","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_ms3xp6en_ka98gi', 17, 'Oswaldo Brancalhão', '2347336', 'Ativo', 1, 0, '{"id":"b_ms3xp6en_ka98gi","memberNumber":"2347336","name":"Oswaldo Brancalhão","birthDate":"1946-07-24","photo":"./public/members/b_ms3xp6en_ka98gi-1ffcm70.jpg","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_ms3xpn5s_svjeqa', 18, 'Regina Freire', '5431884', 'Ativo', 1, 0, '{"id":"b_ms3xpn5s_svjeqa","memberNumber":"5431884","name":"Regina Freire","birthDate":"1979-09-06","photo":"./public/members/b_ms3xpn5s_svjeqa-1uz2u8u.jpg","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_ms3xpzjw_4n88dj', 19, 'Roberta Bolfarini Jabur Freire', '6334429', 'Ativo', 1, 0, '{"id":"b_ms3xpzjw_4n88dj","memberNumber":"6334429","name":"Roberta Bolfarini Jabur Freire","birthDate":"2005-09-26","photo":"./public/members/b_ms3xpzjw_4n88dj-1enit2l.jpg","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_ms3xq92x_jjequd', 20, 'Roberto Freire', '5422283', 'Ativo', 1, 0, '{"id":"b_ms3xq92x_jjequd","memberNumber":"5422283","name":"Roberto Freire","birthDate":"1964-10-26","photo":"./public/members/b_ms3xq92x_jjequd-0ilo1gj.jpg","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_ms3xqh6q_on357v', 21, 'Rogério Andreotti', '2676743', 'Ativo', 1, 0, '{"id":"b_ms3xqh6q_on357v","memberNumber":"2676743","name":"Rogério Andreotti","birthDate":"1972-12-20","photo":"./public/members/b_ms3xqh6q_on357v-13hlg0a.jpg","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_ms3xr0sd_wd81n3', 22, 'Sônia Maria Brancalhão', '4369499', 'Ativo', 1, 0, '{"id":"b_ms3xr0sd_wd81n3","memberNumber":"4369499","name":"Sônia Maria Brancalhão","birthDate":"1950-12-31","photo":"./public/members/b_ms3xr0sd_wd81n3-011nztq.jpg","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_ms3xrctq_knqsof', 23, 'Sueli Neves', '6050963', 'Ativo', 1, 0, '{"id":"b_ms3xrctq_knqsof","memberNumber":"6050963","name":"Sueli Neves","birthDate":"1974-08-07","photo":"./public/members/b_ms3xrctq_knqsof-0aokyx8.jpg","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_ms3xrlee_op8bsq', 24, 'Tamires Priscila Gonçalves da Silva', '26767938', 'Ativo', 1, 0, '{"id":"b_ms3xrlee_op8bsq","memberNumber":"26767938","name":"Tamires Priscila Gonçalves da Silva","birthDate":"1987-11-23","photo":"./public/members/b_ms3xrlee_op8bsq-0xd3pjb.jpg","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_ms3xrshl_znpzq8', 25, 'Vitoria Caroline Zibordi', '26766028', 'Ativo', 1, 0, '{"id":"b_ms3xrshl_znpzq8","memberNumber":"26766028","name":"Vitoria Caroline Zibordi","birthDate":"2000-04-27","photo":"./public/members/b_ms3xrshl_znpzq8-0svxf3e.jpg","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_ms3zd19y_z8aqbx', 26, 'Gustavo Almeida', '6050955', 'Ativo', 1, 0, '{"id":"b_ms3zd19y_z8aqbx","memberNumber":"6050955","name":"Gustavo Almeida","birthDate":"1982-12-19","photo":"./public/members/b_ms3zd19y_z8aqbx-1pn7w1b.jpg","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_ms40ff4a_n4tgfl', 27, 'Aparecido Batista da Silva', '27350180', 'Ativo', 1, 0, '{"id":"b_ms40ff4a_n4tgfl","memberNumber":"27350180","name":"Aparecido Batista da Silva","birthDate":"1981-10-14","photo":"./public/members/b_ms40ff4a_n4tgfl-1tqyfk2.jpg","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_ms40it6p_0df3zb', 28, 'Silvio Begosso', '1264267', 'Ativo', 1, 0, '{"id":"b_ms40it6p_0df3zb","memberNumber":"1264267","name":"Silvio Begosso","birthDate":"1957-01-01","photo":"","status":"Ativo","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_mse09jtk_ksrs8z', 29, 'Maria de Lurdes B. Franciscatte', '', 'Mútua', 1, 1, '{"id":"b_mse09jtk_ksrs8z","memberNumber":"","name":"Maria de Lurdes B. Franciscatte","birthDate":"2000-01-01","photo":"","status":"Mútua","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_mse0ajj2_8450i5', 30, 'Elda Cecilia Bolfarini Jabur', '', 'Mútua', 1, 1, '{"id":"b_mse0ajj2_8450i5","memberNumber":"","name":"Elda Cecilia Bolfarini Jabur","birthDate":"2000-01-01","photo":"","status":"Mútua","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('b_mse0ax4r_eics02', 31, 'João Batista de Melo Jabur', '', 'Mútua', 1, 1, '{"id":"b_mse0ax4r_eics02","memberNumber":"","name":"João Batista de Melo Jabur","birthDate":"2000-01-01","photo":"","status":"Mútua","active":true}', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(id) DO UPDATE SET
  sort_order = portal_members.sort_order,
  name = CASE
    WHEN trim(portal_members.name) = '' THEN excluded.name
    ELSE portal_members.name
  END,
  member_number = CASE
    WHEN trim(portal_members.member_number) = '' THEN excluded.member_number
    ELSE portal_members.member_number
  END,
  status = CASE
    WHEN trim(portal_members.status) = '' THEN excluded.status
    ELSE portal_members.status
  END,
  active = portal_members.active,
  mutual = CASE
    WHEN portal_members.mutual = 1 OR excluded.mutual = 1 THEN 1
    ELSE 0
  END,
  payload = json_set(
    json_patch(excluded.payload, portal_members.payload),
    '$.birthDate',
    CASE
      WHEN trim(COALESCE(json_extract(portal_members.payload, '$.birthDate'), '')) = ''
        THEN json_extract(excluded.payload, '$.birthDate')
      ELSE json_extract(portal_members.payload, '$.birthDate')
    END,
    '$.photo',
    CASE
      WHEN trim(COALESCE(json_extract(portal_members.payload, '$.photo'), '')) = ''
        THEN json_extract(excluded.payload, '$.photo')
      ELSE json_extract(portal_members.payload, '$.photo')
    END
  ),
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

INSERT INTO portal_meta (key, value) VALUES
  ('public_revision', 'recovery-members-20260804-v1'),
  ('public_updated_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('public_updated_by', 'migration-0011'),
  ('public_schema_version', '11'),
  ('public_data_d1', '1'),
  ('public_migration_complete', '1'),
  ('member_directory_updated_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(key) DO UPDATE SET value = excluded.value;

INSERT INTO portal_module_revisions (module, revision, updated_at, updated_by)
VALUES
  ('public', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'migration-0011'),
  ('member-directory', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 'migration-0011')
ON CONFLICT(module) DO UPDATE SET
  revision = portal_module_revisions.revision + 1,
  updated_at = excluded.updated_at,
  updated_by = excluded.updated_by;

PRAGMA optimize;
