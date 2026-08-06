# Homologação — v6.36.1

## Fluxos prioritários do Portal

1. Entrar como Administrador e confirmar que o Dashboard e a Tesouraria carregam normalmente.
2. Criar ou editar uma movimentação sem anexo e confirmar que a publicação anterior continua funcionando.
3. Em **Tesouraria → Movimentações**, selecionar **Programados** e confirmar as somas de entradas previstas, saídas previstas e resultado programado.
4. Confirmar que o resumo informa que os valores programados ainda não alteram o saldo atual e que a seção de realizados fica oculta nesse filtro.
5. Confirmar as situações Ativo, Mútua e Inativo no cadastro.
6. Usar o filtro Mutuários e confirmar que somente esses registros são exibidos.
7. Abrir Mensalidades e confirmar que o Mutuário não aparece.
8. Criar um grupo de Mútuas e confirmar que ele nasce ativo, sem data de baixa e sem cobranças automáticas.
9. Expandir um grupo sem falecimentos e confirmar que a visualização inicial é **Participantes**, sem lista de cobranças vazia.
10. Alternar entre as abas **Cobranças** e **Participantes** e confirmar que as duas listas nunca aparecem simultaneamente.
11. Registrar um falecimento e confirmar que uma cobrança única é criada para cada participante ativo na data do evento.
12. Confirmar que, após o registro, o grupo permanece expandido na aba **Cobranças**, sem repetir a lista completa de participantes acima das cobranças.
13. Expandir o cartão do falecimento e confirmar que o nome, a data, os totais e os participantes cobrados são apresentados no contexto do evento.
14. Usar **Selecionar pendentes deste evento** e confirmar que apenas as cobranças abertas daquele falecimento são marcadas.
15. Abrir a baixa das cobranças e confirmar que os participantes estão agrupados por evento, com grupo e data apresentados uma única vez.
16. Abrir “Registrar falecimento” após rolar outro modal e confirmar que o formulário inicia no topo, sem desalinhamento de avatar, nome ou selo.
17. Repetir o fluxo em desktop, tablet e celular, verificando rolagem, rodapé do modal, espaçamentos e ausência de sobreposição.
18. Encerrar um grupo apenas após informar data e motivo de baixa.
19. Clicar em Sair e confirmar o retorno ao Dashboard em modo visitante, sem erro no console.

## Homologação do Cloudflare R2

1. Entrar como Administrador, redefinir e publicar a senha da Diretoria para o padrão compatível com o Worker.

Execute esta seção somente depois de publicar o Worker e salvar sua URL em Configurações.

1. Em **Configurações → Armazenamento privado de anexos**, testar a conexão com o Worker.
2. Criar uma movimentação com imagem e PDF dentro dos limites permitidos.
3. Publicar e confirmar que a sincronização conclui sem inserir Base64 em `data/dados.json`.
4. Expandir a movimentação e testar **Visualizar** e **Baixar**.
5. Sair, entrar como Diretoria e confirmar que os anexos podem ser consultados.
6. Sair para o modo Visitante e confirmar que os documentos não ficam acessíveis pela interface.
7. Caso existam anexos antigos, confirmar que foram removidos de `public/treasury/` depois da primeira publicação.
8. No painel R2, confirmar que os objetos estão em `treasury/<movimentacao>/...` e que o bucket continua privado.
9. Interromper propositalmente uma publicação de homologação antes do commit e confirmar que o estado oficial não aponta para arquivos incompletos.
10. Fechar ou minimizar o progresso da sincronização e confirmar que o envio continua em segundo plano.

## Regressões

- Associados ativos continuam participando das Mensalidades e podem participar das Mútuas.
- Associados inativos não participam de novas cobranças.
- Pagamentos e vínculos históricos permanecem preservados.
- Diretoria continua em modo de consulta e Configurações permanece exclusiva do Administrador.
- Fotos institucionais e de associados continuam públicas conforme a arquitetura atual.
- Sem Worker configurado, o Portal permanece utilizável, mas anexos financeiros ainda seguem o fluxo legado até a ativação.


## Dashboard autenticado

- Validar os quatro cards de resumo em Administrador e Diretoria.
- Confirmar que nomes e títulos longos não sobrepõem os controles.
- Conferir a disposição 7/5 de compromissos e avisos em telas amplas.
- Conferir empilhamento em tablet e celular.
- Validar barras de progresso de Mensalidades e Mútuas com leitor de tela.


## Versão 6.29.0

Antes da homologação funcional, publique o Worker atualizado e execute a migração descrita em `docs/private-data-migration.md`.


## Pipeline de release — versão 6.36.1

1. Execute `npm run release:build`.
2. Confirme que a pasta `dist` contém os três ZIPs e `checksums.sha256`.
3. Execute `npm run release:dist:verify` e confirme a validação dos artefatos.
4. Publique somente o conteúdo de `portal-site-v6.36.1.zip` no GitHub Pages.
5. Atualize o Worker primeiro com o pacote `cloudflare-worker-v1.2.0.zip` quando houver alteração no Worker.


## GitHub Actions — versão 6.36.1

1. Envie a pasta `.github/workflows` ao repositório.
2. Na aba **Actions**, confirme a execução de **Qualidade do Portal**.
3. Confirme que os trabalhos do Portal e do Worker foram aprovados.
4. Execute manualmente **Pacotes de release** e baixe o artefato gerado.
5. Compare `checksums.sha256` com os ZIPs antes da publicação.
6. Confirme que nenhuma execução solicitou token do Portal, segredo do Worker ou permissão de escrita.
7. Depois da primeira execução, configure a proteção da branch conforme `docs/github-actions.md`.
