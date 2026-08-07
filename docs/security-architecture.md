# Segurança e endurecimento operacional — v6.39.0

## Fronteiras de dados

O Portal mantém quatro fronteiras independentes:

```text
GitHub Pages  → interface e conteúdo público
Cloudflare D1 → dados privados estruturados, usuários e sessões
Cloudflare R2 → comprovantes, documentos, backups e espelho de contingência
Worker        → autenticação, autorização, regras de negócio e publicação pública
```

O JSON público não contém movimentações, contas, grupos financeiros, credenciais, hashes de senha, identificadores de sessão ou referências privadas de anexos.

## Autenticação administrativa

O Administrador usa usuário e senha. A senha é derivada no Worker com PBKDF2-HMAC-SHA-256, salt individual e 150.000 iterações. O D1 armazena somente:

- hash derivado;
- salt;
- quantidade de iterações;
- situação da conta;
- tentativas malsucedidas e bloqueio;
- datas de criação, alteração e último acesso.

A senha original não é gravada no D1, R2, GitHub, auditoria ou armazenamento do navegador.

A criação do primeiro usuário exige `ADMIN_BOOTSTRAP_KEY`, segredo de pelo menos 24 caracteres configurado no Worker. O endpoint de bootstrap deixa de aceitar novos cadastros assim que um Administrador existe.

## Sessões

Após o login, o Worker gera um token opaco aleatório de 32 bytes. O navegador mantém esse token somente em memória. O D1 armazena apenas seu hash SHA-256, com usuário, perfil, expiração, revogação, endereço de origem e agente do navegador.

- expiração padrão: 30 minutos, limitada a no máximo 8 horas;
- bloqueio de interface após inatividade;
- revogação no logout;
- revogação das demais sessões após troca de senha;
- revogação de todas as sessões quando a conta é desativada.

Cinco falhas consecutivas bloqueiam temporariamente o usuário por 15 minutos. O Worker também aplica limite de tentativas por origem antes de consultar o banco.

## Publicação pública

O frontend não contém mais funções para autenticação ou gravação direta com token GitHub. O segredo `GITHUB_TOKEN` existe apenas no Worker.

O endpoint `/api/publication`:

1. exige sessão de Administrador;
2. bloqueia coleções ou campos privados;
3. verifica conflito pela revisão do arquivo público;
4. valida caminhos, formatos e limites de mídias;
5. atualiza `data/dados.json`, mídias e `release-manifest.json` no mesmo commit;
6. atualiza a branch sem `force`.

## D1 e R2

O binding `PORTAL_DB` e o binding `ATTACHMENTS` existem somente no Worker. O navegador nunca recebe credenciais diretas do D1 ou R2.

O D1 mantém o snapshot privado canônico e projeções relacionais. O R2 mantém anexos, backups versionados e espelho de contingência. Gravações privadas usam revisão otimista para impedir sobrescritas concorrentes e criam pontos de recuperação antes de operações críticas.

## Diretoria

A Diretoria continua usando senha própria e recebe sessão somente leitura. O Worker remove do payload devolvido os dados de derivação da credencial da Diretoria. Esse perfil pode consultar relatórios e documentos autorizados, mas não pode alterar dados, publicar conteúdo ou administrar usuários.

## Segredos do Worker

Devem ser cadastrados como Worker Secrets:

- `SESSION_SECRET`;
- `GITHUB_TOKEN`;
- `ADMIN_BOOTSTRAP_KEY`.

Eles não devem aparecer em `wrangler.toml`, código-fonte, logs, backups ou arquivos do Portal. `LEGACY_GITHUB_LOGIN_ENABLED` permanece `false` no uso normal.

## Auditoria

A tabela `portal_auth_audit` registra, sem senhas ou tokens:

- bootstrap;
- login bem-sucedido ou negado;
- bloqueio;
- logout;
- criação e atualização de usuário;
- redefinição e troca de senha.

A auditoria operacional do Portal continua associando alterações privadas e publicações aos respectivos usuários.

## Navegador e anexos

O HTML mantém Content Security Policy, `no-referrer`, Permissions Policy e `connect-src` limitado. Anexos são acessados por tickets HMAC de curta duração e respostas com cache privado. O bucket R2 permanece sem exposição pública direta.

## Verificação automática

- `npm run audit:security`: verifica dados públicos, CSP e padrões de persistência de segredos.
- `tests/d1-admin-auth.test.mjs`: executa as migrações em SQLite real e valida bootstrap, PBKDF2, sessão opaca e revogação.
- `tests/github-schema.test.mjs`: confirma que o navegador não publica com token e que o Worker mantém a fronteira pública.
- `tests/private-data-boundary.test.mjs`: valida a projeção pública e a recomposição privada.
