# Release 6.34.2

Esta versão corrige a sincronização do manifesto de integridade quando uma publicação é feita diretamente pelo Portal.

## Correção

Nas versões anteriores, o Portal atualizava `data/dados.json` e os arquivos de mídia em um commit, mas mantinha o `release-manifest.json` com os hashes da publicação anterior. O GitHub Actions detectava corretamente a divergência e interrompia o trabalho de qualidade.

Agora o mesmo commit contém:

1. o JSON público sanitizado;
2. as mídias incluídas ou removidas;
3. o manifesto recalculado para todos os arquivos alterados.

O manifesto preserva os hashes dos arquivos estáticos, atualiza o SHA-256 e o tamanho do JSON público, adiciona novas fotos e remove referências de arquivos excluídos.

## Concorrência

A publicação passa a consultar `data/dados.json` e `release-manifest.json` na mesma revisão da branch. Caso outro commit seja enviado durante a operação, a atualização da branch é recusada sem sobrescrever o trabalho remoto.

## Dados privados

A fronteira introduzida na versão 6.34.1 permanece ativa. Tesouraria, contas, grupos, mensalidades e credenciais derivadas continuam exclusivamente no Cloudflare R2.

## Worker

O Cloudflare Worker permanece na versão 1.2.0 e não precisa ser republicado.

## Publicação

Substitua o repositório pelo conteúdo de `portal-main-v6.34.2.zip`, incluindo obrigatoriamente `data/dados.json` e `release-manifest.json`. Para atualizar somente os arquivos públicos do site, use `portal-site-v6.34.2.zip`.
