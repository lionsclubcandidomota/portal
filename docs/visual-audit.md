# Auditoria visual — v6.44.0

## Cobertura

A auditoria percorre automaticamente seis telas — Início, Agenda, Aniversariantes, Dirigentes, Avisos e Área administrativa — nas larguras de 360, 390, 768, 1024 e 1366 pixels.

Cada execução pode gerar até 30 imagens PNG em `artifacts/visual-audit`, além de `report.json` com as medições estruturadas.

## Comandos

- `npm run audit:visual`: executa quando Chrome ou Chromium estiver disponível; informa e encerra sem erro quando o navegador não puder ser usado.
- `npm run audit:visual:required`: torna o navegador e a conclusão da auditoria obrigatórios.

## Falhas detectadas

A execução falha quando encontra:

- rolagem horizontal inesperada no documento ou conteúdo principal;
- elementos fora da área útil, exceto dentro de contêineres com rolagem horizontal intencional;
- compromissos ultrapassando o card do Dashboard;
- cartões de dirigentes ultrapassando a grade pública;
- título do cabeçalho cortado;
- itens da navegação móvel menores que o limite seguro;
- rótulos do menu lateral truncados;
- estado de carregamento que não foi concluído.

## Uso no release

`INICIAR-HOMOLOGACAO.bat` executa a homologação integrada antes de abrir o Portal. A auditoria visual permanece separada para a estação com navegador compatível. Na estação oficial de homologação, execute também o modo `required` para que a indisponibilidade do navegador seja tratada como falha.
