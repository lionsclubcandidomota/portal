# Release 6.47.0

Data: 07/08/2026

## Escopo

- Portal 6.47.0: todos os dados estruturados são lidos e gravados pelo Cloudflare D1.
- Worker 1.13.0: API pública D1, publicação transacional, migração automática do conteúdo anterior e mídias públicas no R2.
- D1 esquema 9: tabelas públicas, histórico de publicações e revisão do módulo público.
- R2: mídias públicas, anexos privados e backups.
- Hospedagem estática: somente a interface.

## Ordem obrigatória de implantação

### 1. Manter a versão 6.46.0 publicada

Não remova ainda `data/dados.json`, o logo ou as fotos antigas. Eles serão a fonte da importação inicial.

### 2. Preparar o Worker 1.13.0

Copie o `wrangler.toml` da versão anterior e mantenha os bindings `PORTAL_DB` e `ATTACHMENTS`.

Adicione temporariamente:

```toml
PUBLIC_DATA_URL = "https://lionsclubcandidomota.github.io/portal/data/dados.json"
```

### 3. Publicar o Worker

```bash
npm ci
npx wrangler deploy --config wrangler.toml
```

### 4. Aplicar a migração

```bash
npx wrangler d1 migrations apply lions-portal-dados --remote --config wrangler.toml
```

Confirme `0010_public_portal_d1.sql`.

### 5. Importar o conteúdo público

Faça logout e login novamente como Administrador. O Worker detecta o D1 público vazio e importa automaticamente o JSON e as mídias da versão 6.46.0.

Como alternativa administrativa, a rota autenticada abaixo executa a mesma importação:

```text
POST /api/storage/migrate-public-d1
```

### 6. Conferir o `/health`

```json
{
  "workerVersion": "1.13.0",
  "d1": {
    "active": true,
    "schemaVersion": 9,
    "requiredSchemaVersion": 9
  },
  "automaticSync": {
    "available": true,
    "intervalSeconds": 60,
    "lightweightRevisionCheck": true
  },
  "publicData": {
    "source": "d1",
    "active": true,
    "media": "cloudflare-r2"
  },
  "structuredDataSource": "cloudflare-d1",
  "snapshotPolicy": "recovery-only"
}
```

Contagens esperadas do conjunto atual:

```text
32 associados
12 eventos
3 reuniões
2 avisos
```

### 7. Publicar o Portal 6.47.0

Somente depois da conferência, publique `portal-site-v6.47.0.zip`. Esse pacote não contém o JSON operacional nem as fotos dinâmicas antigas.

### 8. Encerrar a transição

Depois da homologação:

- remova `PUBLIC_DATA_URL` do Worker;
- remova `GITHUB_TOKEN`, caso ainda esteja cadastrado;
- mantenha os pacotes 6.46.0 e 1.12.0 durante a janela de rollback.

## Testes essenciais

1. Abrir o Portal como visitante e validar associados, agenda, reuniões e avisos.
2. Abrir algumas fotos de associados.
3. Entrar como Administrador e alterar um aviso.
4. Publicar e conferir a nova revisão no D1.
5. Abrir uma segunda sessão e validar atualização sem F5 em até 60 segundos.
6. Testar Movimentações, Mensalidades, Mútuas, relatórios e anexos.
7. Criar um backup manual e executar o diagnóstico de integridade.
8. Confirmar que o site publicado não contém `data/dados.json`, `public/members` ou `public/treasury`.

## Segurança

- O navegador não acessa diretamente D1 ou R2.
- O payload público bloqueia coleções privadas e credenciais.
- Mídias novas são removidas do R2 quando a transação pública falha.
- Revalidações públicas usam ETag e resposta 304.
- `GITHUB_TOKEN` não é necessário.
