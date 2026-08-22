# Homologação — v6.46.13

> Procedimento de validação funcional, responsiva e de desempenho do Portal 6.46.13.


## Consolidação do pacote — versão 6.46.13

1. Execute `FINALIZAR-ATUALIZACAO.bat` e confirme a aprovação do pipeline completo.
2. Confirme que `data/dados.json` continua no esquema 12 e que seu conteúdo operacional não foi alterado.
3. Confirme que `data/modelo.json` está no esquema 12 e contém `accessRoles`, `portalUsers` e `leadershipAssignments`.
4. Execute `npm run release:verify` e confirme que o manifesto reconhece todos os arquivos atuais.
5. Execute `npm run audit:lazy` e confirme que todos os imports dinâmicos estão versionados e os módulos protegidos permanecem fora do bootstrap.
6. Em 360 e 390 px, revise **Tesouraria → Movimentações, Contas, Mensalidades e Mútuas**, sem cortes ou rolagem horizontal inesperada.
7. Abra **Mútuas → Gerenciar grupos** e **Registrar falecimento**, verificando cartões, listas, rolagem interna e botões.
8. Abra **Usuários e cargos** e valide as seções recolhíveis, retratos e histórico por Ano Leonístico.
9. Como visitante, abra **Dirigentes**, alterne entre o AL atual e os anteriores e confirme as fotografias e o estado vazio quando aplicável.
10. Abra o **Painel de Publicação** e confirme hierarquia, progresso, botões e responsividade.
11. Atualize a página e confirme ausência de erros no console.

> A arquitetura está congelada após esta estabilização. Correções posteriores devem ser locais e acompanhadas de testes de regressão.


### Vigência histórica das mensalidades e Extrato — v6.46.13

1. Em **Ajustes → Mensalidades**, anote os três valores atuais e altere pelo menos um deles durante o mês corrente.
2. Em **Tesouraria → Mensalidades**, confirme que competências do mês corrente e meses anteriores continuam com o valor anterior, inclusive quando ainda estão em aberto.
3. Avance o filtro para o mês seguinte e confirme que a nova competência utiliza o valor reajustado.
4. Repita a validação com um associado individual, um Titular Familiar e um Familiar Adicional.
5. Abra **Dar baixa de mensalidade** e confirme que o valor usado no rateio acompanha a competência selecionada, e não apenas o valor mais recente configurado.
6. Abra o **Extrato de mensalidades** e confira os cards de Quitada, Parcial e Em aberto, sem cortes nos valores ou sobreposição entre competências.
7. Em um associado com saldo anterior ainda em aberto, confirme que o **Saldo devedor** soma esse débito ao aberto das competências do período.
8. Gere um crédito/saldo positivo em uma competência e confirme que ele é descontado do **Saldo devedor**, sem alterar o valor bruto exibido no KPI **Em aberto**.
9. Em 390, 768 e 1366 px, valide o Extrato com rolagem interna, KPIs e cards de competências legíveis.
10. Confirme que `data/dados.json` e `data/modelo.json` permanecem inalterados.

## Largura integral da prévia de participantes — versão 6.46.4

1. Abra **Tesouraria → Mútuas → Registrar falecimento** em uma tela ampla.
2. Selecione um grupo com participantes e confirme que o resumo ocupa toda a largura do painel.
3. Confirme que as duas colunas de participantes dividem igualmente o espaço, sem área vazia lateral.
4. Valide nomes curtos e longos, fotos e identificação de associado ou mutuário.
5. Em 390 px, confirme que a lista muda para uma coluna e não produz rolagem horizontal.
6. Confirme que nenhum registro é criado enquanto o formulário não for confirmado.


## Estabilização visual dos formulários de Mútuas — versão 6.46.3

1. Em **Tesouraria → Mútuas**, role a página e abra **Gerenciar grupos**; confirme que o modal começa no título e nos primeiros campos, sem reaproveitar a rolagem anterior.
2. Feche e reabra o modal após rolar sua lista; confirme que ele volta ao início.
3. Verifique se cada participante possui altura suficiente para nome, identificação, fotografia e controle, sem texto cortado ou cartões achatados.
4. Valide a grade de participantes em 390, 768 e 1366 px: uma coluna no celular e duas colunas quando houver espaço.
5. Abra **Registrar falecimento** e confirme que a área de participantes ocupa toda a largura do formulário.
6. Confira se todos os participantes do grupo são exibidos, sem a mensagem de itens ocultos.
7. Role a lista interna e confirme que cabeçalho e rodapé de ações do modal permanecem utilizáveis.
8. Feche e reabra o registro de falecimento; confirme que o formulário volta ao início e que nenhum dado foi criado sem confirmação.
9. Confirme que grupos, ocorrências, cobranças, Tesouraria, usuários e fotografias permanecem inalterados.

