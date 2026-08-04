# Plano de refatoração do Portal

## Etapa 1 — Segurança e separação de dados

Concluída na versão 6.29.0:

- fronteira explícita entre dados públicos e privados;
- estado privado armazenado no R2;
- hidratação do estado após autenticação;
- publicação pública sanitizada;
- proteção contra conflito de revisão;
- limpeza da sessão privada no logout;
- cache permanente limitado aos dados públicos.

## Etapa 2 — Higienização e pipeline de release

Concluída na versão 6.30.0:

- remoção definitiva dos arquivos CSS legados;
- criação automática de uma pasta `dist` limpa;
- pacotes separados para site, Worker e código-fonte;
- manifesto e hashes SHA-256 por artefato;
- geração determinística dos ZIPs para manter hashes estáveis;
- bloqueio de segredos e arquivos locais no empacotamento;
- remoção da cópia financeira legada do JSON público após a migração;
- portão automático contra o retorno de dados privados em `data/dados.json`;
- testes incluídos no comando principal de qualidade;
- validação do bundle CSS antes da entrega;
- correção do sincronizador para rejeitar versões de cache com quatro partes;
- eliminação de versões estáveis codificadas diretamente nas auditorias.

## Etapa 3 — Integração contínua

Concluída na versão 6.31.0:

- validação automática em pushes e pull requests;
- trabalhos independentes para Portal e Worker;
- instalação reproduzível do Worker com `npm ci`;
- bundle `--dry-run` sem acesso a segredos ou produção;
- geração manual ou por tag dos pacotes de release;
- upload dos ZIPs, hashes e resumo como artefatos;
- permissões somente de leitura nos workflows;
- testes de contrato para impedir deploy acidental e exposição de credenciais.
- correção 6.31.1: configuração dedicada de CI para o Wrangler e restauração do limite público/privado em `data/dados.json`.

## Etapa 4 — Consolidação da cascata CSS

Concluída na versão 6.32.0:

- remoção de declarações que já eram substituídas pelo mesmo seletor e contexto;
- redução de 329 para 254 seletores redefinidos;
- redução de 487 para 325 regras de sobrescrita;
- redução do bundle de 339.999 para aproximadamente 320 KB;
- novo portão com zero tolerância para declarações já superadas;
- orçamentos CSS mais restritos, com margem para evolução controlada;
- equivalência final da cascata verificada automaticamente;
- comparação visual sem diferenças em desktop, tablet e celular.

## Etapa 5 — Modularização da composição principal

Concluída na versão 6.33.0:

- redução do `portal-app.js` de 492 para 312 linhas;
- inicializador próprio para a Tesouraria e sua administração;
- inicializador próprio para cadastros, painel administrativo e configurações;
- inicializador próprio para publicação e atualização do Portal;
- inicializador próprio para navegação, shell e proteção de leitura;
- montagem das dependências das páginas isolada do bootstrap;
- portões de tamanho e contratos públicos para todos os novos módulos.

## Etapa 6 — Backup, restauração e integridade no R2

Concluída na versão 6.34.0:

- backups automáticos antes e depois das substituições do estado privado;
- retenção das 20 versões mais recentes no R2;
- checksum SHA-256 do estado principal e de cada backup;
- bloqueio contra sobrescrita completamente vazia;
- restauração remota com revisão otimista e ponto de segurança anterior;
- diagnóstico dos comprovantes referenciados, ausentes, duplicados e órfãos;
- criação manual de backup pelo Administrador;
- consulta de integridade em modo somente leitura para a Diretoria;
- integração completa com a Central de Recuperação.
- correção 6.34.1: sanitização aplicada após a normalização do esquema e bloqueio absoluto de dados privados no commit público.

## Encerramento

As seis etapas principais foram concluídas. O Portal passa a possuir fronteira pública/privada, pipeline reproduzível, integração contínua, CSS consolidado, composição modular e continuidade operacional do estado financeiro.
