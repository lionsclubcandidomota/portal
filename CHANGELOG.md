## v6.49.1 — Conta padrão para recebimento de mensalidades — 22/08/2026

- adiciona a configuração **Conta padrão para receber mensalidades** no gerenciamento de contas da Tesouraria;
- limita a configuração a uma única conta ativa por vez e remove o status ao desativá-la;
- pré-seleciona a conta configurada no modal **Dar baixa de mensalidade**, sem bloquear a escolha manual de outra conta;
- mantém fallback compatível para a primeira conta ativa quando nenhuma conta padrão foi definida;
- registra a nova propriedade na revisão de publicação das contas;
- adiciona regressões específicas e preserva `data/dados.json` e `data/modelo.json` inalterados.

## v6.49.0 — Resumo gerencial de Mensalidades — 22/08/2026

- confirma que **Previsão pendente** exclui integralmente o saldo anterior e considera somente competências do período selecionado;
- reestrutura o painel de Mensalidades em Base ativa, Situação das competências e Valores do período;
- inclui contagem de associados Individuais, Familiares, titulares, adicionais e grupos familiares ativos;
- separa competências Quitadas, Parciais e Em aberto;
- inclui o total Previsto no período, calculado com a mesma regra histórica de valor por competência;
- mantém Recebido, Previsão pendente e Saldo anterior como indicadores distintos e explicados;
- refina a responsividade do resumo para desktop, tablet e celular e preserva os temas Claro/Escuro;
- recalibra os orçamentos técnicos para 442 KB de CSS e 790 KB de ativos críticos;
- preserva `data/dados.json` e `data/modelo.json` inalterados.

## v6.48.3 — Previsão pendente e acabamento do Extrato no modo escuro — 22/08/2026

- corrige a superfície de **Pagamentos vinculados** do Extrato para respeitar os temas claro e escuro;
- adiciona ao Controle de Mensalidades o KPI **Previsão pendente**, calculado somente com as competências em aberto do período selecionado;
- preserva o **Saldo anterior em aberto** em indicador separado, sem misturá-lo à previsão mensal do período;
- usa a mesma regra histórica de valor por competência, preservando reajustes, quitações e pagamentos parciais;
- adiciona regressões específicas para o filtro de período e para a superfície temática dos pagamentos vinculados;
- preserva `data/dados.json` e `data/modelo.json` inalterados.

## v6.48.2 — Tema claro padrão e acabamento do modo escuro — 22/08/2026

- O Portal passa a iniciar em **Modo claro** quando ainda não existe preferência salva no navegador.
- A escolha manual do usuário entre Claro e Escuro continua persistida localmente.
- Notificações/toasts passam a usar superfícies do design system em ambos os temas.
- Campos de data/data-hora/mês/hora deixam de exibir fundo branco no modo escuro, inclusive durante validação obrigatória.
- Regressões específicas protegem o tema padrão, as notificações e os controles nativos de data.
- `data/dados.json` e `data/modelo.json` permanecem inalterados.

## v6.48.1 — Refinamento do modo escuro — 21/08/2026

- corrige superfícies claras residuais e textos de baixo contraste encontrados no modo escuro em Dashboard, Dirigentes, Tesouraria, Mensalidades, Mútuas, Agenda, Avisos e Ajustes;
- troca cores fixas dos componentes afetados por tokens semânticos de superfície, texto e estado, fazendo o mesmo CSS responder corretamente aos temas claro e escuro;
- corrige rodapés de modais, seletor de competências, cards de mensalidades, pagamentos vinculados do Extrato e cards expansíveis de Movimentações;
- cria tokens de Mútuas com variantes claras/escuras para preservar a identidade roxa com contraste adequado;
- adapta editor Markdown, pré-visualização e componentes compartilhados de publicação/auditoria ao tema;
- adiciona regressão específica contra o retorno de fundos brancos fixos nos componentes críticos;
- preserva as regras funcionais da v6.48.0, o esquema 12 e `data/dados.json`/`data/modelo.json` byte a byte.

## v6.48.0 — Rendimento bancário e modo escuro — 21/08/2026

