# Bootstrap privado reduzido no D1

## Objetivo

Evitar que o login administrativo transfira todas as movimentações financeiras para o navegador. O D1 permanece como fonte relacional e cada tela carrega seu recorte por endpoint operacional.

## Conteúdo do conjunto inicial

O bootstrap inclui dados necessários para montar formulários e validar operações:

- configurações privadas;
- contas e categorias;
- grupos familiares;
- grupos de Mútuas, vínculos, eventos e participantes;
- pagamentos de Mensalidades;
- pagamentos de Mútuas.

Movimentações ordinárias entram no estado de sessão somente quando aparecem na paginação operacional.

## Hidratação sob demanda

Ao consultar `GET /api/operational/treasury`, os registros da página atual são incorporados ao estado de sessão e à linha de base sincronizada. Isso permite editar ou excluir um item visível sem considerar os registros não carregados como excluídos.

## Referências privadas

Configurações, contas e categorias usam `PUT /api/private-state/reference`. A rota substitui apenas essas três projeções e preserva todas as demais tabelas.

## Contingência

- esquema anterior ao 7: o Worker retorna o estado completo;
- indisponibilidade do bootstrap: o Portal tenta a rota privada completa;
- modo reduzido: sincronização completa automática é bloqueada para impedir substituição parcial;
- importação e restauração: continuam materializando um estado completo validado.
