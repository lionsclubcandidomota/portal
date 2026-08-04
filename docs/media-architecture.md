# Arquitetura de mídia e anexos do Portal

## Objetivo

Manter imagens institucionais e fotos públicas no site estático, mas retirar comprovantes, recibos, notas fiscais e documentos financeiros da publicação pública.

## Separação adotada

```text
GitHub Pages
├── HTML, CSS e JavaScript
├── data/dados.json
├── public/branding/
└── public/members/

Cloudflare Worker
├── autentica Administrador ou Diretoria
├── valida formato e tamanho
├── grava e lê objetos pelo binding R2
└── emite links temporários assinados

Cloudflare R2 privado
└── treasury/<id-da-movimentacao>/<id-do-anexo>-<hash>.<ext>
```

O bucket não utiliza domínio público, `r2.dev` ou credenciais no navegador.

## Referência publicada

```json
{
  "photo": "./public/members/b_123-0abc123.jpg",
  "attachments": [
    {
      "id": "att_123",
      "name": "comprovante.pdf",
      "type": "application/pdf",
      "size": 84231,
      "storage": "r2",
      "objectKey": "treasury/t_123/att_123-0abc1234.pdf",
      "checksum": "0abc1234...",
      "uploadedAt": "2026-08-04T12:00:00.000Z"
    }
  ]
}
```

O JSON não contém o arquivo em Base64, URL pública permanente, chave R2 ou segredo do Worker.

## Fluxo de edição e publicação

1. O arquivo selecionado é validado pelo navegador.
2. Imagens compatíveis são redimensionadas e recomprimidas; PDFs e documentos são preservados.
3. O arquivo permanece incorporado somente enquanto a alteração estiver pendente no navegador.
4. A revisão da publicação mostra nomes e quantidades, sem expor o conteúdo.
5. O Portal cria uma sessão curta no Worker usando a credencial já informada no login.
6. O Worker valida novamente o arquivo e o grava no R2 pelo binding `ATTACHMENTS`.
7. O Portal publica no GitHub apenas o JSON com os metadados e `objectKey`.
8. Depois do commit confirmado, o estado local troca o conteúdo incorporado pela referência privada.

Se o commit no GitHub falhar, o Portal solicita a remoção dos objetos enviados naquela tentativa para evitar arquivos órfãos.

## Visualização e download

1. Administrador ou Diretoria seleciona **Visualizar** ou **Baixar**.
2. O Portal pede autorização ao Worker usando a sessão mantida somente em memória.
3. O Worker verifica o perfil e assina um ticket de curta duração.
4. O navegador abre uma rota temporária do Worker.
5. O Worker lê o objeto privado do R2 e transmite o arquivo com `Cache-Control: private, no-store`.

Visitantes não recebem sessão e não conseguem solicitar tickets.

## Limites operacionais

- até 5 anexos por movimentação;
- até 5 MB no arquivo originalmente selecionado;
- até 1,25 MB por anexo depois do processamento;
- até 3,2 MB armazenados por movimentação;
- imagens limitadas a 1.800 px no maior lado e alvo aproximado de 900 KB;
- exclusão em lotes limitados pelo Worker.

As verificações existem tanto no navegador quanto no Worker. As validações do navegador melhoram o feedback; as do Worker aplicam a regra de segurança.

## Migração dos anexos públicos antigos

Ao ativar o Worker em **Configurações → Armazenamento privado de anexos**, a primeira publicação:

1. identifica referências em `public/treasury/`;
2. busca cada arquivo antigo;
3. envia o conteúdo ao R2;
4. publica os novos metadados;
5. inclui a exclusão dos arquivos públicos antigos na árvore do mesmo commit.

Até essa primeira publicação ser concluída, os anexos antigos continuam públicos. A separação de segurança só está completa depois da migração e da confirmação de que `public/treasury/` não contém mais documentos financeiros.

## Mídias que permanecem públicas

Fotos de associados e imagens institucionais continuam em `public/members/` e `public/branding/`, pois fazem parte da apresentação pública atual. Caso futuramente precisem de privacidade, devem receber um fluxo de autorização próprio em vez de reutilizar URLs públicas.
