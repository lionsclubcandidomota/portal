# Portal Lions 6.28.0

## Interface mais simples e responsiva

Esta versão moderniza toda a apresentação do Portal sem alterar os dados nem os fluxos de negócio existentes. A navegação, os cards, formulários, tabelas, modais e telas administrativas receberam uma linguagem visual mais limpa, com melhor hierarquia, contraste, espaçamento e adaptação para notebooks, tablets e celulares.

### Correções

- O filtro **Programados** da Tesouraria agora recalcula entradas, saídas, resultado e quantidade usando somente os lançamentos programados exibidos.
- Os filtros **Realizados**, **Entradas** e **Saídas** continuam recalculando os totais conforme o conteúdo filtrado.
- O card **Agenda** do Dashboard foi reestruturado para impedir sobreposição em larguras reduzidas.
- Títulos longos, locais, links de reuniões e indicadores passam a quebrar linha de forma segura.

### Redesign

- Navegação e textos mais curtos e amigáveis.
- Cards mais leves, bordas suaves e sombras discretas.
- Melhor uso de espaços em branco e tipografia mais clara.
- Filtros, botões e campos padronizados em todas as telas.
- Dashboard e Tesouraria com menos ruído visual.
- Modais e navegação móvel mais confortáveis.

## Dados

- Esquema: 10.
- Nenhuma migração de banco de dados.
- Nenhuma alteração automática em Tesouraria, Mútuas, mensalidades, associados, fotos, eventos ou avisos.
- A atualização segura não inclui `data/dados.json` nem a pasta `public`.
