# Segurança e endurecimento operacional — v6.29.0

A arquitetura mantém o frontend estático, mas separa todo o domínio financeiro em Cloudflare R2 privado e concentra a autenticação, o estado privado e a autorização de anexos em um Cloudflare Worker.

## Dados públicos

A limpeza do esquema elimina campos de credencial conhecidos, incluindo usuários e senhas administrativas legadas, tokens, chaves de API e segredos. Ela é aplicada em:

- estado local;
- backups exportados e importados;
- pontos de recuperação;
- estado sincronizado;
- arquivo publicado no GitHub.

O JSON publicado contém a URL do Worker, identidade visual, aniversariantes, agenda, compromissos, avisos e somente metadados públicos do acesso da Diretoria. Movimentações, contas, grupos, valores e identificadores de anexos não são enviados ao visitante.

## Sessão administrativa do Portal

O token do GitHub:

- permanece somente em memória;
- não é salvo em Local Storage, Session Storage, auditoria ou recuperação;
- é validado antes da conexão;
- é apagado ao sair ou após o encerramento da sessão.

A senha da Diretoria também não é persistida. Após a migração 6.29.0, a derivação criptográfica permanece apenas no estado privado do R2; o JSON público guarda somente que o perfil está habilitado.

## Sessão do armazenamento privado

Quando o R2 está ativado:

- o Administrador envia o token já informado no login diretamente ao Worker;
- o Worker consulta o GitHub para confirmar acesso de escrita ao repositório configurado;
- a Diretoria envia a senha ao Worker, que a valida contra a derivação armazenada no estado privado do R2;
- o Worker devolve uma sessão HMAC de curta duração;
- essa sessão fica apenas na memória do módulo `secure-storage/client.js`;
- o estado privado usa revisão otimista para bloquear publicação sobre dados alterados em outra sessão;
- o logout limpa imediatamente a sessão do Portal e a sessão do Worker.

O token GitHub e a senha não são gravados pelo Worker no R2, no GitHub ou no navegador.

## Segredos e acesso ao R2

- O browser nunca recebe Access Key, Secret Access Key ou API Token do R2.
- O Worker acessa o bucket por um binding chamado `ATTACHMENTS`.
- `SESSION_SECRET` é cadastrado com o Wrangler e não deve existir em arquivos versionados.
- O bucket deve permanecer privado, sem domínio público e sem `r2.dev` habilitado.
- A lista `ALLOWED_ORIGINS` restringe as chamadas de sessão, upload e autorização ao domínio oficial e aos endereços locais de homologação.

## Autorização dos anexos

- Visitante: não cria sessão e não acessa documentos.
- Diretoria: pode solicitar visualização e download.
- Administrador: pode enviar, visualizar, baixar e remover objetos obsoletos.
- O Worker valida tipo, tamanho, chave do objeto e perfil em cada operação.
- Acesso aos arquivos ocorre por tickets HMAC com expiração curta.
- Respostas de documentos usam cache privado e política `no-referrer`.

## Política do navegador

O HTML declara:

- Content Security Policy;
- política de referência `no-referrer`;
- Permissions Policy com recursos sensíveis desativados;
- `connect-src` limitado às origens necessárias, incluindo Workers em `*.workers.dev`.

Nesta versão, a Configuração aceita URLs HTTPS em `*.workers.dev` e endereços locais de desenvolvimento. Um domínio personalizado exige sua inclusão explícita na validação do cliente e na CSP.

## Verificação automática

`npm run audit:security` verifica arquivos de dados, metatags de segurança e padrões que poderiam persistir tokens no navegador. `tests/private-data-boundary.test.mjs` valida a projeção pública, a recomposição autenticada e a separação entre armazenamento permanente e sessão. `tests/secure-storage.test.mjs` verifica o binding privado, a ausência de credenciais R2 no frontend, as permissões do Worker e o esquema v11.

## Backups privados e integridade

O Worker 1.2.0 aplica checksum SHA-256 ao estado principal e aos backups versionados. Uma substituição completamente vazia é recusada quando já existem registros privados. Restaurações exigem sessão administrativa, revisão atual e criação prévia de um ponto de segurança. O diagnóstico de anexos usa apenas o binding R2 e não publica URLs permanentes nem credenciais.


## Banco D1 e fronteira privada — versão 6.37.0

O binding `PORTAL_DB` existe somente no Cloudflare Worker. O navegador nunca recebe credenciais do banco e continua acessando os dados privados por sessões temporárias. O D1 passa a ser a fonte principal somente depois de uma migração autenticada, com conferência de revisão e backup prévio no R2.

O R2 permanece privado e armazena comprovantes, backups versionados e um espelho de contingência. A restauração de um backup usa a fonte ativa: quando o D1 está ativo, o estado restaurado é escrito no banco e novamente espelhado no R2.

## Salvamento privado desacoplado — versão 6.38.0

Alterações privadas são enviadas somente ao Worker autenticado e nunca entram no envelope público do GitHub. A fila de sincronização conclui o D1 antes de permitir publicação pública, atualização remota ou logout. Falhas preservam a cópia local e exigem confirmação posterior do Worker.
