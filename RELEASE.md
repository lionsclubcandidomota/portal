# Portal Lions v6.49.1

> Conta padrão configurável para recebimento de mensalidades, preservando a estabilização do pacote e sem migração dos arquivos oficiais.


## Conta padrão para mensalidades — v6.49.1

- adiciona em **Tesouraria → Contas → Editar conta** a opção **Conta padrão para receber mensalidades**;
- garante que somente uma conta ativa seja marcada como padrão por vez; ao escolher uma nova, a anterior perde automaticamente o status;
- impede que uma conta inativa seja definida como padrão e remove o status caso a conta padrão seja desativada;
- identifica a conta configurada com o selo **Padrão mensalidades** no gerenciador;
- em **Dar baixa de mensalidade**, pré-seleciona a conta padrão, mantendo a possibilidade de escolher outra conta manualmente para aquela baixa;
- preserva compatibilidade com bases antigas: se nenhuma conta estiver configurada, a primeira conta ativa continua sendo usada como seleção inicial;
- inclui `membershipDefault` na revisão de publicação das contas, garantindo que a alteração faça parte do fluxo normal de persistência/publicação;
- preserva `data/dados.json`, `data/modelo.json` e o esquema 12 sem migração.

## Controle de Mensalidades — v6.49.0

- confirma e protege por regressão que **Previsão pendente** soma somente o saldo das competências do período filtrado; o **Saldo anterior em aberto** permanece totalmente separado;
- reorganiza o resumo do Controle de Mensalidades em três blocos: **Base ativa**, **Situação das competências** e **Valores do período**;
- adiciona contagem de associados **Individuais** e **Familiares**, com detalhamento de titulares, adicionais e quantidade de grupos familiares ativos;
- separa competências **Quitadas**, **Parciais** e **Em aberto**, evitando que pagamentos parciais sejam misturados com competências sem pagamento;
- adiciona **Previsto no período**, preservando o valor histórico correto de cada competência e a vigência dos reajustes;
- mantém **Recebido**, **Previsão pendente** e **Saldo anterior** visualmente separados, com indicação explícita de que o saldo anterior não integra a previsão mensal;
- refina o painel em desktop, tablet e celular com cards agrupados e tokens compatíveis com Claro/Escuro;
- recalibra de forma controlada os orçamentos para **442.000 bytes de CSS** e **790.000 bytes de ativos críticos**, sem alterar o limite de JavaScript estático;
- preserva `data/dados.json`, `data/modelo.json` e o esquema 12 sem migração.

## Mensalidades e Extrato — v6.48.3

- adiciona o KPI **Previsão pendente** ao Controle de Mensalidades;
- calcula a previsão exclusivamente pelas competências ainda em aberto dentro do período selecionado em `membershipStart`/`membershipEnd`;
- mantém o **Saldo anterior em aberto** fora desse cálculo e apresentado separadamente;
- reaproveita `membershipOutstandingForMonth`, portanto respeita valores históricos por competência, reajustes com vigência, quitações e pagamentos parciais;
- substitui a superfície clara fixa de **Pagamentos vinculados** no Extrato por tokens do design system, corrigindo a leitura no modo escuro;
- preserva a **estabilização do pacote**, o esquema 12 e os arquivos oficiais de dados.


## Ajuste de tema — v6.48.2

- define **Modo claro** como padrão em navegadores sem preferência previamente salva;
- mantém a escolha manual Claro/Escuro persistida somente no navegador;
- remove a adoção automática do tema escuro do sistema operacional para tornar a inicialização previsível;
- corrige as notificações/toasts para usar a superfície semântica do tema, eliminando fundo claro com texto de baixo contraste no modo escuro;
- corrige campos nativos de data, data/hora, mês e hora no modo escuro, inclusive o estado obrigatório ainda não preenchido;
- preserva a **estabilização do pacote**, o esquema de dados 12 e os arquivos oficiais `data/dados.json` e `data/modelo.json`.

## Objetivo

A versão 6.48.2 dá continuidade ao refinamento iniciado na v6.48.1 e preserva as correções que refinam o **Modo escuro** introduzido na v6.48.0, corrigindo componentes que ainda carregavam superfícies claras fixas ou contraste insuficiente. A correção é estrutural: componentes compartilhados passam a consumir os tokens do tema na origem, evitando uma nova camada extensa de exceções e mantendo a **estabilização do pacote** e o esquema de dados 12.

### Refinamento do modo escuro — v6.48.1

