# Portal Lions — versão pública para GitHub Pages

Esta edição foi separada da aplicação interna e contém somente o conteúdo destinado a visitantes.

## Páginas disponíveis

- Início
- Aniversários
- Dirigentes e histórico dos Anos Leonísticos
- Agenda (eventos e reuniões)
- Avisos

## O que foi removido

Não fazem parte desta versão: autenticação, usuários e permissões, área administrativa, configurações internas, tesouraria, mensalidades, mútuas, grupos familiares, anexos financeiros, auditoria, recuperação, importação/exportação e sincronização administrativa com GitHub.

O arquivo `data/dados.json` também foi reduzido a uma estrutura pública. Nos aniversários não são publicados número do associado nem ano de nascimento; somente nome, dia/mês e foto pública.

## Publicação

O workflow `.github/workflows/pages.yml` continua publicando automaticamente no GitHub Pages quando houver `push` na branch `main`.

## Validação local

```bash
npm test
```


## Revisão 1.0.1

- Corrigida a renderização dos ícones SVG de navegação e ações.
- Mantida a validação automática para impedir referências a ícones inexistentes.
