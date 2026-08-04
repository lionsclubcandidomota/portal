# Migração dos dados privados

A versão 6.29.0 separa os dados do Portal em dois destinos.

## GitHub Pages

Permanece público e recebe somente:

- identidade visual e URL do Worker;
- aniversariantes sem contatos privados;
- agenda, compromissos e avisos;
- indicador público de que o acesso da Diretoria está habilitado.

## Cloudflare R2

O Worker grava no objeto interno `__portal/private-state-v1.json`:

- contas e categorias da Tesouraria;
- movimentações e metadados de anexos;
- grupos familiares e de mútuas;
- valores das mensalidades;
- perfil completo de autenticação da Diretoria.

## Procedimento

1. Atualize e publique o Worker.
2. Atualize o Portal sem editar manualmente `data/dados.json`.
3. Entre como Administrador com o token do GitHub.
4. Publique a alteração de migração apresentada pelo Portal.
5. Saia e teste o acesso de Visitante e da Diretoria.

A migração preserva o JSON legado até a publicação ser confirmada. Não apague manualmente os dados financeiros antes dessa etapa.