## Correção de Mútuas e Tesouraria móvel — versão 6.46.2

1. Em **Tesouraria → Mútuas**, abrir **Gerenciar grupos** e confirmar que o modal abre sem erro no console.
2. Pesquisar, selecionar e remover participantes, verificando que o contador da janela é atualizado corretamente e não interfere no contador de cobranças da Tesouraria.
3. Abrir **Registrar falecimento** em 390, 768 e 1366 px e confirmar que campos, resumo, lista de participantes e botões permanecem alinhados, legíveis e acessíveis.
4. Conferir na prévia da ocorrência a diferenciação visual entre **Associado** e **Mutuário**, inclusive em nomes longos e telas pequenas.
5. Em um celular de 390 px, abrir a Tesouraria e confirmar que **Movimentações**, **Contas**, **Mensalidades** e **Mútuas** aparecem simultaneamente em uma grade visível, sem exigir gesto horizontal oculto.
6. Confirmar que o texto de orientação da navegação móvel é exibido e que os botões principais ficam centralizados, com área de toque adequada.
7. Navegar por todas as quatro áreas financeiras e confirmar que nenhum conteúdo fica fora do contêiner principal da Tesouraria.
8. Confirmar que a atualização não altera movimentações, cobranças, grupos, participantes, usuários, cargos, fotos ou demais dados existentes.

## Painel de Publicação, Tesouraria móvel e Mútuas — versão 6.46.1

1. Abra o Painel de Publicação e confirme as etapas **Conferir**, **Preparar** e **Publicar**.
2. Gere uma alteração de teste e valide a contagem, o resumo, o progresso e a ação **Publicar agora**.
3. Minimize o painel durante a publicação e confirme que o restante do Portal continua utilizável.
4. Em 390 px, abra a Tesouraria e percorra Movimentações, Contas, Mensalidades e Mútuas por toque.
5. Valide período, filtros, programados recolhíveis, gráficos, cartões de movimentação e formulários sem corte ou sobreposição.
6. Abra o cadastro de grupos de Mútua e confirme que associados e mutuários são visualmente diferenciados.
7. Pesquise participantes, selecione e remova itens, e valide o contador em desktop e celular.
8. Confirme que as ações financeiras revisadas usam ícones SVG locais, sem emojis funcionais.


## Navegação persistente e experiência pública — versão 6.45.0

1. Confirmar que **Atualizar Portal** permanece visível no rodapé do menu lateral e mantém a tela e a rolagem atuais.
2. Abrir **Início** como visitante e validar o novo banner institucional, o logotipo em destaque e a marca d’água sem cortes.
3. Abrir **Dirigentes**, alternar entre o AL vigente e anos anteriores e confirmar que nenhum ano futuro é exibido.
4. Validar que os cartões de Dirigentes usam a mesma identidade visual do banner inicial.
5. Abrir **Aniversariantes** como visitante e confirmar que somente o mês atual é exibido.
6. Entrar como Administrador e confirmar que os filtros completos de aniversariantes continuam disponíveis.
7. Conferir os novos ícones SVG nas telas públicas, no painel de publicação e nos estados vazios.
8. Validar Início, Dirigentes e Aniversariantes em 390, 768, 1024 e 1366 px.



## Correções específicas da versão 6.44.1

1. Entrar como Administrador e abrir **Tesouraria** pelo menu lateral.
2. Abrir **Ajustes** e confirmar a exibição do formulário.
3. Em **Usuários e cargos**, criar ou editar uma designação com `2026/2027`.
4. Confirmar que o navegador não apresenta erro de formato para esse valor.
5. Entrar como Diretoria e confirmar que a Tesouraria abre em modo de consulta.

## Dirigentes públicos e encerramento do ciclo — versão 6.44.0

