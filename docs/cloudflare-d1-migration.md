# Migração do estado privado para Cloudflare D1

## Objetivo

O Portal passa a utilizar o Cloudflare D1 como fonte principal dos dados privados estruturados e mantém o R2 para:

- comprovantes e documentos;
- backups versionados;
- espelho de contingência do estado atual;
- retorno temporário ao modelo anterior, caso necessário.

A migração não altera o JSON público do GitHub Pages e não expõe dados financeiros.

## Arquitetura

```text
Portal no GitHub Pages
        │ sessão autenticada
        ▼
Cloudflare Worker 1.3.0
        ├── D1: dados privados estruturados
        └── R2: anexos, backups e espelho de contingência
```

O frontend continua usando `GET/PUT /api/private-state`. O Worker grava, na mesma transação, um snapshot JSON canônico e projeções relacionais para consultas, relatórios e vínculos. O snapshot preserva exatamente o contrato atual; as tabelas tornam os dados estruturados e indexáveis sem reconstruir as telas existentes.

As inclusões em massa são agrupadas com `json_each()` e limitadas a no máximo 40 consultas de escrita por sincronização. O fluxo permanece dentro do limite de consultas por invocação do Workers Free para o volume atual do Portal.

## 1. Criar o banco

Na pasta `cloudflare/attachment-worker`:

```bash
npm install
npx wrangler d1 create lions-portal-dados
```

O comando retorna um `database_id`. Copie `wrangler.toml.example` para `wrangler.toml` e substitua:

```toml
[[d1_databases]]
binding = "PORTAL_DB"
database_name = "lions-portal-dados"
database_id = "UUID_RETORNADO_PELA_CLOUDFLARE"
migrations_dir = "migrations"
```

Mantenha também o binding R2 existente:

```toml
[[r2_buckets]]
binding = "ATTACHMENTS"
bucket_name = "lions-portal-documentos"
```

## 2. Aplicar o esquema

```bash
npx wrangler d1 migrations apply lions-portal-dados --remote
```

A primeira migração cria tabelas para:

- snapshot privado canônico;
- configurações privadas;
- contas e categorias;
- movimentações e anexos;
- grupos familiares e participantes;
- grupos de mútuas, vínculos, falecimentos e participantes dos eventos;
- metadados, revisão e integridade.

## 3. Publicar o Worker

Confirme que `SESSION_SECRET` continua configurado e publique:

```bash
npx wrangler secret put SESSION_SECRET
npm run deploy
```

A resposta de `/health` deve conter:

```json
{
  "status": "ok",
  "storage": "cloudflare-r2+d1",
  "privateState": "r2",
  "d1": {
    "available": true,
    "initialized": true,
    "active": false,
    "schemaVersion": 1,
    "requiredSchemaVersion": 1
  }
}
```

O valor `privateState: "r2"` antes do corte é intencional.

## 4. Publicar o Portal 6.37.0

Depois do Worker, publique os arquivos do Portal. Entre como Administrador e abra:

**Painel Administrativo → Recuperação e integridade**

O cartão do D1 deve exibir **Banco pronto para receber os dados**.

## 5. Executar a migração

Clique em **Migrar para o D1**.

O Worker executa, nesta ordem:

1. confere a revisão atual do R2;
2. cria um backup `before-d1-migration`;
3. grava o snapshot e todas as projeções relacionais em uma transação;
4. registra checksum, revisão e data da migração;
5. mantém o estado atual espelhado no R2;
6. passa a responder `GET/PUT /api/private-state` usando o D1.

Nenhum anexo é movido: os arquivos continuam no mesmo bucket R2 e o D1 guarda os metadados e as referências.

## 6. Conferência

Atualize a Central de Recuperação. O cartão deve mostrar **Banco estruturado ativo**.

O `/health` passa a apresentar:

```json
{
  "privateState": "d1",
  "d1": {
    "available": true,
    "initialized": true,
    "active": true,
    "schemaVersion": 1
  }
}
```

Faça uma inclusão e uma exclusão de teste, publique e confirme:

- dados preservados após recarregar;
- GitHub Actions verde;
- totais financeiros iguais;
- anexos acessíveis;
- backup R2 criado;
- revisão D1 atualizada.

## Retorno temporário ao R2

A Central de Recuperação oferece **Retornar ao R2** somente ao Administrador.

Antes da troca, o Worker copia o estado atual do D1 para o R2 e cria um backup. O banco não é apagado. Uma nova migração pode reativá-lo posteriormente.

## Recuperação

O D1 dispõe de recuperação por ponto no tempo da própria Cloudflare — atualmente 7 dias no Workers Free e 30 dias no Workers Paid. Os backups do Portal no R2 continuam existindo como segunda camada e podem ser restaurados pela interface; quando o D1 está ativo, a restauração grava o conteúdo no D1 e atualiza o espelho do R2.
