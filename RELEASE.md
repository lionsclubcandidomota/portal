# Release 6.45.0

Data: 07/08/2026

## Escopo

- Portal 6.45.0: login administrativo passa a carregar uma base operacional privada reduzida.
- Worker 1.11.0: adiciona bootstrap relacional leve e gravação granular de configurações, contas e categorias.
- D1 esquema 7: ativa `private_bootstrap_read_model` e `reference_granular_writes`.

## Ordem obrigatória de implantação

1. Extrair o Worker 1.11.0.
2. Copiar para a nova pasta o `wrangler.toml` já configurado da versão anterior.
3. Executar:

   ```bash
   npm ci
   npx wrangler deploy --config wrangler.toml
   ```

4. Aplicar a migração:

   ```bash
   npx wrangler d1 migrations apply lions-portal-dados --remote --config wrangler.toml
   ```

5. Confirmar a aplicação de `0008_private_bootstrap_reference.sql`.
6. Conferir o `/health` com Worker 1.11.0 e esquema D1 7.
7. Publicar o Portal 6.45.0 no GitHub Pages.

O Worker pode ser publicado antes da migração. Enquanto o esquema 7 não estiver ativo, o endpoint de bootstrap usa o estado completo como compatibilidade. O Portal só passa ao modo reduzido quando o Worker retorna `partial: true`.

## Novo carregamento após o login

O endpoint autenticado:

```text
GET /api/private-state/bootstrap
```

retorna:

- configurações privadas;
- contas e categorias;
- grupos familiares;
- grupos de Mútuas, vínculos e eventos;
- pagamentos de Mensalidades e Mútuas usados nos formulários e validações;
- revisão atual e contagens do banco.

Movimentações financeiras ordinárias deixam de ser enviadas integralmente no login. As páginas de Movimentações continuam consultando o D1 e hidratam somente os registros exibidos.

## Gravação de referências

A rota:

```text
PUT /api/private-state/reference
```

atualiza somente:

- configurações financeiras privadas;
- contas da Tesouraria;
- categorias financeiras.

Movimentações, anexos, grupos familiares e Mútuas permanecem intactos. A operação usa revisão otimista, `mutationId` idempotente e lote transacional.

## Segurança contra perda de dados

Quando o Portal opera em modo reduzido, o salvamento automático não pode recorrer silenciosamente à substituição do estado completo. Operações comuns devem ser classificadas como:

- `granular-treasury`;
- `granular-groups`;
- `granular-reference`.

Importações, restaurações e migrações continuam usando o fluxo completo de recuperação.

## Testes recomendados

1. Entrar como Administrador e confirmar **Banco sincronizado**.
2. Abrir Movimentações e navegar por mais de uma página.
3. Editar uma movimentação exibida, recarregar e conferir a alteração.
4. Criar e excluir uma movimentação de teste.
5. Alterar uma conta ou categoria e confirmar a persistência após recarregar.
6. Alterar os valores de Mensalidades e conferir a tela de baixa.
7. Registrar uma mensalidade e uma baixa de Mútua, garantindo que duplicidades continuam bloqueadas.
8. Criar um backup manual e conferir a Central de Recuperação.
9. Confirmar que operações privadas não criam commit no GitHub.

## Resultado esperado no `/health`

```json
{
  "workerVersion": "1.11.0",
  "privateState": "d1",
  "privateAutosave": "relational-lazy-bootstrap",
  "d1": {
    "active": true,
    "schemaVersion": 7,
    "requiredSchemaVersion": 7
  },
  "granularWrites": {
    "treasury": true,
    "groups": true,
    "reference": true,
    "snapshotPerMutation": false
  },
  "optimizedReads": {
    "privateBootstrap": true
  },
  "privateBootstrap": {
    "available": true,
    "strategy": "reference-data-plus-payment-working-set"
  }
}
```