1. Execute `npm run audit:integrated` e confirme a criação de `artifacts/homologation/integrated-report.json`.
2. Abra o Portal como visitante e acesse **Dirigentes** pelo menu lateral.
3. Confirme que o título mostra o Ano Leonístico vigente e que somente cargos vigentes aparecem.
4. Verifique que nome, foto e cargo vêm dos associados já cadastrados, sem número de associado, credencial ou observação interna.
5. Quando não houver designações vigentes, confirme o estado vazio sem erro.
6. Confirme que a opção **Dirigentes** permanece disponível para visitantes no menu principal.
7. Execute `npm run audit:visual:required` na estação com Chrome ou Chromium e confirme 30 capturas: seis telas em cinco resoluções.
8. Revise Dirigentes em 360, 390, 768, 1024 e 1366 px, sem cartões cortados ou rolagem horizontal.
9. Entre como Administrador, altere uma designação somente em ambiente de teste e confirme que a área pública acompanha a vigência sem duplicar o associado.
10. Confirme que o esquema permanece em 12 e que Tesouraria, Mútuas, mensalidades, famílias, agenda, avisos e fotos não foram alterados.


## Histórico de cargos por Ano Leonístico — versão 6.43.0

1. Execute `FINALIZAR-ATUALIZACAO.bat` e confirme a migração para o esquema 12.
2. Abra **Área administrativa → Usuários e cargos**.
3. Confira o AL atual e a seção **Histórico por Ano Leonístico**.
4. Crie uma designação no AL vigente e confirme o cargo no cartão do usuário.
5. Altere o cargo do usuário com uma data posterior e confirme que o registro anterior foi encerrado, sem ser apagado.
6. Crie uma designação para o próximo AL e confirme que ela aparece como **Próximo**, sem conceder permissão antes da data inicial.
7. Teste um usuário com somente cargo encerrado e confirme que a entrada é recusada.
8. Reative o acesso criando uma designação vigente e confirme as permissões do novo cargo.
9. Desative uma designação e confirme que o histórico permanece visível.
10. Valide a tela em 390, 768, 1024 e 1366 px.

## Usuários, cargos e permissões — versão 6.42.0

1. Execute `FINALIZAR-ATUALIZACAO.bat` e confirme a migração dos dados para o esquema 11.
2. Entre como Administrador e abra **Área administrativa → Usuários e cargos**.
3. Confira os cinco cargos padrão e suas permissões.
4. Crie um cargo personalizado, salve, edite e exclua sem afetar os cargos padrão.
5. Crie um usuário vinculado a um associado ativo e confirme que outro usuário não pode usar o mesmo associado ou nome de acesso.
6. Publique, saia e entre pelo perfil **Usuário**.
7. Confira se o cargo permite somente as telas e ações selecionadas.
8. Faça uma alteração autorizada e confirme a mensagem de que ela aguarda o Administrador.
9. Entre como Administrador no mesmo navegador, revise a alteração e publique ou descarte.
10. Troque o cargo do usuário, publique e confirme que o próximo login utiliza as novas permissões.
11. Desative o usuário e confirme que a autenticação é recusada.
12. Verifique que Usuário e Diretoria não veem gerenciamento de acessos, importação, recuperação ou backup completo.
13. Teste o fluxo em 390, 768, 1024 e 1366 px, usando mouse e teclado.
14. Exporte um backup e confirme que nenhuma senha em texto foi gravada.


## Mútuas e gerenciamento de famílias — versão 6.42.0

1. Abrir **Tesouraria → Mútuas** e expandir um grupo.
2. Confirmar que todos os participantes ativos aparecem antes das ocorrências.
3. Conferir a contagem total e a divisão entre associados e mutuários.
4. Validar que associados usam a identificação azul e mutuários usam a identificação roxa.
5. Confirmar que o número de associado aparece somente quando estiver cadastrado.
6. Registrar uma alteração de participantes em ambiente de teste e confirmar que ocorrências antigas preservam a lista original.
7. Abrir **Gerenciar famílias** e confirmar que **Famílias cadastradas** inicia recolhida.
8. Abrir **Gerenciar grupos** em Mútuas e confirmar que a lista de grupos existentes inicia recolhida.
9. Editar uma família e um grupo de Mútua, verificando que a lista correspondente abre automaticamente.
10. Validar os controles por clique, Tab e Enter/Espaço em 390, 768, 1024 e 1366 px.