- adiciona **Rendimento bancário** como modalidade de Entrada na Tesouraria;
- calcula automaticamente o rendimento a partir da diferença entre o saldo realizado do Portal e o saldo informado pelo banco;
- exige diferença positiva, evitando transformar divergências negativas em saídas automáticas;
- registra saldo anterior do Portal e saldo informado pelo banco junto ao lançamento para conferência;
- mantém o fluxo atual de usuário responsável/auditoria, sem adicionar novo campo ao formulário;
- protege a categoria de sistema **Rendimentos bancários** contra renomeação ou exclusão;
- exibe os saldos utilizados no cálculo nos detalhes da movimentação;
- adiciona alternância global entre **tema claro e tema escuro** no cabeçalho;
- salva a preferência do tema somente no navegador/dispositivo e usa a preferência do sistema operacional quando ainda não existe escolha explícita;
- integra o modo escuro ao design system consolidado, cobrindo navegação, cards, KPIs, formulários, tabelas, modais, Tesouraria, Mensalidades e demais superfícies principais;
- mantém `data/dados.json` e `data/modelo.json` inalterados e o esquema na versão 12;
- recalibra os orçamentos técnicos de CSS/JavaScript somente para acomodar as duas funcionalidades, mantendo auditorias e regressões obrigatórias.

## v6.47.0 — Refatoração visual global — 21/08/2026

- consolida os tokens do design system em uma única fonte de verdade para cores, superfícies, tipografia, raios, sombras, foco e dimensões;
- moderniza de forma global sidebar, topbar, conteúdo, heros, cards, KPIs, formulários, botões, tabelas, badges e estados vazios;
- elimina regras antigas totalmente sobrescritas e reduz a dívida de cascata sem criar uma nova camada global de exceções;
- reduz o bundle CSS de 421.984 para aproximadamente 420.971 bytes, mantendo o orçamento máximo de 422.000 bytes;
- reduz as sobrescritas auditadas de 437 para 417 e os seletores redefinidos de 340 para 334, com zero duplicatas exatas e zero fontes legadas;
- melhora a responsividade dos KPIs do Dashboard e mantém as especializações já estabilizadas de Tesouraria, Mensalidades, Extrato, Mútuas, usuários, Dirigentes e publicação;
- não altera regras de negócio, esquema, `data/dados.json` ou `data/modelo.json`.

## v6.46.13 — Saldo devedor líquido do Extrato — 21/08/2026

- corrige o Saldo devedor para incluir o saldo anterior ainda em aberto, além das competências em aberto do período;
- desconta créditos/saldos positivos das competências antes de apresentar o saldo devedor líquido;
- preserva o KPI Em aberto somente para as competências filtradas e mantém o Saldo anterior em bloco próprio;
- adiciona regressão específica para a composição entre mensalidades em aberto, saldo anterior e crédito positivo.

## v6.46.12 — Correção estrutural do Extrato de mensalidades — 21/08/2026

- corrige os cards de competências que eram comprimidos/cortados dentro da área rolável do Extrato em desktop e mobile;
- substitui a lista em CSS Grid por coluna flexível com itens não encolhíveis, preservando a altura real de cada competência;
- estabiliza o modal do Extrato com rolagem exclusiva da lista, melhor aproveitamento de altura e layout mobile em tela cheia;
- reorganiza os indicadores das competências no celular e mantém o saldo em largura total nas telas menores;
- oculta o bloco “Nenhum pagamento registrado” nos meses sem pagamentos vinculados, reduzindo ruído visual;
- preserva sem alteração as regras de vigência de mensalidades, saldo anterior, pagamentos parciais e filtro de período da v6.46.11.

## v6.46.10 — Histórico de valores das mensalidades — 21/08/2026

- impede que a alteração posterior dos valores de mensalidade reabra competências já quitadas como parciais;
- usa o valor esperado registrado na própria baixa como referência histórica por associado e competência;
- aplica a regra a mensalidade individual, Titular Familiar e Familiar Adicional;
- preserva pagamentos parciais pelo valor esperado histórico, sem transformá-los em quitação indevida;
- mantém o valor vigente para competências ainda sem histórico de pagamento;
- trata registros legados de competências já baixadas como valores consolidados, sem migração dos arquivos oficiais;
- mantém Mensalidades, Extrato individual, baixa e Dashboard coerentes com a mesma regra;
- adiciona regressões para reajuste após quitação, mensalidade familiar, registro legado e pagamento parcial.

## v6.46.9 — Baixa de mensalidade — 21/08/2026

- remove o botão “Selecionar pendentes” do modal de baixa de mensalidade e elimina o listener correspondente;
- reorganiza internamente os blocos do formulário para dar respiro consistente a associados, saldo anterior e competências;
- amplia o modal no desktop para reduzir altura e melhorar a leitura dos campos;
- refina a seleção mensal com contador alinhado, estados Parcial/Pago mais claros e melhor distribuição responsiva;
- preserva rateio, saldo anterior, pagamentos parciais, baixa familiar/individual e dados oficiais sem migração.

## v6.46.8 — Extrato de mensalidades por período — 21/08/2026

