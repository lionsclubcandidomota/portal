# Sincronização automática por módulo no D1

A versão 6.46.0 adiciona revisões independentes para os módulos privados do Portal. O objetivo é detectar alterações feitas em outra sessão sem reconstruir o estado privado completo ou exigir atualização manual da página.

## Módulos acompanhados

- `reference`: configurações, contas e categorias;
- `groups`: grupos familiares e grupos de Mútuas;
- `treasury`: movimentações e anexos;
- `memberships`: pagamentos e visão operacional de Mensalidades;
- `mutuals`: eventos, cobranças e pagamentos de Mútuas;
- `member-directory`: projeção relacional dos associados públicos;
- `public`: configurações, associados, agenda, reuniões, avisos e mídias públicas.

Cada mutação granular incrementa somente as revisões relacionadas. Uma movimentação financeira, por exemplo, incrementa `treasury`, `memberships` e `mutuals`, mas não altera a revisão dos grupos.

## Rotas

```text
GET /api/sync/revisions
GET /api/operational/reference
GET /api/operational/groups
```

A primeira rota retorna apenas números de revisão e datas. As duas rotas seguintes são chamadas somente quando o módulo correspondente mudou.

## Política do navegador

O Portal consulta revisões:

- a cada 60 segundos;
- ao voltar para a aba;
- ao focar a janela;
- ao trocar de área da aplicação.

A aplicação não substitui o estado durante um formulário aberto, um salvamento privado ou uma alteração pública pendente. Nessas situações, a atualização é adiada para a próxima verificação.

## Atualização da interface

- Movimentações, Mensalidades e Mútuas: o cache operacional é invalidado e a tela consulta novamente o D1.
- Referências: configurações, contas e categorias são mescladas ao estado atual.
- Grupos: grupos familiares e de Mútuas são mesclados ao estado atual.
- A página inteira não é recarregada; somente a visão ativa é renderizada novamente quando necessário.

## Contingência

O botão de atualização manual continua disponível. Caso as rotas de revisão ainda não estejam ativas durante a implantação, o Portal mantém as consultas paginadas e o fluxo anterior sem interromper o uso.
