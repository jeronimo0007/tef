/**
 * TEF Manager — camada de abstração que gerencia a comunicação
 * com a pinpad Stone Lane 3600 via Stone Connect API.
 */
const { StoneApi } = require('./stone-api');
const logger = require('../logger');

class TefManager {
  constructor() {
    this.api = null;
    this.initialized = false;
  }

  init() {
    const secretKey = process.env.STONE_SECRET_KEY;
    const stoneCode = process.env.STONE_CODE;
    const deviceSerial = process.env.DEVICE_SERIAL || '';

    if (!secretKey) {
      throw new Error('STONE_SECRET_KEY não configurado no .env');
    }

    this.api = new StoneApi({ secretKey, stoneCode, deviceSerial });
    this.initialized = true;

    logger.info('TEF inicializado via Stone Connect API', {
      stoneCode,
      deviceSerial: deviceSerial || '(todas as maquininhas)',
    });
  }

  async venda(params) {
    if (!this.initialized) {
      throw new Error('TEF não inicializado');
    }

    const { tipo, valor, parcelas, tipoParcelamento, descricao, nomeCliente, emailCliente } = params;

    if (!tipo || !valor) {
      throw new Error('Campos obrigatórios: tipo, valor');
    }

    const tipoApi = tipo === 'debito' ? 'debit' : tipo === 'credito' ? 'credit' : tipo;

    logger.info('Criando pedido', { tipo: tipoApi, valor });

    const pedido = await this.api.criarPedido({
      valor,
      tipo: tipoApi,
      parcelas: parcelas || 1,
      tipoParcelamento: tipoParcelamento || 'merchant',
      descricao: descricao || 'Venda TEF',
      nomeCliente: nomeCliente || 'Cliente',
      emailCliente: emailCliente || 'cliente@email.com',
    });

    logger.info('Pedido criado, aguardando pagamento na pinpad', {
      orderId: pedido.id,
      amount: pedido.amount,
    });

    return {
      sucesso: true,
      mensagem: 'Pedido enviado para a pinpad. Aguardando pagamento.',
      pedido: {
        id: pedido.id,
        code: pedido.code,
        amount: pedido.amount,
        status: pedido.status,
        tipo: tipoApi,
        parcelas: parcelas || 1,
      },
    };
  }

  async vendaComEspera(params) {
    const resultado = await this.venda(params);

    if (!resultado.sucesso) {
      return resultado;
    }

    const timeout = parseInt(process.env.PAYMENT_TIMEOUT_MS, 10) || 120000;
    const status = await this.api.aguardarPagamento(resultado.pedido.id, timeout);

    return {
      ...resultado,
      sucesso: status.sucesso,
      statusPagamento: status.status,
      pedidoCompleto: status.pedido,
    };
  }

  async consultarPedido(orderId) {
    if (!this.initialized) {
      throw new Error('TEF não inicializado');
    }

    return this.api.consultarPedido(orderId);
  }

  async cancelarPedido(orderId) {
    if (!this.initialized) {
      throw new Error('TEF não inicializado');
    }

    logger.info('Cancelando pedido', { orderId });
    return this.api.cancelarPedido(orderId);
  }

  async listarPedidos(params = {}) {
    if (!this.initialized) {
      throw new Error('TEF não inicializado');
    }

    return this.api.listarPedidos(params);
  }

  async aguardarPagamento(orderId) {
    if (!this.initialized) {
      throw new Error('TEF não inicializado');
    }

    const timeout = parseInt(process.env.PAYMENT_TIMEOUT_MS, 10) || 120000;
    return this.api.aguardarPagamento(orderId, timeout);
  }

  shutdown() {
    this.initialized = false;
    logger.info('TEF finalizado');
  }
}

module.exports = TefManager;
