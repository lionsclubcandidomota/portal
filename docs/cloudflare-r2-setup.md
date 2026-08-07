# Configuração do Cloudflare R2 para anexos privados

Este guia conecta o Portal ao bucket R2 sem colocar chave de acesso no JavaScript ou no repositório.

## Antes de começar

Tenha disponíveis:

- uma conta Cloudflare com R2 ativado;
- o nome do bucket privado;
- Node.js 20 ou superior no computador usado para publicar o Worker;
- acesso ao repositório oficial do Portal.

Nunca envie a chave do R2, o segredo do Worker ou o token administrativo para terceiros. O Portal solicita somente a URL final do Worker.

## 1. Criar ou revisar o bucket

No painel Cloudflare, abra **R2 Object Storage** e crie um bucket, por exemplo:

```text
lions-portal-documentos
```

Mantenha desativados:

- acesso público;
- domínio personalizado público;
- URL pública `r2.dev`.

Não é necessário criar Access Key para o navegador. O Worker utiliza um binding direto ao bucket.

## 2. Preparar o Worker

No pacote do Portal, abra:

```text
cloudflare/attachment-worker/
```

Copie:

```text
wrangler.toml.example
```

para:

```text
wrangler.toml
```

Edite `wrangler.toml` e substitua:

```toml
bucket_name = "SEU_BUCKET_R2"
```

pelo nome exato do bucket.

Confira também:

- `ALLOWED_ORIGINS`: domínio oficial do Portal e endereços locais permitidos;
- `GITHUB_OWNER`: proprietário do repositório;
- `GITHUB_REPO`: nome do repositório;
- `PUBLIC_DATA_URL`: URL pública de `data/dados.json`.

## 3. Instalar o Wrangler e autenticar

Abra um terminal dentro da pasta do Worker:

```bash
npm install
npx wrangler login
```

O navegador abrirá a autorização da sua conta Cloudflare.

## 4. Cadastrar o segredo da sessão

Gere uma sequência aleatória com pelo menos 32 caracteres e execute:

```bash
npx wrangler secret put SESSION_SECRET
```

Cole o valor quando o terminal solicitar. Não coloque o segredo em `wrangler.toml`, `.env`, JavaScript ou Git.

## 5. Publicar o Worker

Execute:

```bash
npm run deploy
```

Ao final, copie a URL semelhante a:

```text
https://lions-portal-anexos.<sua-conta>.workers.dev
```

Teste no navegador:

```text
https://lions-portal-anexos.<sua-conta>.workers.dev/health
```

A resposta esperada contém `status: "ok"` e `storage: "cloudflare-r2"`.

## 6. Conectar o Portal

1. Abra o Portal e entre como Administrador.
2. Acesse **Configurações**.
3. Localize **Armazenamento privado de anexos**.
4. Cole somente a URL `workers.dev`.
5. Selecione **Testar conexão**.
6. Salve a configuração.
7. Publique a alteração pelo fluxo normal do Portal.

A partir desse momento, novos anexos são enviados ao R2 na publicação.

## 7. Migrar anexos existentes

A primeira publicação após ativar o Worker também migra anexos antigos:

- carrega arquivos de `public/treasury/`;
- envia-os ao R2;
- atualiza o JSON para `storage: "r2"`;
- exclui os arquivos públicos antigos no mesmo commit.

Não remova manualmente `public/treasury/` antes da publicação, pois o Portal precisa ler esses arquivos para migrá-los.

Após a conclusão:

1. abra algumas movimentações como Administrador;
2. teste **Visualizar** e **Baixar**;
3. entre como Diretoria e confirme a consulta;
4. abra o Portal como Visitante e confirme que não há acesso aos anexos;
5. verifique no repositório se os documentos foram removidos de `public/treasury/`.

## 8. Homologação local

Os endereços locais padrão já estão na lista de origens:

```text
http://localhost:*
http://127.0.0.1:*
```

Inicie o Portal com:

```bash
npm run homologacao
```

O Worker publicado pode ser utilizado na homologação local. Não use o arquivo `index.html` diretamente pelo protocolo `file://`.

## 9. Rotação e recuperação

Para trocar o segredo da sessão:

```bash
npx wrangler secret put SESSION_SECRET
```

Depois da troca, sessões antigas deixam de ser válidas e os usuários precisam entrar novamente.

Para desativar temporariamente o R2, desmarque a configuração no Portal e publique. Isso não apaga objetos já armazenados. Não exclua o bucket antes de exportar ou revisar os anexos existentes.

## 10. Domínio personalizado

A versão 6.27.1 aceita diretamente URLs HTTPS em `*.workers.dev`. Caso o Worker use um domínio personalizado, será necessário acrescentar esse domínio à validação do cliente e à diretiva `connect-src` da Content Security Policy antes de ativá-lo.

## Compatibilidade da senha da Diretoria

O Cloudflare Workers aceita nesta integração o PBKDF2 com 100.000 iterações. Perfis da Diretoria criados em versões anteriores com 210.000 iterações continuam válidos para a verificação local, mas não conseguem abrir uma sessão no Worker.

Após atualizar o Portal para a versão 6.27.2:

1. Entre como Administrador.
2. Abra Configurações > Diretoria.
3. Defina novamente a senha da Diretoria.
4. Publique a alteração.
5. Publique novamente o Worker incluído no pacote.

A Diretoria poderá então visualizar e baixar anexos privados, permanecendo sem permissão para enviar ou excluir arquivos.


## Backups e diagnóstico do estado privado

A partir do Worker 1.2.0, cada publicação privada cria versões restauráveis em `__portal/backups/private-state-v1/`. O Worker mantém as 20 cópias mais recentes e valida cada uma com checksum SHA-256.

No Portal, entre como Administrador e abra **Dashboard administrativo → Recuperação e integridade** para:

- verificar se todos os comprovantes existem no bucket;
- criar um backup manual;
- consultar a linha do tempo privada;
- restaurar uma versão anterior.

A restauração não altera o JSON público e cria automaticamente uma cópia do estado atual antes de prosseguir.

O perfil Diretoria pode consultar o diagnóstico, mas não possui os botões de criação ou restauração.
