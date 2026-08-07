# Homologação — v6.36.0

> Procedimento de validação funcional, responsiva e de desempenho do Portal 6.36.0.

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
8. Executar `npm run audit:performance` e confirmar o orçamento de até 185.000 bytes de JavaScript inicial.
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
2. Confirmar a geração de 25 capturas em `artifacts/visual-audit`: cinco telas em cinco resoluções.
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
