const { Router } = require('express');
const logger = require('../logger');

function createTefRoutes(tefManager) {
  const router = Router();

  router.post('/venda', async (req, res) => {
    try {
      const { tipo, valor, parcelas, tipoParcelamento, descricao, nomeCliente, emailCliente, aguardar } = req.body;

      if (!tipo || !valor) {
        return res.status(400).json({ erro: 'Campos obrigatórios: tipo (credito|debito), valor' });
      }

      if (!['credito', 'debito', 'credit', 'debit', 'voucher', 'pix'].includes(tipo)) {
        return res.status(400).json({ erro: 'Tipo inválido. Use: credito, debito, voucher ou pix' });
      }

      const numValor = parseFloat(valor);
      if (isNaN(numValor) || numValor <= 0) {
        return res.status(400).json({ erro: 'Valor deve ser numérico e maior que zero' });
      }

      const params = { tipo, valor, parcelas, tipoParcelamento, descricao, nomeCliente, emailCliente };

      let resultado;
      if (aguardar) {
        resultado = await tefManager.vendaComEspera(params);
      } else {
        resultado = await tefManager.venda(params);
      }

      res.json(resultado);
    } catch (err) {
      logger.error('Erro na venda', { error: err.message, data: err.data });
      res.status(err.statusCode || 500).json({
        erro: err.message,
        detalhes: err.data || null,
      });
    }
  });

  router.get('/pedido/:id', async (req, res) => {
    try {
      const pedido = await tefManager.consultarPedido(req.params.id);
      res.json(pedido);
    } catch (err) {
      logger.error('Erro ao consultar pedido', { error: err.message });
      res.status(err.statusCode || 500).json({ erro: err.message });
    }
  });

  router.get('/pedido/:id/aguardar', async (req, res) => {
    try {
      const resultado = await tefManager.aguardarPagamento(req.params.id);
      res.json(resultado);
    } catch (err) {
      logger.error('Erro ao aguardar pagamento', { error: err.message });
      res.status(err.statusCode || 500).json({ erro: err.message });
    }
  });

  router.post('/pedido/:id/cancelar', async (req, res) => {
    try {
      const resultado = await tefManager.cancelarPedido(req.params.id);
      res.json(resultado);
    } catch (err) {
      logger.error('Erro ao cancelar pedido', { error: err.message });
      res.status(err.statusCode || 500).json({ erro: err.message });
    }
  });

  router.get('/pedidos', async (req, res) => {
    try {
      const pedidos = await tefManager.listarPedidos({
        status: req.query.status,
        page: req.query.page,
        size: req.query.size,
      });
      res.json(pedidos);
    } catch (err) {
      logger.error('Erro ao listar pedidos', { error: err.message });
      res.status(err.statusCode || 500).json({ erro: err.message });
    }
  });

  router.get('/status', (_req, res) => {
    res.json({
      online: true,
      modo: 'Stone Connect API',
      inicializado: tefManager.initialized,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

module.exports = createTefRoutes;
