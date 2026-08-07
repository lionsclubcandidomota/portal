# Leituras otimizadas no Cloudflare D1

## Objetivo

A versão 6.42.0 evita que o navegador percorra todas as movimentações para calcular o resumo financeiro do Dashboard Administrativo e evita enviar todo o estado privado para gerar relatórios financeiros.

## Endpoints

### Dashboard

```text
GET /api/analytics/dashboard?start=AAAA-MM-DD&end=AAAA-MM-DD
```

Perfis permitidos: Administrador e Diretoria.

A consulta usa `treasury_movements` e retorna agregações do período. Datas vazias representam todo o histórico.

### Relatórios

```text
GET /api/analytics/report?type=movements|memberships|mutuals&start=...&end=...
```

A resposta contém somente um recorte do estado necessário ao relatório escolhido.

## Índices da migração 0005

- `idx_treasury_movements_category_status_date`;
- `idx_treasury_movements_date_amounts`;
- `idx_treasury_movements_mutual_date`;
- `idx_mutual_events_date_group_amount`.

Os índices foram limitados às consultas realmente usadas nesta etapa para não aumentar gravações desnecessárias.

## Compatibilidade de implantação

O Worker 1.8.0 mantém as gravações existentes nos esquemas 3 e 4. Isso permite publicar o Worker antes de aplicar `0005`, reduzindo a janela de incompatibilidade.

As rotas de analytics só são liberadas quando:

```text
D1 ativo
schemaVersion >= 4
analytics_read_models = 1
```

## Fallback

O Portal renderiza inicialmente com dados locais. Quando o D1 responde, o card da Tesouraria é atualizado e exibe o selo de consulta otimizada. Em falha de rede ou esquema incompleto, a interface permanece com o cálculo local.

A geração de relatórios também tenta primeiro o D1 e retorna ao estado local sem interromper o usuário.

## Próxima etapa

A etapa final deverá:

- tornar tabelas relacionais a fonte oficial das leituras operacionais;
- carregar telas por página e filtros;
- remover a atualização do snapshot a cada mutação granular;
- gerar snapshots somente em backups, restaurações e migrações;
- revisar índices com métricas reais do D1.
