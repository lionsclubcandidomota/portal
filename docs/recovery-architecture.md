# Recuperação e continuidade operacional

A Fase 9 introduz pontos de recuperação locais, diagnóstico de integridade e restauração seletiva sem alterar o esquema público do portal.

## Estrutura

```text
assets/js/modules/
├── recovery-center.js
└── recovery-center/
    ├── controller.js
    ├── domain.js
    ├── storage.js
    └── view.js
```

- `domain.js`: criação, assinatura, validação, diagnóstico e mesclagem seletiva.
- `storage.js`: persistência assíncrona em IndexedDB, com fallback reduzido em `localStorage`.
- `controller.js`: coordenação da interface, criação, exclusão, exportação e restauração.
- `view.js`: HTML da Central de Recuperação e da seleção de áreas.

## Pontos automáticos

O runtime cria um ponto antes de operações que podem substituir ou consolidar dados:

- importação de backup;
- publicação no GitHub;
- descarte de alterações pendentes;
- recarga dos dados publicados;
- restauração de outro ponto.

A operação crítica é cancelada quando o navegador não consegue gravar a cópia de segurança. Pontos com o mesmo estado e motivo são deduplicados.

## Retenção e armazenamento

O portal mantém até 12 pontos no IndexedDB do navegador. Quando IndexedDB não está disponível, utiliza `localStorage` com retenção reduzida a quatro pontos.

Cada ponto contém:

- envelope de dados no esquema atual;
- data e motivo da criação;
- resumo quantitativo dos módulos;
- tamanho estimado;
- assinatura FNV-1a determinística do estado;
- metadados operacionais sem token ou senha de sessão.

Os pontos ficam somente no navegador administrativo e não são publicados no GitHub.

## Diagnóstico de integridade

A Central verifica:

- estrutura e versão do esquema;
- IDs ausentes ou duplicados;
- vínculos de grupos familiares;
- contas e categorias das movimentações;
- formato das datas;
- padrão das referências de mídia;
- presença de credenciais legadas nas configurações públicas.

Erros impedem a restauração de um ponto adulterado. Recomendações não bloqueiam o uso, mas ficam destacadas para manutenção.

## Restauração seletiva

É possível restaurar individualmente:

- configurações;
- associados;
- contas;
- categorias;
- grupos familiares;
- movimentações;
- agenda;
- compromissos;
- avisos.

As áreas não selecionadas permanecem intactas. A restauração entra no fluxo normal de alterações pendentes, histórico e publicação.
