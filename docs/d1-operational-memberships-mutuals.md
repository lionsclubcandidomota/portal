# Guia de implantação — Portal 6.44.0 e Worker 1.10.0

## Objetivo

Ativar leituras paginadas no D1 para Mensalidades e Mútuas, mantendo o estado local apenas como contingência.

## Ordem de implantação

1. Extraia `cloudflare-worker-v1.10.0.zip`.
2. Copie o `wrangler.toml` configurado da versão anterior.
3. Execute:

```cmd
npm ci
npx wrangler deploy --config wrangler.toml
npx wrangler d1 migrations apply lions-portal-dados --remote --config wrangler.toml
```

4. Confirme a migração `0007_operational_memberships_mutuals.sql`.
5. Confira o `/health`.
6. Publique `portal-main-v6.44.0.zip` no repositório.

## Health esperado

```json
{
  "workerVersion": "1.10.0",
  "privateState": "d1",
  "d1": {
    "active": true,
    "schemaVersion": 6,
    "requiredSchemaVersion": 6
  },
  "optimizedReads": {
    "dashboard": true,
    "reports": true,
    "treasuryPagination": true,
    "memberships": true,
    "mutuals": true
  },
  "memberDirectory": {
    "available": true,
    "updatedAt": "..."
  }
}
```

## Testes

### Mensalidades

- confirme `D1 · consulta paginada`;
- altere o período;
- pesquise um associado;
- filtre por grupo familiar e situação;
- navegue entre páginas;
- registre uma baixa e recarregue.

### Mútuas

- confirme `D1 · eventos paginados`;
- filtre por grupo, datas e situação;
- pesquise falecido ou participante;
- navegue entre páginas de eventos;
- confirme que a seleção é limpa ao trocar de página;
- registre uma baixa e recarregue.

## Diretório de associados

O diretório é atualizado automaticamente após uma publicação pública. Também pode ser forçado por uma sessão de Administrador com:

```text
POST /api/operational/member-directory/sync
```

Não é necessário executar essa rota manualmente em condições normais.

## Retorno seguro

O Worker anterior continua compatível com o esquema já existente, mas não conhece as novas rotas. Em caso de problema visual, o Portal usa o fallback local. Não remova a migração nem a tabela `portal_members`; ela é uma projeção reconstruível e não contém credenciais.
