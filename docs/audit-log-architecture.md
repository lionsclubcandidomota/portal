# Auditoria operacional — v6.47.0

A auditoria registra quem alterou cada módulo, quando a operação ocorreu, o resumo da diferença e a revisão relacionada.

Publicações públicas são vinculadas à revisão `pub-*` gravada no D1. Campos antigos de commit permanecem apenas para leitura de históricos criados em versões anteriores.

A auditoria não armazena senha, token de sessão, conteúdo Base64 ou credenciais do R2. Eventos de autenticação ficam em `portal_auth_audit`; eventos funcionais permanecem no histórico operacional do Portal.
