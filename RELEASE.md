# Release 6.35.0

Esta versão altera o funcionamento das Mútuas para refletir a regra real do distrito: **não existe mensalidade fixa nem recorrência automática**.

## Nova regra

1. O Administrador cria um grupo de mutuários ativo, sem data de baixa.
2. Participantes podem entrar ou sair do grupo sem gerar cobranças.
3. Quando ocorre o falecimento de um associado do distrito, o Administrador registra um evento.
4. O evento congela os participantes ativos naquela data e gera uma cobrança única para cada um.
5. A baixa financeira permanece individual e vinculada ao evento.
6. O grupo só recebe data de baixa quando houver encerramento real, acompanhado de motivo obrigatório.

## Migração

O esquema passa para v11. Grupos antigos preservam nome, participantes, data de criação e observações, mas os campos `monthlyAmount`, `startedMonth` e `amountHistory` deixam de gerar cobranças. Nenhum evento retroativo é criado automaticamente.

## Publicação

Atualize o repositório com `portal-main-v6.35.0.zip` ou publique apenas o site com `portal-site-v6.35.0.zip`. O Cloudflare Worker permanece na versão 1.2.0 e não precisa ser republicado.
