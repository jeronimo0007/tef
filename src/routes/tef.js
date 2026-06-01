const { Router } = require('express');
const logger = require('../logger');

function createTefRoutes(tefManager) {
  const router = Router();

  router.post('/venda', async (req, res) => {
    try {
      const { tipo, valor, parcelas, tipoParcelamento, cupomFiscal } = req.body;

      if (!tipo || !valor) {
        return res.status(400).json({ erro: 'Campos obrigatórios: tipo (credito|debito|voucher), valor' });
      }

      if (!['credito', 'debito', 'voucher'].includes(tipo)) {
        return res.status(400).json({ erro: 'Tipo inválido. Use: credito, debito ou voucher' });
      }

      const numValor = parseFloat(valor);
      if (isNaN(numValor) || numValor <= 0) {
        return res.status(400).json({ erro: 'Valor deve ser numérico e maior que zero' });
      }

      const resultado = await tefManager.venda(tipo, valor, {
        parcelas,
        tipoParcelamento,
        cupomFiscal,
      });

      const status = resultado.sucesso ? 200 : 422;
      res.status(status).json(resultado);
    } catch (err) {
      logger.error('Erro na venda', { error: err.message });
      res.status(500).json({ erro: err.message });
    }
  });

  router.post('/cancelamento', async (req, res) => {
    try {
      const { rede, nsu, data, valor } = req.body;

      if (!rede || !nsu || !data || !valor) {
        return res.status(400).json({ erro: 'Campos obrigatórios: rede, nsu, data, valor' });
      }

      const resultado = await tefManager.cancelamento(rede, nsu, data, valor);
      const status = resultado.sucesso ? 200 : 422;
      res.status(status).json(resultado);
    } catch (err) {
      logger.error('Erro no cancelamento', { error: err.message });
      res.status(500).json({ erro: err.message });
    }
  });

  router.post('/reimpressao', async (req, res) => {
    try {
      const resultado = await tefManager.reimpressao();
      res.json(resultado);
    } catch (err) {
      logger.error('Erro na reimpressão', { error: err.message });
      res.status(500).json({ erro: err.message });
    }
  });

  router.get('/ultima-transacao', async (req, res) => {
    try {
      const resultado = await tefManager.ultimaTransacao();
      res.json(resultado);
    } catch (err) {
      logger.error('Erro ao obter última transação', { error: err.message });
      res.status(500).json({ erro: err.message });
    }
  });

  router.get('/status', (req, res) => {
    res.json({
      online: true,
      modo: tefManager.mode,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

module.exports = createTefRoutes;
