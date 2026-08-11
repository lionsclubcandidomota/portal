# Carregamento sob demanda — v6.46.7

## Grafo inicial

A entrada `assets/js/app.js` carrega o shell, o estado, o Dashboard, aniversariantes, avisos e os controladores essenciais de navegação. Recursos pesados e telas administrativas específicas ficam fora desse grafo.

## Pontos de divisão

| Recurso | Módulo carregador | Momento do carregamento |
|---|---|---|
| Agenda | `portal-view-renderer.js` | abertura ou intenção de abrir Agenda |
| Controlador da Tesouraria | `lazy-treasury-controller.js` | abertura, prefetch ou ação dependente |
| Tesouraria visual | `portal-view-renderer.js` | abertura ou intenção de abrir Tesouraria |
| Cadastros e gerenciadores | `lazy-entity-actions.js` | primeira ação de adicionar, editar, excluir ou gerenciar |
| Área administrativa | `lazy-admin-panel.js` | abertura ou intenção de abrir a área |
| Ajustes completos | `lazy-settings.js` | abertura ou intenção de abrir Ajustes |
| Revisão de publicação | `publication-review-controller.js` | clique em Revisar alterações |
| Arte de aniversário | `lazy-birthday-artwork.js` | ação Desejar parabéns |
| Painel de Publicação | `lazy-publish-center.js` | perfil com escrita e abertura do painel |
| Central de Recuperação | `lazy-recovery-center.js` | área administrativa ou operação crítica de snapshot |
| Histórico de alterações | `audit-log/controller.js` | abertura do histórico |
| GitHub administrativo | `portal-runtime/controller.js` | operação que exige autenticação/escrita |
| Mídia para publicação | `portal-runtime/publication.js` | preparação efetiva de uma publicação |
| Acesso individual | `portal-runtime/session.js` | tentativa de login pelo perfil Usuário |

## Dashboard financeiro

`treasury/dashboard-summary.js` calcula apenas os indicadores necessários para o Dashboard e não carrega o controlador financeiro completo.

## Renderização incremental

`renderHtmlIfChanged` foi incluído em `visual-helpers.js`, módulo que já pertence ao grafo inicial. Assim, a redução de atualizações do DOM não aumenta a quantidade de módulos carregados na abertura.

## Regras de segurança

- imports dinâmicos usam a mesma versão de cache do pacote;
- falhas de carregamento não alteram dados;
- o usuário recebe estado de carregamento e mensagem clara em caso de falha;
- renderizações atrasadas validam se a tela ainda está ativa;
- a seção da Tesouraria escolhida antes do carregamento é preservada;
- o orçamento impede o retorno acidental de módulos ao grafo inicial.


## Contrato de estabilização — etapa 4

O comando `npm run audit:lazy` faz parte do portão oficial de qualidade. Ele verifica que:

- todos os imports dinâmicos locais usam o `?v=` correspondente à versão atual do `package.json`;
- os pontos de entrada definidos como lazy continuam possuindo referência dinâmica ativa;
- módulos administrativos e pesados protegidos não retornam ao grafo estático iniciado por `assets/js/app.js`;
- as fronteiras de carregamento sob demanda permanecem sincronizadas com os contratos centrais em `tools/quality-contracts.mjs`.

Na base final da v6.46.7 são protegidas 19 entradas lazy e 24 módulos fora do bootstrap.
