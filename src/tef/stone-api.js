/**
 * Integração com Stone Connect API (Pagar.me v5).
 *
 * Cria pedidos via API REST que são enviados diretamente para
 * a pinpad (POS) Lane 3600 processar o pagamento.
 *
 * Fluxo:
 *   1. App cria um pedido (order) via POST /orders
 *   2. A pinpad recebe o pedido e exibe a tela de pagamento
 *   3. Cliente passa o cartão na pinpad
 *   4. App consulta o status do pedido via GET /orders/:id
 */
const logger = require('../logger');

const API_BASE_URL = 'https://api.pagar.me/core/v5';

class StoneApi {
  constructor(config) {
    this.secretKey = config.secretKey;
    this.stoneCode = config.stoneCode;
    this.deviceSerial = config.deviceSerial;
    this.authHeader = 'Basic ' + Buffer.from(this.secretKey + ':').toString('base64');
  }

  async _request(method, path, body) {
    const url = `${API_BASE_URL}${path}`;

    const options = {
      method,
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    logger.info(`Stone API ${method} ${path}`, { body });

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      logger.error('Stone API erro', { status: response.status, data });
      throw new StoneApiError(response.status, data);
    }

    logger.info(`Stone API resposta ${response.status}`, { orderId: data.id });
    return data;
  }

  async criarPedido(params) {
    const {
      valor,
      tipo = 'credit',
      parcelas = 1,
      tipoParcelamento = 'merchant',
      descricao = 'Venda TEF',
      nomeCliente = 'Cliente',
      emailCliente = 'cliente@email.com',
    } = params;

    const valorCentavos = Math.round(parseFloat(valor) * 100);
    if (isNaN(valorCentavos) || valorCentavos <= 0) {
      throw new Error('Valor inválido');
    }

    const body = {
      customer: {
        name: nomeCliente,
        email: emailCliente,
      },
      items: [
        {
          amount: valorCentavos,
          description: descricao,
          quantity: 1,
        },
      ],
      closed: false,
      poi_payment_settings: {
        visible: true,
        print_order_receipt: false,
        payment_setup: {
          type: tipo,
          installments: parseInt(parcelas, 10) || 1,
          installment_type: tipoParcelamento,
        },
        display_name: descricao,
      },
    };

    if (this.deviceSerial) {
      body.poi_payment_settings.devices_serial_number = [this.deviceSerial];
    }

    return this._request('POST', '/orders', body);
  }

  async consultarPedido(orderId) {
    return this._request('GET', `/orders/${orderId}`);
  }

  async listarPedidos(params = {}) {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.page) query.set('page', params.page);
    if (params.size) query.set('size', params.size);

    const qs = query.toString();
    return this._request('GET', `/orders${qs ? '?' + qs : ''}`);
  }

  async cancelarPedido(orderId) {
    return this._request('PATCH', `/orders/${orderId}/closed`, {
      status: 'canceled',
    });
  }

  async aguardarPagamento(orderId, timeoutMs = 120000, intervaloMs = 3000) {
    const inicio = Date.now();

    while (Date.now() - inicio < timeoutMs) {
      const pedido = await this.consultarPedido(orderId);

      if (pedido.status === 'paid') {
        logger.info('Pagamento confirmado', { orderId, status: pedido.status });
        return { sucesso: true, status: 'paid', pedido };
      }

      if (pedido.status === 'canceled' || pedido.status === 'failed') {
        logger.warn('Pagamento não aprovado', { orderId, status: pedido.status });
        return { sucesso: false, status: pedido.status, pedido };
      }

      await new Promise((resolve) => setTimeout(resolve, intervaloMs));
    }

    logger.warn('Timeout aguardando pagamento', { orderId });
    return { sucesso: false, status: 'timeout', pedido: null };
  }
}

class StoneApiError extends Error {
  constructor(statusCode, data) {
    const msg = data.message || data.errors?.[0]?.message || `HTTP ${statusCode}`;
    super(msg);
    this.name = 'StoneApiError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

module.exports = { StoneApi, StoneApiError };
