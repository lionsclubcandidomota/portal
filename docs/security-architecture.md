# Segurança e fronteiras de dados — v6.47.0

## Fronteiras

```text
Hospedagem estática → código da interface e recursos fixos
Cloudflare D1       → todos os dados estruturados públicos e privados
Cloudflare R2       → mídias, anexos e backups
Cloudflare Worker   → única porta de acesso ao D1 e ao R2
```

O navegador não recebe credenciais do D1 ou do R2. Todas as gravações passam pelo Worker e por uma sessão autorizada.

## Autenticação

O Administrador usa usuário e senha. O D1 mantém somente a derivação PBKDF2, salt, iterações, estado da conta, bloqueios e datas de acesso. O token opaco de sessão fica em memória no navegador e somente seu hash é persistido.

A criação do primeiro Administrador exige `ADMIN_BOOTSTRAP_KEY`. O Worker aplica limite de tentativas e revoga sessões após logout, troca de senha ou desativação da conta.

## Dados públicos

`GET /api/public/state` é anônimo, mas devolve somente a projeção pública validada. O Worker bloqueia coleções financeiras, hashes, tokens e campos privados antes de qualquer publicação.

A rota usa revisão e ETag. Uma revalidação sem mudanças retorna `304` lendo apenas metadados do D1.

## Dados privados

Rotas financeiras, operacionais, de backup e de administração exigem sessão. O D1 utiliza revisões e mutações idempotentes para reduzir sobrescritas concorrentes. Anexos privados são entregues por tickets HMAC de curta duração.

## Mídias e R2

Mídias públicas são servidas pelo Worker com cache e ETag. Anexos financeiros permanecem privados e usam `Cache-Control: private, no-store`. O bucket não precisa de domínio público.

## Segredos

Obrigatórios no Worker:

- `SESSION_SECRET`;
- `ADMIN_BOOTSTRAP_KEY`.

`GITHUB_TOKEN` não é necessário. `PUBLIC_DATA_URL` é uma variável temporária usada somente para importar o conteúdo público da versão anterior.

## Políticas do navegador

O Portal mantém CSP, `no-referrer`, Permissions Policy, validação de origem e `connect-src` restrito ao Worker. O código-fonte não contém token permanente nem chave de banco ou armazenamento.

## Testes de segurança

- fronteira pública/privada;
- autenticação e revogação no D1;
- conflito de revisão;
- rollback de mídia quando o lote falha;
- ausência de `data/dados.json` no release;
- ausência de `api.github.com` e credenciais no navegador;
- validação de CSP e caminhos de mídia.
