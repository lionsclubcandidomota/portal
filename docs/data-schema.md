# Esquema de dados do Portal — funcional v11 / D1 v9

O contrato funcional dos registros permanece na versão 11. O esquema físico do Cloudflare D1 chega à versão 9 na migração `0010_public_portal_d1.sql`.

## Fonte única estruturada

Todos os módulos estruturados ficam no D1:

- configurações públicas e privadas;
- associados e situação cadastral;
- agenda, reuniões e avisos;
- contas, categorias e movimentações;
- metadados de anexos;
- mensalidades e grupos familiares;
- grupos, eventos e cobranças de Mútuas;
- usuários, sessões e auditoria;
- revisões por módulo e histórico de publicações.

O R2 guarda os arquivos binários e backups. O site estático não contém o estado operacional.

## Tabelas públicas

- `portal_public_settings`;
- `portal_members`;
- `portal_public_events`;
- `portal_public_meetings`;
- `portal_public_notices`;
- `portal_public_media`;
- `portal_public_publications`.

Cada tabela mantém colunas indexadas para filtros e um `payload` JSON validado para preservar o contrato funcional completo.

## Tabelas privadas principais

- `portal_private_settings`;
- `treasury_accounts` e `treasury_categories`;
- `treasury_movements` e `treasury_attachments`;
- `family_groups` e `family_group_members`;
- `mutual_groups`, `mutual_memberships`, `mutual_events` e `mutual_event_participants`;
- `portal_users`, `portal_auth_sessions` e `portal_auth_audit`.

## Revisões

`portal_module_revisions` mantém revisões independentes para:

- `reference`;
- `groups`;
- `treasury`;
- `memberships`;
- `mutuals`;
- `member-directory`;
- `public`.

O navegador consulta as revisões antes de buscar novamente uma coleção.

## Mídias

O D1 armazena somente metadados e referências. Exemplos:

```json
{
  "storage": "r2",
  "objectKey": "treasury/t_123/att_123-hash.pdf",
  "checksum": "...",
  "size": 84231
}
```

Mídias públicas usam referências internas `r2://public/...` e são convertidas pela API em URLs do Worker.

## Snapshot

`portal_state_snapshot` é um artefato de recuperação. Ele pode ficar marcado como desatualizado durante a operação normal e é reconstruído a partir das tabelas relacionais quando um backup, restauração, exportação ou rollback exigir o estado integral.

## Situações das pessoas

- `Ativo`: associado ativo, elegível para Mensalidades e Mútuas conforme configuração;
- `Mútua`: mutuário não associado, elegível para Mútuas;
- `Inativo`: não entra em novas cobranças ou grupos.

## Regras das Mútuas

- grupos não possuem recorrência mensal fixa;
- cada falecimento gera um evento;
- participantes do evento ficam congelados;
- cobranças usam a chave `grupo::evento::participante`;
- pagamentos relacionam grupo, evento e participante.
