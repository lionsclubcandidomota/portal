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


## Revisão 1.0.2

- Aniversariantes do mês agora são ordenados com os próximos aniversários primeiro.
- Aniversários que já ocorreram no mês aparecem depois, do mais recente para o mais antigo.
- Para datas já passadas, o indicador mostra `Ontem` ou `Há X dias`, evitando exibir o próximo ano como se fosse a ordenação atual.




## Revisão 1.1.2 — Ajustes de desktop e avisos

- botão do menu lateral passou a funcionar também no desktop, com recolhimento/expansão da sidebar;
- sidebar ficou menos redundante, removendo o rótulo “Portal público” e substituindo o rodapé por uma mensagem institucional;
- banner inicial foi redesenhado com composição visual mais atraente usando o logo do Lions;
- selo lateral do banner deixou de repetir o nome completo do clube, priorizando uma mensagem institucional;
- página de Avisos agora separa “Avisos atuais” e “Histórico de avisos”, semelhante ao comportamento da Agenda;
- dashboard passou a mostrar comunicados recentes mesmo quando não houver aviso ativo no momento.

## Revisão 1.1.1 — Refinamento mobile

- cartões de aniversários compactados no celular;
- removida a data redundante de “Próxima data”;
- filtro de aniversários reorganizado para ocupar menos altura;
- nomes longos e selos de situação passam a se adaptar melhor a telas estreitas;
- dashboard mobile ganhou maior densidade, legibilidade e menos rolagem;
- navegação inferior passou a funcionar como barra ancorada, menos intrusiva sobre o conteúdo.

## Revisão 1.1.0 — Refatoração visual e responsiva

- Design system revisado com tipografia, espaçamentos, superfícies, bordas, sombras e estados consistentes.
- Início reorganizado com hero mais moderno, atalhos e três indicadores de acesso rápido.
- Sidebar e barra superior refinadas no desktop.
- Navegação inferior redesenhada para uso confortável em celulares, respeitando área segura do aparelho.
- Aniversários passam a usar cards dedicados no mobile, mantendo tabela no desktop.
- Agenda, calendário, dirigentes, avisos e modal receberam melhorias de hierarquia, leitura e áreas de toque.
- Modo escuro atualizado para manter contraste e consistência com a nova interface.
- Modal agora preserva e devolve o foco ao elemento de origem, melhorando a navegação por teclado.
- Mantida a estrutura pública de dados e a validação de privacidade existente.