- corrige o Extrato de mensalidades para usar exatamente o intervalo selecionado na tela de Mensalidades, sem ampliar automaticamente até o mês atual ou por competências encontradas em pagamentos;
- mantém pagamentos e saldo anterior em bloco próprio, fora dos KPIs mensais do período filtrado;
- preserva pagamentos parciais, créditos e competências quitadas somente dentro do intervalo selecionado;
- adiciona regressão específica para impedir que competências fora do período retornem ao extrato;
- reforça a diferenciação visual de Parcial em azul na tela de Mensalidades e regenera o bundle CSS distribuído;
- reorganiza visualmente o extrato com período explícito, KPIs mais legíveis, saldo anterior mais compacto e pagamentos vinculados responsivos;
- preserva `data/dados.json`, `data/modelo.json` e o esquema 12 sem migração.

## Ajuste financeiro — rateio de mensalidades e refinamento mobile — 21/08/2026

- Reduz o destaque visual do saldo ao fim do dia nos cards de Movimentações no celular, preservando a informação como indicador secundário.
- Mensalidades passam a aceitar pagamentos parciais sem marcar a competência como quitada antes do valor esperado ser alcançado.
- A baixa oferece os modos “Quitar saldo das mensalidades selecionadas” e “Ratear um valor recebido”.
- No rateio, o valor recebido é distribuído das competências mais antigas selecionadas para as mais recentes e o saldo remanescente continua em aberto.
- Competências podem assumir os estados Pendente, Parcial e Pago; o filtro de mensalidades também permite localizar pagamentos parciais.
- Cobranças por texto e imagem usam somente o saldo restante de mensalidades parcialmente pagas.
- Registros antigos com valor inferior à mensalidade passam a ser interpretados como pagamento parcial de forma compatível, sem migração dos dados oficiais.

## Ajuste financeiro — saldo diário e contas negativas — 21/08/2026

- Movimentações realizadas passam a exibir o saldo da conta ao fim da data do lançamento.
- Movimentações programadas exibem o saldo previsto ao fim da data, sem confundir previsão com saldo realizado.
- Transferências mostram os saldos de origem e destino na mesma data.
- O saldo atual das contas deixa de depender do filtro de período do histórico.
- O gráfico Saldo por conta passa a representar saldos positivos, zero e negativos em torno de um eixo central.
- Contas negativas recebem sinalização visual e alerta no gráfico, sem alterar o esquema ou os dados oficiais.

## v6.46.7 — Refatoração técnica, etapa 4 — estabilização final

## Refatoração pós-movimentações — Etapa 1

- Consolidação conservadora do CSS após os fluxos de Entrada, Saída e Transferência.
- Remoção de declarações mortas e recuperação de margem no bundle.
- Novos limites de qualidade para impedir regressão de tamanho do CSS.
- Portão de release dos dados ajustado para 150 KB; imagens Base64 continuam proibidas separadamente.

- centraliza os contratos de orçamento e fronteiras de lazy loading usados pelas auditorias técnicas;
- adiciona `audit:lazy` ao pipeline oficial, validando imports dinâmicos versionados, pontos de entrada lazy ativos e módulos pesados fora do bootstrap;
- compartilha a leitura do grafo de módulos entre as auditorias, evitando divergência entre importações estáticas, reexports e imports dinâmicos;
- mantém os orçamentos finais em 315 KB de JavaScript estático, 435 KB de CSS e 785 KB de ativos críticos;
- encerra o ciclo de refatoração v6.46.7 sem alteração funcional ou migração de dados.

## v6.46.7 — Refatoração técnica, etapa 3 — desempenho e lazy loading
- corrige a auditoria do grafo inicial para contabilizar também `export ... from`, eliminando a subestimação anterior do JavaScript estático;
- separa cálculo e interface da revisão de publicação, mantendo apenas o domínio necessário no carregamento inicial;
- move Central de Recuperação, Painel de Publicação, interface do histórico de alterações, escrita administrativa no GitHub e preparação pesada de mídia para carregamento sob demanda;
- divide a integração GitHub em `github-public.js`, `github-admin.js` e `github-config.js`, deixando as rotinas administrativas fora do bootstrap público;
- reduz o grafo JavaScript inicial correto de 378.503 para 301.158 bytes (aproximadamente 20,4%);
- recalibra o orçamento de desempenho para a métrica corrigida: 315 KB de JavaScript estático e 785 KB de ativos críticos;
- preserva regras funcionais, esquema 12 e arquivos oficiais de dados.

