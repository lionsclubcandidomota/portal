# Segurança e endurecimento operacional — v6.42.0

O Portal permanece hospedado de forma estática no GitHub Pages. A segurança foi organizada em três níveis: credencial principal do Administrador, senha global de consulta da Diretoria e usuários individuais vinculados a cargos.

## Credencial do Administrador

A credencial do GitHub:

- permanece somente em memória;
- não é salva em Local Storage, Session Storage, auditoria ou recuperação;
- é apagada ao sair ou após 30 minutos sem atividade;
- é a única credencial capaz de publicar, importar, recuperar backups e gerenciar usuários.

## Diretoria

A senha global da Diretoria usa PBKDF2 e concede somente consulta. O valor em texto não é publicado nem persistido.

## Usuários individuais

As senhas individuais:

- são validadas antes do cadastro;
- usam salt aleatório por usuário;
- são derivadas com PBKDF2-SHA-256 e 210 mil iterações;
- são comparadas sem interrupção antecipada por byte;
- nunca são armazenadas em texto.

O estado contém `passwordSalt`, `passwordHash`, `passwordIterations` e `passwordVersion`. Como esses dados são servidos publicamente pelo GitHub Pages, uma pessoa pode tentar adivinhar senhas offline. Por isso o Portal exige senhas com letra e número, recomenda senhas longas e proíbe tratá-las como equivalentes a uma autenticação de servidor.

## Limites de autorização

As permissões controlam rotas, botões, formulários e persistência local. Elas não substituem uma autorização executada em servidor. A barreira final permanece a publicação pelo Administrador. Usuários individuais não recebem token do GitHub e não publicam diretamente.

## Dados sensíveis

Campos de credencial em texto, tokens, chaves de API e segredos continuam proibidos no estado, backups e pontos de recuperação. Derivações criptográficas de senha possuem campos próprios e validação estrutural.

## Política do navegador

O HTML declara Content Security Policy, `no-referrer` e Permissions Policy com recursos sensíveis desativados.

## Verificação automática

`npm run audit:security` verifica os dados, as metatags e padrões de persistência indevida. Os testes também validam que senhas em texto não entram no estado e que usuários ativos possuem perfis criptográficos completos.