## Tesouraria e cobranças — versão 6.40.0

1. Abrir a Tesouraria, selecionar um filtro e uma página diferente da primeira.
2. Editar uma movimentação e confirmar que filtro, pesquisa, página e posição da rolagem são preservados.
3. Repetir o teste nas listas de realizados e programados.
4. Recolher **Movimentações programadas**, navegar entre seções e confirmar que o estado é mantido.
5. Clicar diretamente em um cartão de gráfico e confirmar sua expansão.
6. Repetir a expansão usando Tab e Enter ou Espaço.
7. Confirmar que os controles internos do gráfico continuam funcionando sem acionar expansão indevida.
8. Abrir a ação de cobrança de um associado sem família e confirmar somente a opção individual.
9. Abrir a cobrança de um associado com grupo familiar e validar as opções **Somente o associado** e **Toda a família**.
10. Conferir nomes, períodos, valores individuais e total na mensagem familiar.
11. Validar a Tesouraria em 390, 768, 1024 e 1366 px, sem sobreposição ou estouro horizontal.


## Eventos, parabenizações e acesso — versão 6.39.0

1. Cadastrar um evento on-line sem link e confirmar que o salvamento é permitido.
2. Conferir no Dashboard e na Agenda a indicação **Link será disponibilizado**, sem botão quebrado.
3. Editar o compromisso, adicionar um link válido e confirmar a exibição do botão de acesso.
4. Tentar informar um endereço inválido e confirmar que o Portal solicita correção ou campo vazio.
5. Como visitante em celular, usar **Enviar parabéns** e confirmar que a imagem é compartilhada sem texto automático.
6. Como visitante no computador, abrir **Enviar parabéns** e validar prévia, copiar imagem, baixar e abrir WhatsApp.
7. Confirmar que nenhuma mensagem de sucesso automática aparece logo após gerar ou baixar a arte.
8. Abrir a Área administrativa e verificar que a tela solicita **Credencial de acesso**, sem mencionar token ou método técnico.


## Preservação de contexto e Ajustes — versão 6.38.0

1. Abrir **Ajustes**, rolar até Mensalidades, alterar um valor e salvar. Confirmar que a tela e a posição permanecem preservadas.
2. Repetir o teste após trocar cores, fonte, logotipo e acesso da Diretoria.
3. Em uma lista com pesquisa ou paginação, executar a atualização do Portal e confirmar que o filtro, a página e a rolagem não são reiniciados.
4. Abrir a central de publicação e conferir os passos **Conferir**, **Salvar** e **Publicar**.
5. Criar uma alteração pendente e confirmar que status, contador e ações são atualizados sem redirecionamento.
6. Validar a tela de Ajustes em 390, 768, 1024 e 1366 px, conferindo atalhos, prévia, formulários e barra de salvamento.
7. Navegar voluntariamente para outra tela e confirmar que somente essa navegação inicia no topo.


## Tela inicial, cabeçalho e tipografia — versão 6.37.0

1. Abrir **Início** como visitante e confirmar que o logotipo aparece centralizado no quadro de boas-vindas, sem distorção ou corte.
2. Repetir a validação como Diretoria e Administrador, verificando o formato compacto do quadro.
3. Conferir o horário no cabeçalho em desktop: ícone e números devem permanecer centralizados vertical e horizontalmente.
4. Entrar como Administrador e verificar que atualização e perfil ficam agrupados, sem elementos soltos.
5. Testar o cabeçalho em 1180, 900, 620 e 390 px, confirmando que os controles são reduzidos sem sobreposição.
6. Em **Ajustes**, alternar entre **Moderna**, **Suave** e **Alta legibilidade** e confirmar a aplicação imediata da fonte.
7. Atualizar a página e confirmar que a fonte escolhida permanece configurada.
8. Conferir títulos, botões, rótulos e valores de destaque, verificando consistência de peso e legibilidade.

## Tesouraria

1. Entrar como Administrador e abrir **Tesouraria**.
2. Selecionar **Programados** e confirmar que os cards exibem somente entradas, saídas e saldo previstos.
3. Comparar os totais com as movimentações programadas visíveis na lista.
4. Selecionar **Realizados**, **Entradas**, **Saídas** e **Todos**, confirmando que cada filtro recalcula os cards conforme os itens exibidos.
5. Registrar uma nova movimentação e confirmar que a listagem, os totais e os filtros continuam funcionando.