- substitui fundos brancos/cinzas fixos por superfícies semânticas (`--surface`, `--surface-2`, `--surface-3` e `--surface-glass`) nos componentes afetados;
- corrige cards do Dashboard/Agenda, cards de Dirigentes, contas negativas, cards de associados em Mensalidades e cards expansíveis de Movimentações;
- corrige modais administrativos e financeiros, inclusive rodapés fixos, seleção de competências e blocos do modal **Dar baixa de mensalidade**;
- corrige o **Extrato de mensalidades**, principalmente pagamentos vinculados e superfícies internas;
- torna Mútuas realmente adaptável ao tema, com tokens próprios para a paleta roxa e contraste adequado de associados/mutuários;
- corrige Agenda e Avisos, incluindo cards atuais/históricos, barras de comando e áreas expandidas;
- adapta editor Markdown, barra de ferramentas, pré-visualização, blocos de destaque e mensagens ao tema ativo;
- corrige Ajustes, prévias, atalhos, barra de salvamento e componentes compartilhados de publicação/auditoria;
- preserva intencionalmente superfícies que precisam continuar claras por conteúdo, como o fundo do próprio arquivo de logotipo, sem propagar branco para o card ao redor;
- adiciona regressão específica para impedir o retorno de superfícies brancas fixas nos componentes críticos e valida os tokens de Mútuas em claro/escuro;
- preserva integralmente `data/dados.json` e `data/modelo.json`.

### Funcionalidades preservadas da v6.48.0

A versão 6.48.0 evoluiu a base visual consolidada na v6.47.0 com duas funcionalidades integradas ao design system:

- adiciona **Rendimento bancário** como modo especializado de Entrada na Tesouraria;
- ao selecionar conta, data e informar o saldo apresentado pelo banco, calcula automaticamente a diferença positiva em relação ao saldo realizado do Portal naquela referência;
- mantém a movimentação como uma Entrada financeira normal, categorizada em **Rendimentos bancários**, sem criar um novo campo de usuário responsável;
- recalcula o saldo de referência no momento da confirmação, sem confiar apenas no valor mostrado no formulário;
- impede rendimento nulo ou negativo e orienta a conferir tarifas, débitos ou movimentações pendentes em vez de criar uma saída implícita;
- grava no próprio lançamento o saldo do Portal antes do rendimento e o saldo informado pelo banco para facilitar conferência posterior;
- preserva edição, exclusão, permissões, histórico e auditoria já existentes nas movimentações;
- adiciona **Modo escuro** global com alternância no cabeçalho, preferência individual por navegador e fallback para a preferência do sistema operacional;
- o tema escuro reutiliza os tokens do design system da v6.47.0 e cobre navegação, cards, tabelas, formulários, modais, Tesouraria e demais superfícies principais sem duplicar um segundo layout;
- mantém a cor institucional configurável como referência da marca, derivando automaticamente tons adequados para o tema escuro;
- amplia de forma justificada os orçamentos para **310.000 bytes de JavaScript estático**, **438.000 bytes de CSS** e **785.000 bytes de ativos críticos**, necessários para a nova lógica e a camada completa de tema;
- preserva integralmente `data/dados.json` e `data/modelo.json`.

### Base visual preservada

A refatoração visual global da v6.47.0 permanece como base. A nova camada escura é aplicada por tokens e exceções de superfície, enquanto o tema claro mantém o acabamento já homologado. As correções financeiras de Mensalidades e Extrato também permanecem inalteradas.

Na v6.47.0 foi consolidada uma **refatoração controlada de UI/CSS** sobre a **estabilização do pacote** da v6.46.13. O foco é reduzir sobreposições acumuladas, centralizar o design system e modernizar a experiência em desktop e mobile sem reescrever os fluxos funcionais nem alterar contratos financeiros.

- centraliza paleta, superfícies, tipografia, espaçamentos, raios, sombras, foco, dimensões e z-index em uma única camada de tokens;
- remove definições duplicadas de tokens e declarações antigas que já eram totalmente sobrescritas pelas camadas modernas;
- moderniza sidebar, topbar, área de conteúdo, heros, cards, KPIs, formulários, botões, tabelas, estados vazios e badges com uma linguagem visual única;
- melhora contraste, hierarquia tipográfica, áreas de toque, foco visível e consistência de bordas e superfícies;
- refina o comportamento responsivo dos KPIs do Dashboard, preservando duas colunas em larguras intermediárias e uma coluna em celulares menores;
- preserva as especializações já estabilizadas de Tesouraria, Mensalidades, Extrato, Mútuas, Usuários e cargos, Dirigentes e Painel de Publicação;
- reduz o bundle CSS de 421.984 para aproximadamente 420.971 bytes, sem aumentar o orçamento de 422.000 bytes;
- reduz as sobrescritas auditadas de 437 para 417 e os seletores redefinidos de 340 para 334, mantendo zero duplicatas exatas e zero fontes legadas;
- preserva integralmente `data/dados.json` e `data/modelo.json` e mantém o esquema de dados na versão **12**.

