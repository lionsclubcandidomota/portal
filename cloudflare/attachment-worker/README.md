# Worker de dados privados — Portal Lions

O Worker 1.3.0 usa dois serviços Cloudflare:

- **D1 (`PORTAL_DB`)**: fonte principal dos dados privados estruturados após a migração;
- **R2 (`ATTACHMENTS`)**: comprovantes, documentos, backups versionados e espelho de contingência.

Nenhum binding, chave R2 ou credencial D1 é enviado ao navegador.

## 1. Configuração

Copie `wrangler.toml.example` para `wrangler.toml`.

Configure o bucket existente:

```toml
[[r2_buckets]]
binding = "ATTACHMENTS"
bucket_name = "lions-portal-documentos"
```

Crie o banco e use o `database_id` retornado:

```bash
npm install
npx wrangler d1 create lions-portal-dados
```

```toml
[[d1_databases]]
binding = "PORTAL_DB"
database_name = "lions-portal-dados"
database_id = "UUID_RETORNADO_PELA_CLOUDFLARE"
migrations_dir = "migrations"
```

O bucket deve permanecer privado, sem domínio público e sem `r2.dev`.

## 2. Aplicar as migrações D1

```bash
npx wrangler d1 migrations apply lions-portal-dados --remote
```

A migração `0001_portal_private_state.sql` cria o esquema inicial e mantém o banco inativo até que o Administrador faça o corte pela Central de Recuperação.

## 3. Segredo de sessão

```bash
npx wrangler secret put SESSION_SECRET
```

Use uma sequência aleatória com pelo menos 32 caracteres. Não grave o segredo no Git.

## 4. Verificação e publicação

```bash
npm ci
npm run check
npm run deploy
```

O `wrangler.ci.toml` existe somente para `deploy --dry-run` e não deve ser usado em produção.

## 5. Corte do R2 para o D1

Depois de publicar o Worker e o Portal:

1. entre como Administrador;
2. abra **Recuperação e integridade**;
3. confira **Banco pronto para receber os dados**;
4. clique em **Migrar para o D1**.

O Worker cria um backup no R2, grava o snapshot canônico e as projeções relacionais em uma transação D1 e ativa o banco. O R2 permanece como espelho de contingência.

## Rotas de armazenamento

- `GET /api/storage/status`: informa backend ativo, esquema e contagens;
- `POST /api/storage/migrate-d1`: migra o estado atual do R2 para o D1;
- `POST /api/storage/rollback-r2`: copia o estado D1 para o R2 e retorna temporariamente;
- `GET /api/private-state`: lê da fonte ativa;
- `PUT /api/private-state`: grava na fonte ativa;
- `GET/POST /api/private-state/backups`: lista ou cria backups R2;
- `POST /api/private-state/backups/restore`: restaura no backend ativo;
- `GET /api/private-state/integrity`: confere dados e anexos.

## Segurança e continuidade

- Administrador: token do GitHub é validado e trocado por uma sessão temporária.
- Diretoria: senha validada pelo perfil privado, sem acesso de escrita.
- Visitante: não recebe sessão nem dados privados.
- D1: snapshot e projeções relacionais são executados pelo mesmo `batch()` transacional.
- Escritas em massa usam lotes JSON compactos e um teto de 40 consultas por sincronização.
- R2: mantém 20 backups versionados, anexos e espelho atual.
- Gravações que removeriam todos os registros privados continuam bloqueadas.

O roteiro completo está em `docs/cloudflare-d1-migration.md`.