## v6.46.7 — Higiene do release e base da refatoração
- sincroniza a versão interna do Portal com o pacote v6.46.7;
- atualiza os cache-busters dos módulos e do CSS para evitar reaproveitamento de arquivos antigos pelo navegador;
- regenera o manifesto a partir do conteúdo real do pacote;
- mantém `data/dados.json` e `data/modelo.json` preservados byte a byte;
- estabelece esta versão como base estável para a refatoração incremental de CSS e desempenho.

## Ajustes posteriores à v6.46.5 — Botão Atualizar Portal
- centraliza o texto do botão **Atualizar Portal** no rodapé do menu lateral, equilibrando o espaço visual em relação ao ícone;
- durante a atualização, mantém o quadrado do ícone imóvel e anima somente o SVG com as duas flechas de atualização.

## Ajustes posteriores à v6.46.5 — Miniaturas e Agenda
### Ajustes de interface — Agenda da página inicial
- Corrige a compressão dos cards da Agenda na página inicial quando o usuário está autenticado, usando uma coluna interna no card de meia largura.
- Reorganiza compromissos online para manter plataforma e botão de acesso lado a lado quando houver espaço, empilhando apenas em telas pequenas.
- Evita que cards mais curtos sejam esticados visualmente pela altura de outro compromisso na mesma linha.

- adiciona as miniaturas responsivas ausentes (`96px` e `192px`) do associado cuja foto original já existia, eliminando o `404` na página pública de Dirigentes;
- torna a auditoria de mídia obrigatória no portão de qualidade, impedindo que um release seja aprovado com miniaturas de associados faltando.

## Ajustes posteriores à v6.46.5 — Publicação e GitHub Pages
- padroniza o ícone do aviso superior de publicação em andamento para usar as duas flechas de atualização, alinhado ao cartão interno do painel, mantendo o fundo do ícone estável enquanto apenas o SVG anima;
- atualiza o workflow próprio do GitHub Pages para actions compatíveis com Node 24 (`checkout@v5`, `configure-pages@v6`, `upload-pages-artifact@v5` e `deploy-pages@v5`), eliminando o aviso de depreciação do runtime Node.js 20;
- publica apenas os arquivos estáticos necessários (`index.html`, `assets`, `data` e `public`) no artefato do Pages.

# Changelog

## v6.46.11 — Vigência histórica de mensalidades — 21/08/2026

- reajustes dos valores Individual, Titular Familiar e Familiar Adicional passam a valer somente no mês seguinte ao salvamento;
- competências anteriores ao início da nova vigência preservam o valor antigo mesmo quando continuam em aberto;
- competências já quitadas e parcialmente pagas continuam usando o valor esperado histórico já registrado;
- bases vindas da v6.46.10 podem recuperar retroativos sem histórico explícito usando os snapshots de pagamentos detalhados já existentes;
- Dashboard, Mensalidades, baixa e Extrato passam a consultar a mesma regra de valor por competência;
- o modal de baixa exibe os valores correspondentes ao mês de referência escolhido, evitando usar indevidamente o reajuste futuro;
- o Extrato recebe cards de competências mais estáveis, com melhor espaçamento, bordas e fundos por status e comportamento responsivo revisado;
- não há alteração do esquema 12 nem modificação dos arquivos oficiais `data/dados.json` e `data/modelo.json`.

## Ajustes de layout — 11/08/2026

- Corrige o posicionamento dos tooltips dos gráficos para que permaneçam totalmente visíveis, sem serem recortados nas bordas dos cards.
- Reposiciona o botão **Desfazer** para a coluna da direita no rodapé do Painel de Publicação, abaixo de **Publicar agora**, mantendo a separação de segurança entre as ações.
- Mantém cada gráfico expandido na própria coluna no desktop, usando o espaço vertical abaixo do cartão em vez de ocupar a largura inteira.
- Adiciona o filtro **Vencidas** ao Histórico Financeiro, com contagem e resumo próprios.
- Mantém os gráficos financeiros em duas colunas no desktop e uma coluna no mobile.
- Harmoniza o Histórico Financeiro com os cards e controles visuais da Tesouraria.
- Corrige a abertura do painel de publicação no celular e melhora a separação entre Desfazer e Publicar agora.

## 6.46.5 — Estabilização do pacote e integridade do release

- Migra `data/modelo.json` do esquema 7 para o esquema 12.
- Preserva `data/dados.json` sem qualquer alteração.
- Faz a auditoria do release validar os dois arquivos oficiais de dados.
- Regenera o manifesto com todos os arquivos atuais, incluindo imagens e miniaturas.
- Remove a versão antiga fixa da mensagem do finalizador.
- Adiciona testes de regressão para impedir modelo desatualizado em versões futuras.
- Documenta a homologação visual prioritária e o congelamento temporário da arquitetura.

