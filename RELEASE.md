# Portal Lions v6.44.1

## Correção de estabilidade

O ciclo funcional anterior permanece concluído na **Etapa 8 de 8**. Esta versão é uma correção pós-homologação.

A v6.44.1 corrige duas regressões encontradas depois da publicação da v6.44.0. Não há migração de dados nem mudança no esquema.

### Tesouraria e Ajustes

A navegação recebia um resumo da sessão com a propriedade `role`, enquanto a verificação de rotas procurava apenas `accessRole`. Como resultado, as telas restritas eram interpretadas como acesso de visitante e redirecionadas para a Área administrativa.

A política agora reconhece os dois formatos usados internamente e preserva as permissões corretas:

- Administrador: Tesouraria, Ajustes e Área administrativa;
- Diretoria: Tesouraria em consulta e Área administrativa;
- usuários individuais: conforme as permissões do cargo vigente.

### Ano Leonístico

O campo possuía uma expressão de validação escrita dentro de uma string JavaScript. A barra invertida era consumida antes de chegar ao HTML, fazendo o navegador validar literalmente `dddd/dddd`.

O campo agora utiliza o padrão HTML seguro `[0-9]{4}/[0-9]{4}` e aceita normalmente valores como `2026/2027`.

### Compatibilidade

- versão do Portal: 6.44.1;
- esquema dos dados: 12;
- nenhuma coleção é criada, removida ou regravada;
- o pacote incremental não inclui `data` nem `public`;
- a atualização de versão dos módulos força a renovação do cache do navegador.
