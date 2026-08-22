# Portal Lions v6.46.13

> Correção do saldo devedor líquido no Extrato de mensalidades sobre a estabilização do pacote, sem migração dos arquivos oficiais.

## Objetivo

A versão 6.46.13 é uma evolução incremental sobre a **estabilização do pacote** e sobre a v6.46.12. Corrige o cálculo do Saldo devedor do Extrato de mensalidades para considerar também o saldo anterior ainda em aberto e descontar créditos positivos do período selecionado, preservando a apresentação separada dos componentes.


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

Os orçamentos oficiais finais são **315.000 bytes** para JavaScript estático, **435.000 bytes** para CSS e **785.000 bytes** para ativos críticos. A estabilização não altera o esquema 12 nem o conteúdo operacional dos arquivos oficiais de dados.

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
