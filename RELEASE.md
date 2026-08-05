# Release 6.35.1

Esta versão corrige a interface de Mútuas introduzida na 6.35.0.

## Correções

- O modal **Registrar falecimento e gerar cobrança** passa a usar um layout próprio para os participantes.
- Avatar, nome, número e situação deixam de ocupar colunas incorretas.
- O modal abre sempre no topo, mesmo quando outro formulário havia sido fechado após rolagem.
- Em telas maiores, o formulário possui mais espaço e uma área de conteúdo rolável.
- Em telas menores, a lista e os campos passam para uma coluna sem sobreposição.
- Ao expandir um grupo na tela de Mútuas, os participantes ativos voltam a ser exibidos antes dos eventos de falecimento.
- Grupos sem eventos continuam mostrando seus associados e mutuários cadastrados.

## Publicação

Atualize o repositório com `portal-main-v6.35.1.zip` ou publique apenas o site com `portal-site-v6.35.1.zip`. O Cloudflare Worker permanece na versão 1.2.0 e não precisa ser republicado.
