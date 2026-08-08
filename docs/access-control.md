# Usuários, cargos e Ano Leonístico — v6.44.0

## Perfis de entrada

O Portal possui três formas de entrada:

- **Administrador:** acesso integral e publicação no GitHub.
- **Usuário:** nome de usuário e senha individual; permissões derivadas do cargo vigente.
- **Diretoria:** senha global de consulta, sem edição.

## Cargos e designações

Os cargos continuam definidos em `accessRoles`. O vínculo entre associado e cargo passa a ser registrado em `leadershipAssignments`, sempre com:

- associado;
- cargo;
- Ano Leonístico;
- data inicial e final;
- situação válida ou desativada;
- observação opcional.

O Ano Leonístico começa em 1º de julho e termina em 30 de junho do ano seguinte.

## Permissões automáticas

Um usuário individual só recebe as permissões quando existe uma designação válida para a data atual. Ao terminar o período:

- o cargo anterior permanece no histórico;
- as permissões deixam de ser concedidas automaticamente;
- o usuário não entra até receber uma nova designação vigente;
- uma designação futura passa a valer quando a data inicial chegar.

Ao trocar o cargo atual pelo cadastro do usuário, o Portal encerra o registro anterior no dia anterior e cria um novo registro, sem apagar o histórico.

## Fluxo recomendado

1. Publicar a v6.44.0 e confirmar o esquema 12.
2. Entrar como Administrador.
3. Abrir **Área administrativa → Usuários e cargos**.
4. Revisar cargos e permissões.
5. Criar ou editar o usuário.
6. Registrar o cargo vigente e a data inicial.
7. Conferir o histórico por Ano Leonístico.
8. Publicar as mudanças.

## Compatibilidade

Na migração do esquema 11, cada usuário existente recebe uma designação no Ano Leonístico atual usando o cargo que já possuía. Associados, Tesouraria, mensalidades, Mútuas, agenda, avisos e imagens não são alterados.

## Segurança

O Portal continua estático no GitHub Pages. As senhas são armazenadas como derivação PBKDF2-SHA-256, mas os hashes fazem parte dos dados publicados. Use senhas fortes, exclusivas e diferentes de outras contas.

## Área pública Dirigentes

A área pública usa apenas o cargo vigente, o nome e a fotografia do associado. Credenciais e permissões continuam restritas à área administrativa.