## 6.46.4 — Largura integral da prévia de participantes

- Faz o resumo e a lista de participantes ocuparem toda a largura disponível no registro de falecimento.
- Remove o espaço vazio lateral causado por alinhamentos herdados de uma regra antiga em flexbox.
- Mantém duas colunas equilibradas em telas amplas e uma coluna no celular.
- Mantém o esquema 12 e não altera grupos, ocorrências, cobranças ou demais dados.

## 6.46.3 — Estabilização visual dos formulários de Mútuas

- Faz os modais de grupos e falecimentos abrirem sempre no início do formulário.
- Separa a rolagem do conteúdo da rolagem do cartão e do fundo do modal.
- Impede que os cartões de participantes fiquem comprimidos ou com conteúdo cortado.
- Exibe todos os participantes na prévia da cobrança por falecimento.
- Faz a lista de participantes ocupar toda a largura disponível.
- Mantém o esquema 12 e não altera dados operacionais.


## 6.46.2 — Correções de Mútuas e Tesouraria móvel

- Corrige o erro ao abrir Gerenciar Mútuas causado por identificadores duplicados no DOM.
- Reorganiza o formulário de registro de falecimento e a lista de participantes.
- Diferencia associados e mutuários na prévia da cobrança eventual.
- Mostra Movimentações, Contas, Mensalidades e Mútuas em grade visível no celular.
- Remove a dependência de arraste horizontal oculto na navegação financeira.
- Corrige o fechamento antecipado do contêiner principal da Tesouraria.
- Mantém o esquema 12 e não altera dados operacionais.

## 6.46.1 — Histórico de dirigentes e seções recolhíveis

- Cargos, usuários e histórico podem ser expandidos ou recolhidos na área administrativa.
- Cada Ano Leonístico também possui controle próprio de expansão.
- Fotos dos dirigentes incluídas no histórico administrativo.
- Histórico público de Dirigentes ganhou navegação explícita por Ano Leonístico.
- Ex-dirigentes inativos permanecem visíveis nos períodos anteriores.
- Texto explicativo do filtro mensal de aniversariantes removido da área pública.

## 6.46.0 — Melhorias visuais e responsivas, etapa final

- Redesenha o Painel de Publicação com situação, progresso e fluxo em três etapas.
- Mantém a publicação minimizável e o usuário trabalhando no mesmo contexto.
- Cria uma camada responsiva dedicada à Tesouraria para celulares e tablets.
- Reorganiza navegação, indicadores, gráficos, filtros, movimentações e formulários financeiros em telas pequenas.
- Corrige o CSS dos participantes no cadastro de Mútuas.
- Diferencia associados e mutuários na seleção do grupo.
- Substitui emojis funcionais nas áreas financeiras e administrativas revisadas por ícones SVG locais.
- Mantém o esquema 12 e não altera dados, movimentações, usuários ou fotografias.
- Encerra o ciclo iniciado na v6.45.0.

# Histórico de versões

## 6.45.0 — Experiência pública e identidade institucional

- Move o botão Atualizar Portal para o rodapé do menu lateral.
- Reestrutura o banner inicial com logotipo maior e marca d’água institucional.
- Padroniza o banner público de Dirigentes com a mesma identidade visual.
- Adiciona consulta pública do histórico de dirigentes por Ano Leonístico.
- Limita os aniversariantes de visitantes ao mês atual, inclusive no Dashboard.
- Substitui emojis de estado nas telas públicas revisadas por ícones SVG locais.
- Mantém o esquema 12 e não altera dados operacionais.

## 6.44.1 — Correção de acesso e Ano Leonístico

- Corrige a autorização das rotas restritas quando a navegação recebe o resumo da sessão autenticada.
- Restaura o acesso à Tesouraria e aos Ajustes para o Administrador.
- Mantém a Tesouraria disponível para a Diretoria em modo de consulta.
- Corrige a validação HTML do campo Ano Leonístico para aceitar valores como `2026/2027`.
- Adiciona instrução de formato no próprio campo e teste de regressão para as rotas restritas.
- Mantém o esquema 12 e não altera dados operacionais.

## 6.44.0 — Dirigentes públicos e estabilização final

