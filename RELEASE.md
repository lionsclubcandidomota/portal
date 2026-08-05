# Release 6.36.0

Esta versão reorganiza o fluxo de Mútuas para separar claramente **grupo**, **falecimento** e **cobranças**.

## Experiência de uso

- Cada grupo possui duas visualizações exclusivas:
  - **Cobranças**, com os eventos de falecimento e seus recebimentos;
  - **Participantes**, com a composição atual usada nos próximos eventos.
- As duas listas não aparecem mais simultaneamente, evitando a sensação de associados duplicados.
- Grupos sem falecimentos abrem diretamente em Participantes.
- Depois de registrar um falecimento, o Portal abre a visualização Cobranças.
- Cada falecimento é um cartão expansível, com resumo de pendências, pagamentos e valor previsto.
- As linhas de cobrança mostram apenas participante, situação e valor; o contexto do grupo e do falecimento fica no cabeçalho.
- O modal de baixa agrupa as pessoas pelo falecimento, sem repetir a mesma descrição em todas as linhas.

## Formulários

- O registro de falecimento utiliza uma área para os dados e outra para conferir os participantes.
- O resumo informa quantas cobranças serão geradas e o total previsto.
- A baixa utiliza uma área de revisão e outra para data, conta e observações.
- Os dois modais mantêm ações fixas e comportamento responsivo.

## Publicação

Atualize o repositório com `portal-main-v6.36.0.zip` ou publique apenas o site com `portal-site-v6.36.0.zip`.

O Cloudflare Worker permanece na versão 1.2.0 e não precisa ser republicado.
