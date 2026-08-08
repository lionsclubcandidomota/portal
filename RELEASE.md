# Portal Lions v6.46.4

> Atualização corretiva sobre a v6.46.3, concentrada na área de **Mútuas da Tesouraria** e no aproveitamento da largura da prévia de participantes por falecimento.

## Correção

- O resumo da quantidade de participantes agora ocupa toda a largura disponível.
- A lista de participantes deixa de ficar concentrada no lado esquerdo do painel.
- As duas colunas passam a dividir igualmente o espaço útil do formulário.
- Em telas de até 760 px, a lista permanece em uma coluna.
- A correção redefine explicitamente alinhamento e largura que eram herdados de uma regra antiga do componente.

## Dados e compatibilidade

- Esquema dos dados mantido na versão **12**.
- Nenhum grupo, participante, falecimento, cobrança, movimentação, usuário ou fotografia é alterado.
- Compatível com atualização incremental sobre a v6.46.3.

## Validação

- Teste de regressão ampliado para exigir largura integral e colunas flexíveis.
- Auditorias de módulos, integração, CSS, acessibilidade, segurança, desempenho, mídia, sintaxe e manifesto executadas pelo pipeline do projeto.