### Base funcional preservada

A refatoração visual não altera as correções financeiras consolidadas na v6.46.13, incluindo histórico de vigência das mensalidades, pagamentos parciais, saldo anterior, crédito, filtro de período e composição do saldo devedor líquido.

- corrige o **Saldo devedor** para somar o valor em aberto das competências com o **saldo anterior ainda em aberto**;
- desconta do saldo devedor líquido qualquer **Saldo positivo/Crédito** apurado nas competências do período selecionado;
- mantém o KPI **Em aberto** restrito às competências filtradas e o bloco **Saldo anterior** apresentado separadamente, evitando duplicidade visual;
- adiciona regressão específica para a fórmula `mensalidades em aberto + saldo anterior em aberto - crédito`;

- corrige a causa do corte vertical dos cards do Extrato: a lista deixa de usar Grid com linhas redimensionáveis dentro de `max-height` e passa a usar coluna flexível com cada competência impedida de encolher;
- transforma o modal do Extrato em uma composição flexível com cabeçalho e rodapé estáveis e rolagem exclusiva da lista de competências;
- mantém altura mínima real dos cards e dos indicadores internos em desktop e tablet;
- no mobile, usa modal em tela cheia nas larguras menores, KPIs responsivos e valores da competência em duas colunas, com o saldo ocupando a largura inteira;
- remove o bloco visual “Nenhum pagamento registrado” das competências sem pagamento, mantendo “Pagamentos vinculados” apenas quando existe lançamento para mostrar;
- preserva integralmente as regras financeiras, o histórico de vigência e os filtros de período da v6.46.11;
- registra automaticamente o histórico de reajustes dos três valores de mensalidade, com vigência no mês seguinte ao salvamento;
- mantém competências retroativas ainda em aberto no valor vigente antes do reajuste;
- aplica a regra a mensalidade individual, Titular Familiar e Familiar Adicional;
- mantém pagamentos futuros usando o valor correspondente à competência selecionada, inclusive no modal de baixa;
- oferece compatibilidade com bases da v6.46.10 sem histórico explícito, inferindo o valor anterior a partir dos snapshots de pagamentos já existentes;
- sincroniza Dashboard, Mensalidades, baixa, cobrança e Extrato com a mesma resolução histórica por competência;
- refina os cards do Extrato com altura estável, melhor separação visual, estados Quitada/Parcial/Em aberto mais claros e rolagem responsiva;
- preserva o valor esperado histórico de cada competência quando já existe pagamento vinculado;
- impede que reajustes posteriores reabram como Parcial uma competência anteriormente quitada;
- aplica a mesma regra a mensalidade individual, Titular Familiar e Familiar Adicional;
- mantém competências parcialmente pagas com o valor esperado registrado no momento da baixa;
- competências sem histórico de pagamento continuam usando o valor vigente configurado;
- registros legados sem detalhamento de rateio usam a alocação já recebida como referência histórica de quitação;
- sincroniza Mensalidades, modal de baixa, Extrato individual e resumo do Dashboard com a mesma regra histórica;
- adiciona regressões específicas para reajuste após quitação e para preservação de pagamentos parciais;
- remove o botão “Selecionar pendentes” e o código de evento associado;
- amplia e reorganiza o modal de baixa no desktop, com melhor espaçamento dos blocos;
- melhora a leitura das competências, inclusive estados Parcial e Pago, mantendo comportamento responsivo;
- usa o período já selecionado em Mensalidades ao abrir o extrato;
- limita competências, Total recebido, Em aberto, Saldo positivo e Saldo líquido ao intervalo selecionado;
- mantém Saldo anterior e seus pagamentos em bloco próprio e independente;
- preserva pagamentos parciais, créditos, cobranças individuais/familiares e carregamento lazy;
- reforça o estado **Parcial** em azul na tela de Mensalidades e sincroniza o bundle `app.css`;
- melhora a hierarquia, compactação e responsividade do CSS do extrato;
- adiciona teste de regressão específico para o filtro de período;
- preserva integralmente `data/dados.json` e `data/modelo.json`;
- mantém o esquema de dados na versão **12**.

## Refatoração técnica concluída — etapa 4

Além da higiene de release e da consolidação CSS, esta base utiliza a auditoria corrigida do grafo JavaScript. O carregamento inicial passou de **378.503 bytes para 301.158 bytes** na métrica real, que inclui reexports estáticos.