- Cria a área pública **Dirigentes** para o Ano Leonístico vigente.
- Reutiliza associados, cargos e designações sem duplicar cadastros.
- Oculta credenciais, permissões, números e observações internas.
- Adiciona navegação pública própria para Dirigentes.
- Amplia a auditoria visual para seis telas em cinco resoluções.
- Adiciona homologação integrada de esquema, vínculos e períodos.
- Integra a verificação ao iniciador local de homologação.
- Mantém o esquema 12 e todos os dados operacionais existentes.
- Encerra as oito etapas do ciclo funcional.

## 6.43.0 — Histórico de cargos por Ano Leonístico

- Atualiza o esquema de dados para a versão 12.
- Vincula cargos a associados por Ano Leonístico e período de vigência.
- Preserva cargos anteriores sem sobrescrever o histórico.
- Encerra automaticamente permissões quando a designação deixa de vigorar.
- Ativa permissões do novo cargo quando a nova designação entra em vigor.
- Migra usuários existentes para uma designação no AL atual.
- Bloqueia períodos ativos sobrepostos para o mesmo associado.
- Adiciona gerenciamento e visualização do histórico por AL.
- Mantém Tesouraria, Mútuas, mensalidades, famílias, agenda, avisos e mídias.

## 6.42.0 — Evolução funcional etapa 6

- Adiciona usuários e senhas individuais vinculados aos associados.
- Cria cargos padrão e permite cargos personalizados.
- Centraliza permissões de consulta e edição por cargo.
- Adiciona entrada específica para Usuário na Área administrativa.
- Protege publicação, backups, importação, recuperação e gestão de acessos para o Administrador.
- Armazena somente derivação PBKDF2-SHA-256 das senhas, com salt individual.
- Atualiza o esquema para a versão 11 sem alterar dados operacionais.
- Mantém alterações de usuários pendentes até a publicação pelo Administrador no mesmo navegador.

## 6.40.0 — Evolução funcional etapa 4

- Moderniza a interface da Tesouraria e reduz o peso visual das movimentações.
- Permite expandir gráficos clicando diretamente no cartão ou usando o teclado.
- Torna a seção de movimentações programadas recolhível.
- Preserva filtro, pesquisa, paginação e rolagem após editar uma movimentação.
- Adiciona cobrança somente ao associado ou para toda a família.
- Mantém o esquema 10 e não altera dados operacionais.

# Changelog

## 6.39.0 — Evolução funcional etapa 3

- Permite cadastrar eventos e reuniões on-line antes da disponibilização do link.
- Identifica compromissos on-line sem link em Agenda, Dashboard, calendário e relatórios.
- Remove o texto automático do compartilhamento de aniversários.
- Remove a confirmação automática após gerar ou baixar a homenagem.
- Disponibiliza no computador opções públicas para copiar, baixar e abrir o WhatsApp.
- Simplifica a entrada administrativa para solicitar somente a credencial de acesso.
- Substitui mensagens técnicas de token por linguagem mais clara.
- Mantém esquema 10 e todos os dados e regras existentes.

## 6.38.0 — Evolução funcional etapa 2

- Preserva tela, seção, rolagem e foco após salvar ou atualizar informações.
- Impede que a atualização remota redirecione o usuário para o Início.
- Mantém filtros, paginação e estados internos durante novas renderizações.
- Moderniza a central de publicação com linguagem simples e fluxo Conferir, Salvar e Publicar.
- Reorganiza Ajustes em Identidade, Visual, Mensalidades e Acesso.
- Adiciona prévia ao vivo, atalhos internos e barra de salvamento responsiva.
- Mantém esquema 10 e todos os dados e regras existentes.

## 6.37.0 — Evolução funcional etapa 1

- Reestrutura a imagem de boas-vindas e centraliza o logotipo do clube.
- Cria card semântico e centralizado para o horário.
- Agrupa sessão, atualização e sincronização no cabeçalho autenticado.
- Padroniza tipografia e pesos visuais da interface.
- Adiciona escolha de fonte em Ajustes, sem dependência externa.
- Mantém esquema 10 e todos os dados e regras existentes.

## 6.36.0 — Refatoração etapa 8 e estabilização final

- Remove dois módulos comprovadamente fora do grafo real da aplicação.
- Adiciona auditoria de módulos órfãos, imports ausentes e dependências circulares.
- Valida os contratos da Tesouraria diretamente nos módulos usados em produção.
- Cria backup local automático dos arquivos de dados antes da atualização.
- Mantém somente os 10 backups locais mais recentes e registra SHA-256.
- Consolida testes, auditorias e manifesto em um único pipeline de release.
- Corrige o `.gitignore` para permitir a publicação do iniciador de homologação.
- Encerra as oito etapas da refatoração sem alterar dados ou regras de negócio.

## 6.35.0 — Refatoração etapa 7

