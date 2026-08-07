# Auditoria visual — v6.36.0

## Cobertura

A auditoria percorre automaticamente cinco telas — Início, Agenda, Aniversariantes, Avisos e Área administrativa — nas larguras de 360, 390, 768, 1024 e 1366 pixels.

Cada execução pode gerar até 25 imagens PNG em `artifacts/visual-audit`, além de `report.json` com as medições estruturadas.

## Comandos

- `npm run audit:visual`: executa quando Chrome ou Chromium estiver disponível; informa e encerra sem erro quando o navegador não puder ser usado.
- `npm run audit:visual:required`: torna o navegador e a conclusão da auditoria obrigatórios.

## Falhas detectadas

A execução falha quando encontra:

- rolagem horizontal inesperada no documento ou conteúdo principal;
- elementos fora da área útil, exceto dentro de contêineres com rolagem horizontal intencional;
- compromissos ultrapassando o card do Dashboard;
- título do cabeçalho cortado;
- itens da navegação móvel menores que o limite seguro;
- rótulos do menu lateral truncados;
- estado de carregamento que não foi concluído.

## Uso no release

`FINALIZAR-ATUALIZACAO.bat` executa a auditoria opcional antes de gerar o manifesto. Na estação oficial de homologação, execute também o modo `required` para que a indisponibilidade do navegador seja tratada como falha.
