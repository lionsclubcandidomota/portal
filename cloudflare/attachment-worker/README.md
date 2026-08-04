# Worker de dados privados — Portal Lions

Este Worker mantém comprovantes e o estado financeiro/administrativo em um bucket Cloudflare R2 privado.
Nenhuma chave R2 é enviada ao navegador: o Worker utiliza um binding direto ao bucket.

## 1. Criar o arquivo de configuração

Copie `wrangler.toml.example` para `wrangler.toml` e substitua `SEU_BUCKET_R2` pelo nome exato do bucket.

Confira também:

- `ALLOWED_ORIGINS`: origem do Portal e endereços locais de homologação;
- `GITHUB_OWNER` e `GITHUB_REPO`;
- `PUBLIC_DATA_URL`: endereço público de `data/dados.json`.

O bucket deve continuar **privado**, sem domínio público e sem `r2.dev` habilitado.

## 2. Definir o segredo de assinatura

Na pasta deste Worker:

```bash
npm install
npx wrangler secret put SESSION_SECRET
```

Informe uma sequência aleatória com pelo menos 32 caracteres. Não grave esse segredo no Git.

## Validação local e no CI

```bash
npm ci
npm run check
```

O comando de verificação usa `wrangler.toml.example` e `wrangler deploy --dry-run`. Ele valida o bundle sem publicar, sem acessar o R2 e sem exigir `SESSION_SECRET`.

## 3. Publicar

```bash
npm run deploy
```

O Wrangler exibirá a URL final, semelhante a:

```text
https://lions-portal-anexos.<sua-conta>.workers.dev
```

## 4. Conectar o Portal

Entre como Administrador e abra:

**Configurações → Armazenamento privado de anexos**

Cole a URL do Worker, teste a conexão e salve. Na próxima publicação:

- anexos novos são enviados ao R2;
- anexos antigos em `public/treasury/` são migrados automaticamente;
- os arquivos públicos antigos são removidos do mesmo commit;
- o estado financeiro completo é gravado no objeto privado `__portal/private-state-v1.json`;
- o JSON do GitHub Pages passa a conter somente informações públicas.

## Segurança

- Administrador: token do GitHub é validado pelo Worker e usado apenas para criar uma sessão temporária.
- Diretoria: após a migração, a senha é validada contra o perfil armazenado no estado privado do R2. O JSON legado é usado somente como compatibilidade da primeira migração.
- Visitante: não recebe sessão, não acessa anexos nem recebe os dados financeiros.
- Links de visualização expiram automaticamente.
- O segredo `SESSION_SECRET` e o binding R2 existem somente no Worker.

O roteiro completo, incluindo homologação e migração, está em `docs/cloudflare-r2-setup.md` na raiz do Portal.

## Senha da Diretoria

O Worker valida perfis da Diretoria criados com PBKDF2-SHA-256 e 100.000 iterações. Depois de atualizar o Portal e o Worker, faça a publicação de migração uma única vez. O hash deixa de permanecer no JSON público.
## Validação no GitHub Actions

O arquivo `wrangler.ci.toml` existe somente para `wrangler deploy --dry-run`. Ele usa um nome de bucket fictício, porém sintaticamente válido, e não acessa o R2 nem publica o Worker. Não use esse arquivo para implantação em produção.


## Continuidade operacional

O Worker 1.2.0 cria backups privados versionados em `__portal/backups/private-state-v1/` e mantém as 20 versões mais recentes.

Endpoints autenticados:

- `GET /api/private-state/backups`: lista as versões e o resumo atual;
- `POST /api/private-state/backups`: cria um backup manual, somente Administrador;
- `POST /api/private-state/backups/restore`: restaura uma versão, somente Administrador;
- `GET /api/private-state/integrity`: verifica checksum, referências e objetos de anexos.

Uma gravação que removeria todos os registros privados é bloqueada. Toda restauração cria antes um backup de segurança do estado atual.