- Homologa cinco telas principais em cinco resoluções, totalizando 25 cenários visuais.
- Simplifica o cabeçalho em celulares pequenos para evitar corte do título.
- Organiza os resumos do Dashboard em duas colunas no tablet.
- Reestrutura os controles da Agenda em grupos proporcionais e acessíveis.
- Simplifica o rótulo lateral para **Aniversários** e evita truncamento no notebook.
- Amplia a auditoria automática de estouro, carregamento e navegação responsiva.
- Mantém o esquema 10 e todos os dados e regras existentes.

## 6.34.0 — Refatoração etapa 6

- Evita substituir HTML idêntico nas listas de aniversariantes, avisos e movimentações.
- Evita reconstruir gráficos financeiros quando os dados renderizados não mudaram.
- Religa eventos somente após uma alteração real do conteúdo.
- Amplia o sprite SVG local para a Área administrativa, relatórios, backups e Tesouraria.
- Move os estilos de carregamento para a camada de interação responsável.
- Adiciona testes de regressão para renderização incremental, ícones e organização CSS.
- Mantém o esquema 10, os dados e todas as regras atuais de Tesouraria, mensalidades e Mútuas.

## 6.33.0 — Refatoração etapa 5

- Cria miniaturas WebP de 96 e 192 px para as fotos dos associados.
- Faz os avatares usarem `srcset`, carregamento tardio e fallback para o original.
- Gera original e miniaturas no mesmo commit ao publicar novas fotos.
- Converte o template de aniversário de aproximadamente 2,85 MB para 264 KB.
- Adiciona auditoria automática de mídia aos controles oficiais.
- Mantém os originais, o esquema 10 e todas as regras de Tesouraria, mensalidades e Mútuas.

## 6.32.0 — Refatoração etapa 4

- Retira o controlador completo da Tesouraria do grafo inicial.
- Mantém a seção financeira escolhida durante o carregamento sob demanda.
- Cria modelo leve e testável para o resumo financeiro do Dashboard.
- Reduz o JavaScript inicial de 189.625 para 177.177 bytes.
- Reduz os ativos críticos de 581.107 para 569.143 bytes.
- Padroniza os ícones dos cards principais do Dashboard com SVG local.
- Adiciona testes de regressão para resumo financeiro e carregamento tardio.
- Mantém o esquema 10 e todas as regras atuais de Tesouraria, mensalidades e Mútuas.

## 6.31.0 — Refatoração etapa 3

- Carregamento sob demanda da tela de Ajustes e da revisão de publicação.
- Redução do JavaScript inicial de 226.741 para 189.625 bytes.
- Remoção segura de 64 regras CSS integralmente substituídas.
- Redução das sobrescritas CSS de 611 para 547.
- Sprite SVG local para menu, navegação móvel e cabeçalho.
- Novos testes de carregamento, ícones e orçamento CSS.
- Nenhuma alteração no esquema de dados ou nas regras de Tesouraria e Mútuas.

# Histórico de versões

## 6.30.0 — Carregamento sob demanda e redução do JavaScript inicial

- Retira Agenda, Tesouraria completa, formulários, gerenciadores administrativos, painel e relatórios do carregamento inicial.
- Adiciona prefetch por intenção na navegação lateral e móvel.
- Cria estados acessíveis de carregamento e erro para módulos dinâmicos.
- Reduz o JavaScript inicial de 401.338 para 226.741 bytes.
- Reduz o grafo estático de 61 para 41 módulos.
- Adiciona auditoria visual opcional para cinco resoluções.
- Mantém esquema 10, dados e todas as regras atuais.

## 6.29.0 — Otimização incremental e base de desempenho

- Remove arquivos CSS históricos e a pasta legacy que não participavam do bundle.
- Consolida uma fonte CSS e preserva o visual atual em uma camada moderna explicitamente identificada.
- Adota logotipo WebP leve na interface, mantendo o PNG original.
- Carrega a geração da arte de aniversário somente quando solicitada.
- Ativa carregamento tardio das fotos em listas.
- Cria orçamento automático para JavaScript inicial, CSS e ativos críticos.
- Restaura o iniciador de homologação do Windows.
- Mantém o esquema 10 e todos os dados existentes.

## 6.28.0 — Redesign Clean UI e correções responsivas

- Corrige os totais do filtro Programados na Tesouraria.
- Recalcula entradas, saídas, resultado e quantidade conforme o filtro ativo.
- Reestrutura o componente Agenda do Dashboard para notebooks, tablets e celulares.
- Moderniza a interface completa com nova hierarquia visual, espaçamentos, cards, botões, campos, tabelas e modais.
- Simplifica títulos, descrições e ações sem remover funcionalidades.
- Mantém o esquema 10 e todos os dados existentes.

