# Homologação — v6.28.0

> Procedimento de validação do redesign, da Tesouraria e da responsividade do Portal 6.28.0.

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
