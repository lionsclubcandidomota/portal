# Esquema de dados do Portal — v11

O esquema v11, a partir do Portal 6.35.0, separa todo o domínio financeiro do conteúdo público. Com o armazenamento seguro ativado, movimentações, contas, grupos, valores de mensalidade, perfil completo da Diretoria e anexos ficam em um bucket Cloudflare R2 privado. O JSON publicado contém somente os módulos destinados aos visitantes e metadados públicos de acesso.

A distinção entre Associados, Mutuários e registros inativos permanece inalterada.

```json
{
  "app": "Lions Clube de Cândido Mota Dashboard",
  "schemaVersion": 11,
  "version": 11,
  "data": {
    "settings": {
      "secureStorage": {
        "version": 1,
        "enabled": true,
        "workerUrl": "https://lions-portal-anexos.exemplo.workers.dev"
      }
    },
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
            "storage": "r2",
            "objectKey": "treasury/t_exemplo/att_exemplo-a1b2c3d4e5f60708.pdf",
            "checksum": "a1b2c3d4e5f60708...",
            "uploadedAt": "2026-08-04T12:00:00.000Z"
          }
        ]
      }
    ]
  }
}
```

## Configuração do armazenamento seguro

- `enabled`: ativa o fluxo privado de anexos.
- `workerUrl`: URL pública do Cloudflare Worker, nunca uma chave ou credencial do R2.
- O navegador não armazena chave de acesso, segredo do bucket ou token permanente do Worker.
- O Worker recebe acesso ao bucket por binding e entrega apenas sessões e links temporários.

## Anexos financeiros

- Cada movimentação aceita até cinco anexos.
- Enquanto a alteração estiver pendente, o arquivo pode permanecer como `dataUrl` somente no estado local.
- Após a publicação segura, o JSON guarda `storage: "r2"` e `objectKey`; não guarda Base64 nem URL pública permanente.
- Imagens JPEG, PNG e WebP são redimensionadas e recomprimidas no navegador antes do envio.
- GIFs, PDFs e documentos compatíveis são preservados para não comprometer a legibilidade.
- O Worker repete a validação de formato e tamanho antes de gravar no R2.
- A revisão da publicação mostra somente quantidade e nomes dos anexos; o conteúdo não é exibido no histórico.

## Compatibilidade temporária

Referências antigas em `./public/treasury/...` continuam legíveis antes da ativação do R2. Na primeira publicação com o armazenamento seguro configurado:

1. o Portal carrega cada anexo público antigo;
2. envia o conteúdo ao Worker;
3. troca a referência pública pelo `objectKey` privado;
4. publica o JSON atualizado;
5. remove os arquivos antigos de `public/treasury/` no mesmo commit.

Se a publicação no GitHub falhar, os objetos recém-enviados ao R2 são removidos e os dados oficiais permanecem inalterados.

## Situações das pessoas

- `Ativo`: Associado ativo. Participa das Mensalidades e pode participar das Mútuas.
- `Mútua`: Mutuário. Não é associado, não paga Mensalidades e pode participar das Mútuas.
- `Inativo`: não entra em novas cobranças ou novos grupos.

O campo legado `active` é mantido por compatibilidade. Ele é `false` somente para a situação Inativo. As regras de negócio devem consultar as funções de `assets/js/core/portal-members.js`, e não apenas esse booleano.

## Regras das Mútuas

- Grupos não possuem mensalidade fixa.
- O grupo é criado ativo, com `closedDate` vazio.
- `closedDate` e `closureReason` só são preenchidos quando houver encerramento real.
- A coleção `events` do grupo registra cada falecimento.
- Cada evento possui `deathDate`, `deceasedName`, `amountPerParticipant` e uma lista congelada em `participantIds`.
- As cobranças existem somente para participantes de um evento registrado.
- Pagamentos usam `mutualGroupId`, `mutualEventId`, `mutualMemberId` e `mutualChargeKey`.
- A chave de cobrança segue `grupo::evento::participante`.
- A migração v10→v11 remove a recorrência mensal legada e não cria eventos retroativos.


## Persistência D1 — esquema 1

O estado privado possui duas representações gravadas atomicamente:

- `portal_state_snapshot`: snapshot canônico que preserva exatamente o contrato JSON atual e o checksum;
- projeções relacionais: configurações, contas, categorias, movimentações, anexos, grupos familiares e mútuas.

Cada entidade relacional mantém também um `payload` JSON validado para preservar campos já existentes e permitir evolução compatível. Colunas indexadas atendem consultas por data, situação, conta, categoria e vínculos de mútuas. O snapshot é usado para manter compatibilidade com o frontend durante esta primeira fase; as projeções permitem evoluir posteriormente para endpoints granulares sem nova migração de dados.