## Dashboard responsivo

1. Abrir **Início** em uma tela larga e conferir o card **Próximos compromissos**.
2. Reduzir a largura para notebook, tablet e celular.
3. Confirmar que data, local, tipo e título não se sobrepõem.
4. Confirmar que textos longos quebram linha sem ultrapassar o card.
5. Verificar alinhamento, espaçamento e legibilidade nos demais cards.

## Interface e navegação

1. Percorrer Início, Aniversários, Agenda, Avisos, Tesouraria e Área administrativa.
2. Confirmar que nomes de ações, filtros e campos estão claros e curtos.
3. Verificar consistência de botões, cards, formulários, tabelas, modais e mensagens.
4. Conferir navegação por teclado, foco visível e contraste dos elementos principais.
5. Validar o menu lateral e a navegação móvel em diferentes larguras.

## Mútuas e regressões

1. Confirmar que cobranças de Mútua são geradas somente após registrar um falecimento.
2. Confirmar que a cobrança gerada permanece vinculada aos participantes daquele momento.
3. Confirmar que a ocorrência gerada não pode ser editada nem excluída.
4. Confirmar o texto **Cobrança gerada em** nas pendências.
5. Validar que mensalidades, associados, grupos, Tesouraria, aniversários, eventos, reuniões, avisos e fotos existentes permanecem preservados.

## Encerramento

- Sair da área administrativa e confirmar o retorno ao modo visitante.
- Atualizar a página e verificar ausência de erros no console.
- Confirmar que `data/dados.json` continua no esquema 10 e não foi alterado pela atualização visual.


## Carregamento sob demanda — versão 6.32.0

1. Limpar o cache com `Ctrl + F5` e abrir o Portal como visitante.
2. Confirmar que Início, Aniversariantes e Avisos abrem normalmente.
3. Abrir Agenda e confirmar a exibição breve do estado de carregamento somente no primeiro acesso.
4. Entrar na Área administrativa e confirmar login, dashboard e relatórios.
5. Abrir Tesouraria e confirmar o estado breve de carregamento somente no primeiro acesso; depois validar movimentações, filtros, mensalidades, Mútuas e gráficos.
6. Abrir um formulário de cadastro e os gerenciadores financeiros, confirmando que o primeiro carregamento não perde a ação solicitada.
7. Navegar rapidamente entre duas telas e confirmar que uma tela carregada com atraso não substitui a tela atual.
8. Executar `npm run audit:performance` e confirmar o orçamento de até 190.000 bytes de JavaScript inicial.
9. Em uma máquina com Chrome ou Chromium, executar `npm run audit:visual`.


## Ícones e ajustes sob demanda — versão 6.32.0

1. Conferir os ícones do menu lateral e da navegação móvel em desktop e celular.
2. Alternar entre Visitante, Diretoria e Administrador e confirmar que o ícone da Área administrativa muda sem perder o alinhamento.
3. Abrir **Ajustes** e confirmar o estado breve de carregamento somente no primeiro acesso.
4. Criar uma alteração pendente, abrir **Revisar alterações** e confirmar que o modal carrega o conteúdo sem fechar.
5. Executar `npm run audit:visual`; em ambiente sem navegador funcional o comando opcional deve apenas informar que foi ignorado.
6. Executar `npm run audit:visual:required` somente na estação de homologação em que a auditoria visual deve ser obrigatória.


## Controlador financeiro e ícones do Dashboard — versão 6.32.0

1. Abrir o Portal como visitante e confirmar que a Tesouraria não é carregada no painel de rede.
2. Entrar como Diretoria ou Administrador e conferir imediatamente os resumos de Finanças, Mensalidades e Mútuas no Dashboard.
3. Clicar em **Ver controle** de Mensalidades e confirmar que a Tesouraria abre diretamente na seção correta.
4. Repetir o teste com Mútuas.
5. Conferir os novos ícones SVG dos cards em desktop, tablet e celular.
6. Voltar ao Dashboard e confirmar que os valores continuam iguais aos dados da Tesouraria.

## Mídia responsiva — versão 6.34.0

