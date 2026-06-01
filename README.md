# TEF Stone - Lane 3600

Aplicação Node.js para comunicação com a pinpad **Stone Lane 3600** via TEF (Transferência Eletrônica de Fundos).

## Funcionalidades

- Transações de **crédito** (à vista e parcelado), **débito** e **voucher**
- Cancelamento de transações
- Reimpressão do último cupom
- Consulta da última transação
- Interface web simples para operação
- API REST para integração com outros sistemas

## Modos de Integração

### 1. FFI (DPOSDRV) — Recomendado

Comunicação direta com a biblioteca nativa do Stone TEF Client (`DPOSDRV.DLL` no Windows ou `libdposdrv.so` no Linux) via FFI (Foreign Function Interface) usando a lib [koffi](https://koffi.dev/).

**Pré-requisitos:**
- Stone TEF Client instalado na máquina
- Pinpad Lane 3600 conectada e configurada no Client
- Credenciais Stone (StoneCode, CNPJ)

### 2. Troca de Arquivos

Integração pelo protocolo de troca de arquivos, onde a aplicação escreve arquivos de requisição e lê arquivos de resposta. Requer o **Gerenciador Padrão** da Stone instalado.

**Pré-requisitos:**
- Gerenciador Padrão da Stone instalado
- Pinpad Lane 3600 conectada
- Diretórios de troca configurados

## Instalação

```bash
# Clonar o repositório
git clone https://github.com/jeronimo0007/tef.git
cd tef

# Instalar dependências
npm install

# Copiar e configurar o arquivo de ambiente
cp .env.example .env
# Editar .env com suas credenciais e caminhos
```

## Configuração (.env)

```env
# Modo: "ffi" ou "file"
TEF_MODE=ffi

# Porta do servidor
PORT=3000

# Credenciais Stone
STONE_CODE=SEU_STONE_CODE
CNPJ=SEU_CNPJ
EMPRESA=01
LOJA=0001
PDV=001

# Modo FFI — caminho da DLL/SO
DPOSDRV_PATH=C:\DPOS\Bin\DPOSDRV.DLL

# Modo Troca de Arquivos
TEF_REQ_DIR=C:\Cliente\Req
TEF_RESP_DIR=C:\Cliente\Resp
TEF_GP_PATH=C:\TEFStone\GP.exe
```

## Uso

```bash
# Iniciar o servidor
npm start

# Modo desenvolvimento (auto-reload)
npm run dev
```

Acesse **http://localhost:3000** para usar a interface web.

## API REST

### `GET /api/tef/status`

Verifica se o servidor está online.

```json
{ "online": true, "modo": "ffi", "timestamp": "2025-01-01T00:00:00.000Z" }
```

### `POST /api/tef/venda`

Inicia uma transação de venda.

```json
{
  "tipo": "credito",
  "valor": "10.50",
  "parcelas": "3",
  "tipoParcelamento": "1"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| tipo | string | Sim | `credito`, `debito` ou `voucher` |
| valor | string | Sim | Valor em reais (ex: `"10.50"`) |
| parcelas | string | Não | Número de parcelas (crédito) |
| tipoParcelamento | string | Não | `1` = loja, `2` = administradora |

**Resposta de sucesso:**
```json
{
  "sucesso": true,
  "tipo": "credito",
  "valor": "1050",
  "cupom": "000001",
  "rede": "STONE",
  "nsu": "123456",
  "dados": { ... }
}
```

### `POST /api/tef/cancelamento`

Cancela uma transação.

```json
{
  "rede": "STONE",
  "nsu": "123456",
  "data": "01012025",
  "valor": "10.50"
}
```

### `POST /api/tef/reimpressao`

Reimprime o último cupom de transação.

### `GET /api/tef/ultima-transacao`

Consulta o log da última transação (modo FFI apenas).

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
│       ├── dposdrv.js       # Integração FFI (DPOSDRV.DLL/SO)
│       └── file-exchange.js # Integração Troca de Arquivos
├── .env.example
├── .eslintrc.json
├── package.json
└── README.md
```

## Fluxo de uma Transação (modo FFI)

```
1. InicializaDPOS()          → Inicializa o módulo TEF
2. ConfiguraDPOS()           → Configura empresa/loja/PDV
3. TransacaoCartaoCredito()  → Envia transação para o pinpad
   ↳ Pinpad aguarda cartão
   ↳ Pinpad processa e retorna resultado
4. ConfirmaCartaoCredito()   → Confirma a transação
5. FinalizaTransacao()       → Finaliza o ciclo
```

## Fluxo de uma Transação (modo Troca de Arquivos)

```
1. App escreve INTPOS.001 no diretório de requisição
2. Gerenciador Padrão lê o arquivo e aciona o pinpad
3. Pinpad processa o cartão
4. Gerenciador escreve INTPOS.001 no diretório de resposta
5. App lê a resposta e escreve INTPOS.STS (confirmação)
```

## Requisitos

- Node.js >= 18
- Stone TEF Client instalado (modo FFI) ou Gerenciador Padrão (modo arquivo)
- Pinpad Stone Lane 3600 conectada à máquina (USB ou rede)

## Licença

ISC
