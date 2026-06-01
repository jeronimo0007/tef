# TEF Stone - Lane 3600

Aplicação Node.js para comunicação com a pinpad **Stone Lane 3600** via Stone Connect API (Pagar.me v5).

## Como funciona

1. Você envia o valor e tipo de pagamento pela interface web ou API
2. A aplicação cria um pedido na API da Stone
3. A pinpad Lane 3600 recebe o pedido e exibe a tela de pagamento
4. O cliente passa/insere o cartão na pinpad
5. A aplicação consulta o status do pagamento

## Pré-requisitos

- Node.js >= 18
- Pinpad Stone Lane 3600 ativada e vinculada ao seu StoneCode
- **Secret Key** da Stone (gerada no portal Stone)

### Como gerar a Secret Key

1. Acesse o [portal Stone](https://www.stone.com.br/) na versão web
2. Vá em **Perfil > Chaves de Autenticação**
3. Clique em **Criar Chave**
4. Nomeie a chave e selecione **"Em um sistema TEF"**
5. Confirme o StoneCode e digite o PIN (6 dígitos)
6. Copie a Secret Key e guarde em local seguro

## Instalação

```bash
git clone https://github.com/jeronimo0007/tef.git
cd tef
npm install
cp .env.example .env
```

Edite o `.env` com suas credenciais:

```env
STONE_SECRET_KEY=sua_secret_key
STONE_CODE=seu_stonecode
DEVICE_SERIAL=serial_da_lane3600  # opcional
```

## Uso

```bash
npm start
```

Acesse **http://localhost:3000** para usar a interface web.

## API REST

### `GET /api/tef/status`

Verifica se o servidor e TEF estão online.

### `POST /api/tef/venda`

Cria um pedido e envia para a pinpad.

```json
{
  "tipo": "credito",
  "valor": "10.50",
  "parcelas": 3
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| tipo | string | Sim | `credito`, `debito`, `voucher` ou `pix` |
| valor | string | Sim | Valor em reais (ex: `"10.50"`) |
| parcelas | number | Não | Número de parcelas (crédito) |
| tipoParcelamento | string | Não | `merchant` (loja) ou `issuer` (emissor) |
| aguardar | boolean | Não | Se `true`, aguarda o pagamento na pinpad antes de responder |

**Resposta:**
```json
{
  "sucesso": true,
  "mensagem": "Pedido enviado para a pinpad. Aguardando pagamento.",
  "pedido": {
    "id": "or_XXXXXXXXXXXX",
    "code": "ABC123",
    "amount": 1050,
    "status": "pending",
    "tipo": "credit",
    "parcelas": 3
  }
}
```

### `GET /api/tef/pedido/:id`

Consulta o status de um pedido.

### `GET /api/tef/pedido/:id/aguardar`

Aguarda o pagamento de um pedido (polling até `paid`, `canceled` ou timeout).

### `POST /api/tef/pedido/:id/cancelar`

Cancela um pedido aberto.

### `GET /api/tef/pedidos`

Lista pedidos. Parâmetros opcionais: `status`, `page`, `size`.

## Arquitetura

```
tef/
├── public/
│   └── index.html          # Interface web
├── src/
│   ├── index.js             # Entry point — Express server
│   ├── logger.js            # Winston logger
│   ├── routes/
│   │   └── tef.js           # Rotas da API REST
│   └── tef/
│       ├── manager.js       # Camada de abstração TEF
│       └── stone-api.js     # Client da Stone Connect API (Pagar.me v5)
├── .env.example
├── .eslintrc.json
├── package.json
└── README.md
```

## Fluxo de Pagamento

```
App Node.js                     Stone API                    Pinpad Lane 3600
    │                               │                              │
    │── POST /orders ──────────────>│                              │
    │<── { id, status: pending } ───│                              │
    │                               │── Envia pedido ─────────────>│
    │                               │                              │── Exibe tela pagamento
    │                               │                              │── Cliente passa cartão
    │                               │<── Resultado ────────────────│
    │── GET /orders/:id ───────────>│                              │
    │<── { status: paid } ──────────│                              │
```

## Licença

ISC
