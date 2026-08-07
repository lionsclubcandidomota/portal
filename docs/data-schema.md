# Esquema de dados do Portal — v9

O esquema v9 adiciona anexos às movimentações financeiras. A distinção entre Associados, Mutuários e registros inativos introduzida no esquema v8 permanece inalterada.

```json
{
  "app": "Lions Clube de Cândido Mota Dashboard",
  "schemaVersion": 9,
  "version": 9,
  "data": {
    "birthdays": [
      {
        "id": "b_associado",
        "name": "Associado de exemplo",
        "status": "Ativo",
        "active": true
      },
      {
        "id": "b_mutuario",
        "name": "Mutuário de exemplo",
        "status": "Mútua",
        "active": true
      }
    ],
    "treasury": [
      {
        "id": "t_exemplo",
        "date": "2026-08-04",
        "description": "Pagamento de fornecedor",
        "entry": 0,
        "exit": 100,
        "attachments": [
          {
            "id": "att_exemplo",
            "name": "comprovante.pdf",
            "type": "application/pdf",
            "size": 84231,
            "originalSize": 84231,
            "optimized": false,
            "url": "./public/treasury/t_exemplo/att_exemplo-hash.pdf"
          }
        ]
      }
    ]
  }
}
```

## Anexos financeiros

- Cada movimentação aceita até cinco anexos.
- Enquanto a alteração estiver pendente, o arquivo pode permanecer como `dataUrl` no estado local.
- Após a publicação, o JSON guarda somente uma referência em `./public/treasury/<movimentacao>/...`.
- Imagens JPEG, PNG e WebP são redimensionadas e recomprimidas no navegador antes de serem salvas.
- GIFs, PDFs e documentos compatíveis são preservados para não comprometer a legibilidade.
- O portal aceita apenas os tipos definidos pelo módulo `treasury-admin/attachments.js` e rejeita caminhos ou Data URLs incompatíveis.
- A revisão da publicação mostra somente quantidade e nomes dos anexos; o conteúdo Base64 não é exibido no histórico.

## Situações das pessoas

- `Ativo`: Associado ativo. Participa das Mensalidades e pode participar das Mútuas.
- `Mútua`: Mutuário. Não é associado, não paga Mensalidades e pode participar das Mútuas.
- `Inativo`: não entra em novas cobranças ou novos grupos.

O campo legado `active` é mantido por compatibilidade. Ele é `false` somente para a situação Inativo. As regras de negócio devem consultar as funções de `assets/js/core/portal-members.js`, e não apenas esse booleano.

## Regras das Mútuas

- O grupo define um valor mensal integral por participante.
- Associados ativos e Mutuários podem ser vinculados aos grupos.
- Cada participante gera uma cobrança individual por competência.
- Remoções interrompem competências futuras e preservam o histórico.
- Pagamentos são registrados como entradas individuais na Tesouraria.

## Migração

- Arquivos v8 recebem a coleção `attachments` vazia em cada movimentação.
- Cadastros antigos com `active: false` são migrados para `status: "Inativo"`.
- Cadastros antigos sem situação são migrados para `status: "Ativo"`.
- Valores Mutuário, Mutuária ou Mútua são normalizados para `status: "Mútua"`.
- Backups dos esquemas anteriores continuam aceitos e são migrados antes do uso.
- Arquivos com esquema superior ao v9 são bloqueados para evitar perda de dados.
