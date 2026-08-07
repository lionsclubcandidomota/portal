# Release 6.42.0

Esta etapa move **leituras gerenciais e relatórios financeiros** para consultas SQL no Cloudflare D1.

## Componentes

- Portal 6.42.0: consulta indicadores do Dashboard Administrativo no D1 e usa recortes SQL para relatórios privados.
- Worker 1.8.0: adiciona endpoints autenticados de analytics e mantém compatibilidade operacional temporária com o esquema D1 3 durante a implantação.
- Migração D1 `0005_analytics_read_models.sql`: novos índices, ativação de `analytics_read_models` e esquema D1 4.
- R2: continua armazenando anexos, backups e o espelho de contingência.

## Ordem de implantação sem interrupção

1. Atualizar o Worker para 1.8.0, preservando `wrangler.toml` e os segredos.
2. Publicar o Worker com `npx wrangler deploy --config wrangler.toml`.
3. Confirmar que o Portal continua operacional com o esquema D1 3; as leituras otimizadas ainda aparecerão como indisponíveis.
4. Executar `npx wrangler d1 migrations apply lions-portal-dados --remote --config wrangler.toml`.
5. Confirmar a aplicação de `0005_analytics_read_models.sql`.
6. Confirmar `/health` com `workerVersion: 1.8.0`, esquema D1 4 e `optimizedReads.dashboard/reports: true`.
7. Publicar o Portal 6.42.0 no GitHub Pages.
8. Abrir o Dashboard Administrativo e confirmar o selo **D1 · consulta otimizada** na Tesouraria.
9. Gerar os relatórios de Movimentações, Mensalidades e Mútuas em PDF/CSV.

## Leituras otimizadas

### Dashboard

`GET /api/analytics/dashboard`

Executa uma agregação SQL por período e retorna:

- quantidade de movimentações;
- quantidade e valor de entradas;
- quantidade e valor de saídas;
- saldo do período;
- totais realizados;
- totais programados.

Agenda, compromissos, avisos e aniversariantes continuam sendo calculados a partir do estado público, pois não pertencem ao banco privado.

### Relatórios

`GET /api/analytics/report?type=...`

Tipos privados suportados:

- `movements`: carrega somente movimentações dentro do período;
- `memberships`: carrega apenas lançamentos de mensalidades e grupos familiares;
- `mutuals`: carrega somente pagamentos de Mútuas, grupos e eventos relacionados.

Relatórios públicos — Aniversariantes, Agenda e Avisos — permanecem locais.

## Fallback

Se a consulta SQL falhar ou o esquema 4 ainda não estiver ativo, o Portal mantém os cálculos locais e a geração de relatórios a partir do estado já carregado. Nenhuma função administrativa fica indisponível.

## Limite desta etapa

O snapshot privado completo ainda é carregado após o login porque as telas operacionais continuam dependendo dele. Esta versão reduz processamento e recortes de relatórios, mas a remoção do snapshot do fluxo diário será feita na etapa final da otimização.