1. Abrir Início, Aniversariantes, Mensalidades e Mútuas e confirmar que as fotos aparecem normalmente.
2. No painel de rede, confirmar que as listas solicitam arquivos em `public/members/thumbs`.
3. Simular a ausência de uma miniatura e confirmar que a foto original aparece como fallback.
4. Editar um associado, escolher uma nova foto e publicar.
5. Confirmar no commit do GitHub a presença do original e das miniaturas de 96 e 192 px.
6. Gerar uma arte de aniversário e confirmar que o template WebP e a foto original mantêm boa qualidade.
7. Executar `npm run audit:media` e confirmar a aprovação.

## Renderização incremental e ícones — versão 6.34.0

1. Abrir **Aniversariantes**, alternar filtros e pesquisa e confirmar que a lista, os cartões e o resumo permanecem corretos.
2. Manter o foco no campo de pesquisa, repetir o mesmo valor e confirmar que o foco não é perdido.
3. Abrir **Avisos**, repetir filtros sem mudança nos resultados e confirmar ausência de piscadas na lista.
4. Abrir **Tesouraria**, alternar filtros e períodos e confirmar que movimentações, totais e gráficos continuam sincronizados.
5. Voltar a um filtro já selecionado sem alterar dados e confirmar que os gráficos não piscam nem perdem seus controles.
6. Conferir os ícones SVG na Área administrativa, relatórios, backups e navegação financeira em desktop e celular.
7. Confirmar que botões com ícones continuam com texto legível, foco visível e área de clique adequada.
8. Executar `npm test`, `npm run check` e, na estação com navegador funcional, `npm run audit:visual:required`.


## Homologação visual e responsiva — versão 6.35.0

1. Executar `npm run audit:visual` em uma estação com Chrome ou Chromium.
2. Confirmar a geração de 30 capturas em `artifacts/visual-audit`: seis telas em cinco resoluções.
3. Em 360 e 390 px, verificar que o cabeçalho mostra o título sem cortar e que a data não ocupa espaço excessivo.
4. Em 768 px, confirmar dois cards de resumo por linha no Dashboard e uma coluna em 360/390 px.
5. Na Agenda, confirmar dois botões iguais para Lista/Calendário e três botões iguais para Todos/Eventos/Reuniões.
6. Em 1024 px, conferir o rótulo **Aniversários** completo no menu lateral.
7. Verificar Início, Agenda, Aniversariantes, Avisos e Área administrativa em 1366 px, sem largura desperdiçada ou estouro horizontal.
8. Abrir `artifacts/visual-audit/report.json` e confirmar que `failures` permanece vazio.
9. Executar `npm run audit:visual:required` na estação oficial de homologação para impedir a aprovação quando o navegador não estiver disponível.

## Estabilização final — versão 6.36.0

1. Execute `FINALIZAR-ATUALIZACAO.bat` e confirme que uma pasta foi criada em `.portal-backups` antes da migração.
2. Abra o `metadata.json` do backup mais recente e confirme a presença de `data/dados.json`, `data/modelo.json` e seus hashes SHA-256.
3. Execute `npm run audit:modules` e confirme que todos os módulos são alcançáveis e que não existem ciclos.
4. Execute `npm run quality` e confirme a aprovação dos testes e de todas as auditorias.
5. Execute `npm run release:check` após a geração do manifesto.
6. Confirme que `INICIAR-HOMOLOGACAO.bat` aparece entre os arquivos que serão enviados pelo Git.
7. Confirme que `.portal-backups` e `artifacts` não aparecem no commit.
8. Percorra Início, Aniversários, Agenda, Avisos, Tesouraria e Área administrativa para validar que a remoção dos módulos antigos não alterou nenhum fluxo.
9. Registre uma cobrança de Mútua apenas em ambiente de teste e confirme que a regra por falecimento permanece inalterada.
10. Confirme que os arquivos operacionais continuam no esquema 10 e que o pacote de atualização não inclui `data` nem `public`.


## Verificações da v6.46.1

1. Em **Usuários e cargos**, recolher e expandir Cargos, Usuários e Histórico.
2. No Histórico, recolher e expandir cada Ano Leonístico.
3. Confirmar que dirigentes com foto exibem o retrato no histórico administrativo.
4. Na área pública **Dirigentes**, alternar entre o AL atual e anos anteriores.
5. Confirmar que ex-dirigentes inativos aparecem apenas no histórico, não na diretoria vigente.
6. Na área pública de aniversários, confirmar que não aparece a explicação técnica sobre o filtro mensal.
