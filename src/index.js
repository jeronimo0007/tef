require('dotenv').config();

const express = require('express');
const path = require('path');
const logger = require('./logger');
const TefManager = require('./tef/manager');
const createTefRoutes = require('./routes/tef');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const tefManager = new TefManager();

try {
  tefManager.init();
} catch (err) {
  logger.warn(`TEF não inicializado: ${err.message}`);
  logger.warn('O servidor irá iniciar, mas transações não funcionarão até a configuração correta.');
}

app.use('/api/tef', createTefRoutes(tefManager));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((err, req, res, _next) => {
  logger.error('Erro não tratado', { error: err.message, stack: err.stack });
  res.status(500).json({ erro: 'Erro interno do servidor' });
});

const server = app.listen(PORT, () => {
  logger.info(`Servidor TEF rodando em http://localhost:${PORT}`);
  logger.info(`Modo de integração: ${tefManager.mode}`);
});

function shutdown() {
  logger.info('Encerrando servidor...');
  tefManager.shutdown();
  server.close(() => {
    logger.info('Servidor encerrado');
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
