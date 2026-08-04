# Release 6.34.1

Esta versão corrige a serialização usada nas publicações feitas diretamente pelo Portal.

## Correção

O normalizador do esquema preenchia novamente as categorias financeiras padrão depois que o estado já havia sido sanitizado. Com isso, uma inclusão ou exclusão publicada pelo painel podia fazer o GitHub Actions bloquear `data/dados.json` como privado.

A publicação agora segue esta ordem obrigatória:

1. normaliza o estado completo;
2. cria o envelope público;
3. remove todas as coleções e configurações privadas;
4. verifica novamente o payload final;
5. somente então prepara o blob e o commit no GitHub.

A opção legada que permitia desativar a sanitização foi removida.

## Dados preservados

- Tesouraria, contas, grupos, mensalidades e credenciais derivadas continuam no R2.
- Aniversariantes, agenda, reuniões, avisos e configurações visuais permanecem no JSON público.
- O Worker 1.2.0 não foi alterado e não precisa ser republicado.

## Validação

- teste de regressão com tentativa explícita de publicar dados privados;
- auditoria de segurança do JSON público;
- testes, lint, CSS, acessibilidade e manifesto de release;
- geração determinística dos artefatos.

## Publicação

Substitua o repositório pelo conteúdo de `portal-main-v6.34.1.zip`, incluindo `data/dados.json` e `release-manifest.json`. Para o site, use `portal-site-v6.34.1.zip`.
