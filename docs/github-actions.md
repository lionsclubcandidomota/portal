# Integração contínua com GitHub Actions

A partir da versão 6.31.1, o projeto possui validação automática do Portal e do Cloudflare Worker sem conceder permissão de escrita aos workflows e sem publicar em produção.

## Workflow de qualidade

Arquivo: `.github/workflows/quality-gates.yml`

É executado em:

- todo `push`;
- toda abertura ou atualização de pull request;
- execução manual pela aba **Actions**.

O workflow possui dois trabalhos independentes:

### Portal / testes e auditorias

Executa:

```bash
npm run release:check
```

Isso inclui testes, validação do CSS gerado, versões de cache, lint, auditorias de CSS, acessibilidade e segurança, validação do esquema e conferência do manifesto.

Ao final, `git diff --exit-code` garante que os arquivos gerados ou versionados não estejam desatualizados.

### Worker / bundle de homologação

Executa na pasta `cloudflare/attachment-worker`:

```bash
npm ci
npm run check
```

O comando do Worker usa `wrangler deploy --dry-run` com `wrangler.ci.toml`. Ele apenas cria e valida o bundle; não acessa o bucket R2, não solicita segredo e não publica o Worker.

## Workflow de pacotes

Arquivo: `.github/workflows/release-artifacts.yml`

É executado:

- manualmente pela aba **Actions**;
- quando uma tag iniciada por `v` é enviada, por exemplo `v6.34.1`.

O workflow:

1. instala as dependências bloqueadas do Worker;
2. valida o bundle do Worker;
3. executa `npm run release:build`;
4. reprova a execução se o pipeline alterar arquivos-fonte não commitados;
5. disponibiliza os ZIPs, `checksums.sha256`, `release-summary.json` e o README da entrega como artefato por 30 dias.

O workflow não realiza deploy no GitHub Pages nem no Cloudflare. A publicação continua sendo uma decisão manual após a homologação.

## Primeira ativação no repositório

1. Envie a pasta `.github/workflows` junto com o restante da versão 6.34.1.
2. No GitHub, abra a aba **Actions**.
3. Confirme que o workflow **Qualidade do Portal** foi iniciado.
4. Aguarde a aprovação dos trabalhos:
   - `Portal / testes e auditorias`;
   - `Worker / bundle de homologação`.
5. Abra **Actions → Pacotes de release → Run workflow** para testar a geração manual dos artefatos.

## Proteção recomendada da branch principal

Depois da primeira execução bem-sucedida, abra as configurações de proteção da branch principal e exija os dois status abaixo antes de aceitar alterações:

- `Portal / testes e auditorias`;
- `Worker / bundle de homologação`.

Também é recomendável exigir que a branch esteja atualizada antes do merge. Não habilite deploy automático de produção até que o processo de homologação e recuperação esteja consolidado.

## Ausência de segredos

Os workflows desta etapa usam somente `contents: read`. Eles não fazem referência a `secrets.*`, `GITHUB_TOKEN`, credenciais Cloudflare ou token administrativo do Portal.

Configurações locais permanecem bloqueadas no Git e nos pacotes:

- `wrangler.toml`;
- `.dev.vars*`;
- `.env*`;
- caches e dependências locais do Wrangler.
