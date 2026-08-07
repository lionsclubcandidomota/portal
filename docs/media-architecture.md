# Arquitetura de mídia e anexos do Portal

## Objetivo

Retirar imagens e documentos Base64 do arquivo principal de dados sem perder compatibilidade com cadastros, movimentações e backups antigos.

## Estrutura

```text
public/
├── branding/
│   └── club-logo-<hash>.<ext>
├── members/
│   └── <id-do-associado>-<hash>.<ext>
└── treasury/
    └── <id-da-movimentacao>/
        └── <id-do-anexo>-<hash>.<ext>
```

O JSON guarda somente referências públicas:

```json
{
  "photo": "./public/members/b_123-0abc123.jpg",
  "attachments": [
    {
      "name": "comprovante.pdf",
      "url": "./public/treasury/t_123/att_123-0abc123.pdf"
    }
  ]
}
```

O hash é derivado do conteúdo. Uma nova versão recebe outro caminho, evitando reutilização indevida do cache.

## Fluxo de edição

1. A imagem ou documento selecionado é validado antes de entrar no cadastro.
2. Imagens compatíveis são redimensionadas e recomprimidas no navegador; PDFs e documentos são preservados.
3. O arquivo permanece como Data URL enquanto a alteração estiver pendente.
4. A revisão da publicação resume os nomes dos anexos sem expor o conteúdo Base64.
5. Ao publicar, `preparePortalMediaForPublication()` cria os ativos e uma cópia do estado com referências externas.
6. O GitHub recebe anexos, imagens e JSON em um único commit.
7. Somente após o commit ser confirmado o estado local troca o Base64 pelo caminho público.

Se a publicação falhar, o estado local mantém os arquivos incorporados e o usuário pode tentar novamente sem selecioná-los outra vez.

## Limites operacionais

- até 5 anexos por movimentação;
- até 5 MB no arquivo originalmente selecionado;
- até 1,25 MB por anexo depois do processamento;
- até 3,2 MB armazenados por movimentação;
- imagens limitadas a 1.800 px no maior lado e alvo aproximado de 900 KB.

Esses limites protegem o armazenamento local utilizado antes da publicação. Caso o navegador não consiga persistir o estado, a movimentação é revertida e o usuário recebe uma mensagem clara.

## Publicação atômica

`assets/js/github.js` usa a API Git do GitHub:

1. verifica se `data/dados.json` ainda possui o SHA esperado;
2. lê o commit e a árvore atuais da branch;
3. cria blobs para anexos, imagens e JSON;
4. cria uma nova árvore baseada na árvore atual;
5. cria um único commit;
6. atualiza a referência da branch sem `force`.

Assim, o JSON nunca é publicado apontando para um arquivo ausente.

## Migração dos arquivos oficiais

Execute:

```bash
npm run migrate:media
```

O comando é idempotente: extrai Data URLs presentes em `data/dados.json` e `data/modelo.json`, grava os arquivos correspondentes e atualiza o envelope para o esquema atual.
