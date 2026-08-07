# Arquitetura do Runtime do Portal — v6.26.0

A fachada pública continua em `assets/js/modules/portal-runtime.js`. O runtime coordena sessão, persistência, sincronização e publicação por módulos especializados.

## Módulos

- `authorization.js`: papéis, capacidades, política de rotas e transições consistentes de perfil.
- `access-profile.js`: derivação e configuração segura da senha da Diretoria.
- `controller.js`: composição dos módulos e contrato público.
- `context.js`: dependências, modelo compartilhado e utilitários de estado.
- `session.js`: conexão, ativação e encerramento das sessões.
- `persistence.js`: gravação local, importação e restauração.
- `publication.js`: publicação e descarte de alterações.
- `interface-refresh.js`: atualização completa da interface sem perder a sessão.
- `remote-sync.js`: consulta periódica dos dados publicados.
- `storage.js`: metadados locais de sincronização.
- `domain.js`: decisões puras de mesclagem e versão.
- `bootstrap.js`: sequência de inicialização.

## Política de autorização

`accessRole` é a fonte de origem da política. Os campos `adminUnlocked` e `canWrite` continuam disponíveis por compatibilidade, porém são atualizados exclusivamente por `applyAccessRole()` e `clearAccessRole()`.

Capacidades centrais incluem:

- visualizar dados privados e Tesouraria;
- visualizar Configurações;
- atualizar o painel;
- alterar dados;
- publicar ou descartar alterações;
- gerenciar perfis de acesso.

Visitante não recebe capacidades privadas. Diretoria pode consultar e atualizar os dados publicados, mas não pode escrever. Administrador recebe todas as capacidades.

## Contrato público

Além dos métodos anteriores, o controlador expõe:

- `accessPolicy`;
- `getAccessPolicy()`;
- `can(capability)`;
- `canAccessView(view)`.

Os getters e métodos anteriores permanecem disponíveis para compatibilidade.

## Regras de manutenção

1. Nenhum módulo deve decidir permissões por comparações avulsas de papel quando existir uma capacidade equivalente.
2. Alterações de perfil devem usar as funções de transição de `authorization.js`.
3. Credenciais nunca devem ser persistidas no navegador.
4. A fachada `portal-runtime.js` deve permanecer enxuta.
