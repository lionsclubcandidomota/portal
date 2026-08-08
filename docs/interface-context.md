# Preservação de contexto da interface

A v6.38.0 introduz um controlador central para impedir que novas renderizações interrompam o trabalho do usuário.

## Contexto registrado

Antes de uma atualização da tela, o Portal pode registrar:

- tela atualmente aberta;
- seção ativa da Tesouraria;
- posição horizontal e vertical da rolagem;
- campo em foco;
- intervalo selecionado em campos de texto.

## Restauração

A restauração ocorre após duas etapas de renderização do navegador. Isso permite que o novo conteúdo tenha suas dimensões calculadas antes de reposicionar a página. A rolagem é limitada ao tamanho atual do documento e o foco só retorna quando o elemento ainda existe e está habilitado.

## Uso

O controlador é aplicado em:

- atualização manual e remota do Portal;
- salvamento e nova renderização da tela de Ajustes;
- troca ou restauração do logotipo;
- configuração do acesso da Diretoria;
- nova renderização da tela atualmente aberta.

Uma navegação voluntária para outra página continua iniciando no topo. A preservação só atua quando o usuário permanece no mesmo contexto de trabalho.