## 6.27.2 — Cobranças de Mútua definitivas

- Substitui, nas cobranças em aberto, a informação “Falecimento em” por “Cobrança gerada em”.
- Usa a data local de criação da ocorrência (`createdDate`), mantendo `createdAt` como registro técnico para informar quando a cobrança foi gerada.
- Torna cada ocorrência de Mútua definitiva após a geração: não há edição nem exclusão.
- Preserva para sempre a fotografia dos participantes incluídos no momento do registro.
- Mantém a edição do grupo somente para definir participantes de cobranças futuras.

## 6.27.1 — Correção da geração de cobranças de Mútua

- Corrige a perda da ocorrência ao consultar os participantes antes da gravação.
- Preserva a referência do grupo de Mútua durante a normalização do estado.
- Reobtém e valida o grupo imediatamente antes de anexar o falecimento.
- Garante que cada participante incluído apareça como cobrança em aberto.
- Adiciona teste de regressão para o fluxo que apresentou o erro.
- Mantém todos os dados existentes e não altera a regra de cobrança somente por falecimento.

## 6.27.0 — Mútuas por ocorrência de falecimento

- Remove a geração mensal automática de cobranças de Mútua.
- Cria cobranças somente após o registro de um falecimento de associado do Distrito.
- Registra a pessoa falecida, a data, o valor individual e uma fotografia lógica dos participantes do grupo naquele momento.
- Preserva as movimentações financeiras históricas e os participantes já cadastrados.
- Permite baixa individual ou em lote, com um movimento financeiro por participante.
- Atualiza dashboard, relatórios, recuperação, revisão de publicação e testes para o novo fluxo.
- Mantém o Portal no modelo atual com dados em `data/dados.json`, sem migração para Cloudflare, D1 ou R2.

## 6.46.7 — Refatoração etapa 2

- Remove 221 regras CSS totalmente anuladas por definições posteriores com o mesmo seletor e o mesmo contexto responsivo.
- Reduz os seletores redefinidos de 438 para 330 e as sobrescritas de 617 para 426.
- Reduz o bundle CSS de 445.734 para 428.408 bytes sem criar novas fontes de estilo.
- Recalibra os limites impeditivos para 350 seletores redefinidos, 450 sobrescritas, fonte máxima de 38 KB e bundle máximo de 435 KB.
- Preserva a ordem histórica das 33 fontes CSS e não altera regras funcionais, dados ou permissões.


## 6.46.7 — Refatoração pós-movimentações, etapa 2

- Centraliza Entrada, Saída e Transferência em um domínio financeiro único.
- Consolida os dois lançamentos internos de uma transferência como uma operação no histórico e na paginação.
- Adiciona filtro próprio de Transferências e impede que transferências apareçam nos filtros de Entradas/Saídas.
- Mantém transferências nos saldos individuais das contas, mas as exclui das receitas, despesas e resultado financeiro geral.
- Preserva compatibilidade com movimentações históricas sem `movementKind`.
- Adiciona regressões específicas para classificação, pareamento e neutralidade financeira das transferências.

## 6.46.7 — Refatoração pós-movimentações, etapa 3

- Fecha o ciclo de estabilização de Entrada, Saída e Transferência com regressões de criação, edição, exclusão lógica, status e saldos por conta.
- Corrige uma dependência incorreta no módulo lazy de formulários administrativos que poderia impedir a abertura de ações da Tesouraria em runtime.
- Centraliza a construção do par contábil da transferência, preservando os IDs de origem/destino durante edições e mantendo anexos somente no lançamento de origem.
- Centraliza a identificação dos registros físicos pertencentes a uma operação lógica para edição e exclusão atômica da transferência.
- Adiciona rollback na exclusão de transferência quando a persistência falha, evitando remoção parcial do par origem/destino.
- Formaliza os status de transferência: Efetivado para operações concluídas, Programado para futuras e Vencida quando uma programação passa da data.
- Mantém transferências neutras no resultado geral do clube e ativas apenas nos saldos atual/projetado das contas envolvidas.
- Amplia a suíte para 374 regressões sem alterar o esquema 12 nem os arquivos oficiais de dados.

## Complemento visual — 2026-08-21

- Ajustado o layout do extrato de mensalidades, compactando os blocos de saldo anterior e pagamentos vinculados.
- Reforçada a diferenciação visual entre os status Quitado, Pendente e Parcial na listagem de mensalidades e no extrato.
