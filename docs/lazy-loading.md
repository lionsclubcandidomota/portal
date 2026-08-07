# Carregamento sob demanda — v6.36.0

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