Ficam fora do bootstrap e são carregados somente quando necessários: Central de Recuperação, interface completa do Painel de Publicação, interface do Histórico de Alterações, operações administrativas do GitHub, preparação de mídia para publicação e interface da revisão de alterações.

A etapa 4 encerra o ciclo com uma auditoria dedicada de lazy loading. O pipeline valida **19 imports dinâmicos/pontos de entrada** e protege **24 módulos** contra retorno acidental ao carregamento inicial, além de exigir o `?v=` sincronizado com a versão do pacote.

Os orçamentos oficiais atuais são **310.000 bytes** para JavaScript estático, **438.000 bytes** para CSS e **785.000 bytes** para ativos críticos. A ampliação em relação à etapa 4 é justificada pelas funcionalidades de rendimento bancário e modo escuro e continua protegida pelas auditorias de desempenho e CSS. A estabilização não altera o esquema 12 nem o conteúdo operacional dos arquivos oficiais de dados.

## Compatibilidade de dados

- Esquema atual: **12**.
- `data/dados.json`: preservado byte a byte nesta etapa.
- `data/modelo.json`: preservado byte a byte nesta etapa.
- Nenhuma movimentação, cobrança, grupo, usuário, cargo, dirigente, associado ou mídia é alterado pela higiene do release.

## Pipeline de release

O pipeline oficial continua sendo:

```cmd
npm run release:prepare
```

Ele executa backup local, migração idempotente, geração do CSS, portões de qualidade, manifesto, auditoria do release e verificação final do manifesto.

A validação direta do pacote pode ser executada por:

```cmd
npm run release:check
```

## Homologação

A auditoria visual automatizada permanece disponível por:

```cmd
npm run audit:visual:required
```

A revisão manual deve seguir `docs/homologation.md`, priorizando Tesouraria, Mútuas, Usuários e cargos, Dirigentes, Agenda inicial e Painel de Publicação em desktop e mobile.

## Política após a etapa 4

O ciclo de refatoração v6.46.7 permanece encerrado; as versões v6.46.8, v6.46.9, v6.46.10 e v6.46.11 são evoluções incrementais sobre essa base. Evoluções posteriores devem ser incrementais e mensuráveis, preservando os orçamentos de CSS/JavaScript e os contratos de lazy loading. Qualquer ampliação de orçamento deve ser justificada por uma necessidade funcional concreta e acompanhada de testes de regressão.

### Refatoração pós-movimentações — etapa 2

A Tesouraria passa a usar um domínio único para Entrada, Saída e Transferência. Transferências são exibidas e contabilizadas como uma operação lógica, preservando os dois lançamentos internos necessários ao saldo das contas sem inflar receitas/despesas do clube.

### Refatoração pós-movimentações — etapa 3

O ciclo de consolidação da Tesouraria é encerrado com regressões específicas de Entrada, Saída e Transferência. A construção e a remoção do par contábil da transferência passam a usar contratos únicos, a exclusão possui rollback em caso de falha de persistência e o módulo administrativo lazy é validado por import direto. A operação continua alterando apenas os saldos das contas envolvidas, sem compor receita, despesa ou resultado financeiro geral. O esquema permanece na versão 12 e os arquivos oficiais de dados não são migrados.
### Saldo diário e contas negativas — 21/08/2026

A Tesouraria passa a apresentar o saldo realizado da conta ao fim da data de cada movimentação e, para operações programadas, o saldo previsto na mesma referência. Transferências exibem a posição das duas contas envolvidas. O gráfico de saldo por conta deixa de usar uma representação circular exclusiva para valores positivos e passa a mostrar também saldos zerados e negativos em torno de um eixo de zero. Os cards de contas sinalizam saldo negativo e o saldo atual permanece independente do filtro temporal aplicado ao histórico. Não há migração de dados e o esquema permanece em v12.


### Rateio de mensalidades e pagamentos parciais — 21/08/2026

O controle de mensalidades passa a acompanhar o valor efetivamente recebido por associado e competência. Uma competência somente é considerada quitada quando os recebimentos acumulados atingem o valor esperado. O novo modo de rateio permite informar um valor recebido e distribuí-lo das competências mais antigas selecionadas para as mais recentes, mantendo eventual saldo restante como parcial. A cobrança compartilhada considera somente o débito remanescente. A evolução é compatível com registros anteriores e não exige migração do esquema 12.

## Complemento visual — 2026-08-21

- Ajustado o layout do extrato de mensalidades, compactando os blocos de saldo anterior e pagamentos vinculados.
- Reforçada a diferenciação visual entre os status Quitado, Pendente e Parcial na listagem de mensalidades e no extrato.
