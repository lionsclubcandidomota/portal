# Arquitetura de mídia e anexos do Portal

## Objetivo

Retirar imagens e documentos Base64 do arquivo principal de dados, manter os originais necessários e servir versões menores nas listas.

## Estrutura

```text
public/
├── branding/
│   └── club-logo-<hash>.<ext>
├── members/
│   ├── <id-do-associado>-<hash>.<ext>
│   └── thumbs/
│       ├── <id-do-associado>-<hash>-96.webp
│       └── <id-do-associado>-<hash>-192.webp
└── treasury/
    └── <id-da-movimentacao>/
        └── <id-do-anexo>-<hash>.<ext>
```

O JSON guarda somente a referência da foto original:

```json
{
  "photo": "./public/members/b_123-0abc123.jpg"
}
```

As referências das miniaturas são derivadas do caminho original. Não existe duplicação de campos no JSON.

## Exibição das fotos

Os avatares usam:

- `src` com o original como fallback;
- `srcset` com 96 e 192 px;
- `sizes="40px"`;
- `loading="lazy"`;
- `decoding="async"`;
- prioridade baixa de rede.

A arte de aniversário continua usando o original.

## Fluxo de edição e publicação

1. A imagem selecionada é validada e otimizada no navegador.
2. O arquivo permanece como Data URL enquanto a alteração estiver pendente.
3. Ao publicar, `preparePortalMediaForPublication()` cria o ativo original.
4. `createMemberPhotoThumbnailAssets()` gera as versões WebP de 96 e 192 px.
5. O GitHub recebe original, miniaturas e JSON no mesmo commit.
6. Somente depois da confirmação o estado local troca o Base64 pelo caminho público.

Se a publicação falhar, o estado local mantém a imagem incorporada e o usuário pode tentar novamente.

## Fallback

Quando uma miniatura não existe, o Portal remove o `srcset` e tenta a referência original. Esse comportamento preserva fotos antigas durante atualizações graduais.

## Auditoria

Execute:

```bash
npm run audit:media
```

Para exigir cobertura completa de todas as fotos:

```bash
npm run audit:media:required
```

A auditoria confere os arquivos referenciados, as duas miniaturas, os limites de tamanho e o template WebP da arte de aniversário.

## Limites operacionais dos anexos

- até 5 anexos por movimentação;
- até 5 MB no arquivo originalmente selecionado;
- até 1,25 MB por anexo depois do processamento;
- até 3,2 MB armazenados por movimentação;
- imagens de anexos limitadas a 1.800 px no maior lado e alvo aproximado de 900 KB.

## Publicação atômica

`assets/js/github.js` verifica o SHA atual, cria os blobs, monta uma única árvore, cria o commit e atualiza a branch sem `force`. O JSON nunca é publicado apontando para um arquivo preparado em outro commit.
