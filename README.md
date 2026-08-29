# Portal Lions — versão pública para GitHub Pages

Esta edição foi separada da aplicação interna e contém somente o conteúdo destinado a visitantes.

## Páginas disponíveis

- Início
- Aniversários
- Dirigentes e histórico dos Anos Leonísticos
- Agenda (eventos e reuniões)
- Avisos

## O que foi removido

Não fazem parte desta versão: autenticação, usuários e permissões, área administrativa, configurações internas, tesouraria, mensalidades, mútuas, grupos familiares, anexos financeiros, auditoria, recuperação, importação/exportação e sincronização administrativa com GitHub.

O arquivo `data/dados.json` também foi reduzido a uma estrutura pública. Nos aniversários não são publicados número do associado nem ano de nascimento; somente nome, dia/mês e foto pública.

## Publicação

O workflow `.github/workflows/pages.yml` continua publicando automaticamente no GitHub Pages quando houver `push` na branch `main`.

## Validação local

```bash
npm test
```


## Revisão 1.0.1

- Corrigida a renderização dos ícones SVG de navegação e ações.
- Mantida a validação automática para impedir referências a ícones inexistentes.


## Revisão 1.0.2

- Aniversariantes do mês agora são ordenados com os próximos aniversários primeiro.
- Aniversários que já ocorreram no mês aparecem depois, do mais recente para o mais antigo.
- Para datas já passadas, o indicador mostra `Ontem` ou `Há X dias`, evitando exibir o próximo ano como se fosse a ordenação atual.





## Revisão 1.1.7 — Correção fina do banner mobile

- corrigida a proporção do banner em celulares de 360–430 px;
- removida a reserva lateral excessiva que estreitava o conteúdo do hero;
- logo passa a funcionar como elemento compacto no canto superior, sem aumentar a altura do banner;
- chips deixam de empilhar em telas estreitas e são ocultados quando passam a competir com o conteúdo principal;
- botões do banner recuperam a largura útil completa no celular;
- comportamento de 360 px, 390 px, 430 px e até 720 px consolidado em regras finais de responsividade.

## Revisão 1.1.6 — Consolidação visual e refatoração leve

- revisão estética geral da tela inicial e dos componentes compartilhados em desktop e mobile;
- KPIs ganharam contexto mais claro, cards do dashboard receberam hierarquia visual mais consistente e a agenda diferencia melhor itens anteriores;
- JavaScript foi separado em módulos de núcleo, modelo, shell, compartilhamento de aniversário e views, reduzindo acoplamento e facilitando manutenção;
- CSS foi reorganizado em base, páginas, responsividade e refinamentos, mantendo uma folha de compatibilidade para usos antigos;
- navegação dinâmica passou a usar delegação central de eventos, evitando múltiplos listeners a cada renderização;
- validação automatizada foi ampliada para verificar todos os módulos JS e arquivos CSS;
- o workflow do GitHub Pages agora executa a validação pública antes de publicar, evitando deploy de uma versão estruturalmente inválida;
- adicionado suporte explícito a `prefers-reduced-motion` e pequenos refinamentos de foco/acessibilidade;
- publicação continua 100% estática, sem framework, build ou dependências adicionais.

## Revisão 1.1.5 — Banner mais atraente

- banner principal redesenhado com composição visual mais rica e institucional;
- inclusão de chips visuais e elementos flutuantes para destacar agenda, aniversários e comunicados;
- área do logo passou a atuar como peça central da arte, sem perder legibilidade no mobile;
- refinado o equilíbrio visual do hero no desktop e no celular, sem alterar a lógica do portal.

## Revisão 1.1.4 — Polimento premium

- acabamento final de UI/UX com microinterações e transições mais naturais no desktop;
- removido o selo redundante “Público” da barra superior;
- sidebar recolhida ganhou transição e dicas de navegação pelos ícones;
- banner foi refinado para manter o logo como elemento gráfico também no celular, sem ocupar espaço útil;
- removidos indicadores redundantes do banner, preservando os KPIs logo abaixo;
- tabela de aniversários no desktop ficou mais limpa, unificando situação e ação e eliminando coluna vazia;
- histórico de avisos identifica claramente itens como “Encerrado”;
- navegação inferior mobile, cards, estados de foco/hover e telas muito estreitas receberam ajustes finais de consistência.

## Revisão 1.1.3 — Acabamento visual desktop + mobile

- segunda passagem visual com refinamento simultâneo para desktop e celular;
- banner inicial ficou mais institucional, com composição mais rica, destaques rápidos e melhor hierarquia;
- barra superior, cards, listas e seções receberam acabamento visual mais consistente e moderno;
- melhorias adicionais de densidade, leitura e toques no mobile, sem esquecer o desktop;
- tela de avisos ganhou melhor apresentação do resumo e o histórico abre automaticamente quando não houver avisos ativos.

## Revisão 1.1.2 — Ajustes de desktop e avisos

- botão do menu lateral passou a funcionar também no desktop, com recolhimento/expansão da sidebar;
- sidebar ficou menos redundante, removendo o rótulo “Portal público” e substituindo o rodapé por uma mensagem institucional;
- banner inicial foi redesenhado com composição visual mais atraente usando o logo do Lions;
- selo lateral do banner deixou de repetir o nome completo do clube, priorizando uma mensagem institucional;
- página de Avisos agora separa “Avisos atuais” e “Histórico de avisos”, semelhante ao comportamento da Agenda;
- dashboard passou a mostrar comunicados recentes mesmo quando não houver aviso ativo no momento.

## Revisão 1.1.1 — Refinamento mobile

- cartões de aniversários compactados no celular;
- removida a data redundante de “Próxima data”;
- filtro de aniversários reorganizado para ocupar menos altura;
- nomes longos e selos de situação passam a se adaptar melhor a telas estreitas;
- dashboard mobile ganhou maior densidade, legibilidade e menos rolagem;
- navegação inferior passou a funcionar como barra ancorada, menos intrusiva sobre o conteúdo.

## Revisão 1.1.0 — Refatoração visual e responsiva

- Design system revisado com tipografia, espaçamentos, superfícies, bordas, sombras e estados consistentes.
- Início reorganizado com hero mais moderno, atalhos e três indicadores de acesso rápido.
- Sidebar e barra superior refinadas no desktop.
- Navegação inferior redesenhada para uso confortável em celulares, respeitando área segura do aparelho.
- Aniversários passam a usar cards dedicados no mobile, mantendo tabela no desktop.
- Agenda, calendário, dirigentes, avisos e modal receberam melhorias de hierarquia, leitura e áreas de toque.
- Modo escuro atualizado para manter contraste e consistência com a nova interface.
- Modal agora preserva e devolve o foco ao elemento de origem, melhorando a navegação por teclado.
- Mantida a estrutura pública de dados e a validação de privacidade existente.

## Revisão 1.1.10 — Banner impactante e correção do rodapé

- banner inicial redesenhado para um visual mais impactante, mantendo a linha moderna e limpa;
- logo do Lions ficou maior e mais presente, com composição em destaque e marca d’água de fundo;
- substituído o texto em inglês por **“Nós Servimos”**;
- correção do aparecimento indevido de atalhos no rodapé do desktop, com reforço das regras da navegação mobile;
- revisão específica para manter o novo banner equilibrado também no celular.

