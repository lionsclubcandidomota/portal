# Segurança e endurecimento operacional — v6.9.0

A Fase 10 remove credenciais legadas dos dados públicos e reforça a sessão administrativa sem criar um servidor próprio de autenticação.

## Dados públicos

O esquema v5 elimina automaticamente campos de credencial conhecidos, incluindo usuários e senhas administrativas legadas, tokens, chaves de API e segredos. A limpeza é aplicada em:

- estado local;
- backups exportados e importados;
- pontos de recuperação;
- estado sincronizado;
- arquivo publicado no GitHub.

Arquivos antigos continuam sendo aceitos, mas os campos sensíveis são descartados durante a migração.

## Sessão administrativa

O token do GitHub:

- permanece somente em memória;
- não é salvo em Local Storage, Session Storage, auditoria ou recuperação;
- é validado antes da conexão;
- é apagado ao sair ou após 30 minutos sem atividade.

A conexão também confirma o acesso ao repositório configurado e bloqueia contas sem permissão de gravação quando o GitHub informa essa restrição.

## Política do navegador

O HTML passa a declarar:

- Content Security Policy;
- política de referência `no-referrer`;
- Permissions Policy com recursos sensíveis desativados.

## Verificação automática

`npm run audit:security` verifica os arquivos de dados, as metatags de segurança e padrões que poderiam persistir tokens no navegador. O comando faz parte de `npm run check`.
