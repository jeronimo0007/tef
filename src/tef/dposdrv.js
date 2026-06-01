/**
 * Integração com Stone TEF via DPOSDRV (FFI).
 *
 * Carrega a DLL/SO do Stone TEF Client e expõe as funções de transação.
 * Requer que o Stone TEF Client esteja instalado na máquina.
 *
 * Fluxo típico:
 *   1. InicializaDPOS()
 *   2. ConfiguraDPOS(...)
 *   3. TransacaoCartaoCredito(...) ou TransacaoCartaoDebito(...)
 *   4. ConfirmaCartaoCredito(...) ou ConfirmaCartaoDebito(...)
 *   5. FinalizaTransacao(...)
 *   6. FinalizaDPOS()
 */
const logger = require('../logger');

const RETURN_BUFFER_SIZE = 32768;

class DposDrv {
  constructor(libraryPath) {
    this.libraryPath = libraryPath;
    this.lib = null;
    this.initialized = false;
  }

  load() {
    try {
      const koffi = require('koffi');
      this.lib = koffi.load(this.libraryPath);

      this.fn = {
        InicializaDPOS: this.lib.func('int InicializaDPOS()'),
        FinalizaDPOS: this.lib.func('int FinalizaDPOS()'),

        ConfiguraDPOS: this.lib.func(
          'int ConfiguraDPOS(const char* empresa, const char* loja, const char* pdv)'
        ),

        TransacaoCartaoCredito: this.lib.func(
          'int TransacaoCartaoCredito(const char* valor, const char* cupomFiscal, char* retorno, int tamRetorno)'
        ),
        TransacaoCartaoCreditoCompleta: this.lib.func(
          'int TransacaoCartaoCreditoCompleta(const char* valor, const char* cupomFiscal, const char* parcelas, const char* tipoParcelamento, const char* preDatado, char* retorno, int tamRetorno)'
        ),
        ConfirmaCartaoCredito: this.lib.func(
          'int ConfirmaCartaoCredito(const char* rede, const char* nsu, const char* finalizacao, char* retorno, int tamRetorno)'
        ),

        TransacaoCartaoDebito: this.lib.func(
          'int TransacaoCartaoDebito(const char* valor, const char* cupomFiscal, char* retorno, int tamRetorno)'
        ),
        ConfirmaCartaoDebito: this.lib.func(
          'int ConfirmaCartaoDebito(const char* rede, const char* nsu, const char* finalizacao, char* retorno, int tamRetorno)'
        ),

        TransacaoCartaoVoucher: this.lib.func(
          'int TransacaoCartaoVoucher(const char* valor, const char* cupomFiscal, char* retorno, int tamRetorno)'
        ),
        ConfirmaCartaoVoucher: this.lib.func(
          'int ConfirmaCartaoVoucher(const char* rede, const char* nsu, const char* finalizacao, char* retorno, int tamRetorno)'
        ),

        FinalizaTransacao: this.lib.func(
          'int FinalizaTransacao(int confirma, char* retorno, int tamRetorno)'
        ),

        TransacaoCancelamentoPagamento: this.lib.func(
          'int TransacaoCancelamentoPagamento(const char* rede, const char* nsu, const char* data, const char* valor, char* retorno, int tamRetorno)'
        ),

        TransacaoReimpressaoCupom: this.lib.func(
          'int TransacaoReimpressaoCupom(char* retorno, int tamRetorno)'
        ),

        ObtemLogUltimaTransacao: this.lib.func(
          'int ObtemLogUltimaTransacao(char* retorno, int tamRetorno)'
        ),
      };

      logger.info('DPOSDRV carregada com sucesso', { path: this.libraryPath });
      return true;
    } catch (err) {
      logger.error('Erro ao carregar DPOSDRV', { error: err.message, path: this.libraryPath });
      return false;
    }
  }

  inicializar() {
    const ret = this.fn.InicializaDPOS();
    this.initialized = ret === 0;
    logger.info('InicializaDPOS', { retorno: ret });
    return { sucesso: ret === 0, codigo: ret };
  }

  configurar(empresa, loja, pdv) {
    const ret = this.fn.ConfiguraDPOS(empresa, loja, pdv);
    logger.info('ConfiguraDPOS', { empresa, loja, pdv, retorno: ret });
    return { sucesso: ret === 0, codigo: ret };
  }

  transacaoCredito(valor, cupomFiscal) {
    const retorno = Buffer.alloc(RETURN_BUFFER_SIZE);
    const ret = this.fn.TransacaoCartaoCredito(valor, cupomFiscal, retorno, RETURN_BUFFER_SIZE);
    const dados = this._parseRetorno(retorno);
    logger.info('TransacaoCartaoCredito', { valor, cupomFiscal, retorno: ret });
    return { sucesso: ret === 0, codigo: ret, dados };
  }

  transacaoCreditoCompleta(valor, cupomFiscal, parcelas, tipoParcelamento, preDatado) {
    const retorno = Buffer.alloc(RETURN_BUFFER_SIZE);
    const ret = this.fn.TransacaoCartaoCreditoCompleta(
      valor, cupomFiscal, parcelas || '00', tipoParcelamento || '0', preDatado || '', retorno, RETURN_BUFFER_SIZE
    );
    const dados = this._parseRetorno(retorno);
    logger.info('TransacaoCartaoCreditoCompleta', { valor, parcelas, retorno: ret });
    return { sucesso: ret === 0, codigo: ret, dados };
  }

  confirmaCredito(rede, nsu, finalizacao) {
    const retorno = Buffer.alloc(RETURN_BUFFER_SIZE);
    const ret = this.fn.ConfirmaCartaoCredito(rede, nsu, finalizacao || '0', retorno, RETURN_BUFFER_SIZE);
    const dados = this._parseRetorno(retorno);
    logger.info('ConfirmaCartaoCredito', { rede, nsu, retorno: ret });
    return { sucesso: ret === 0, codigo: ret, dados };
  }

  transacaoDebito(valor, cupomFiscal) {
    const retorno = Buffer.alloc(RETURN_BUFFER_SIZE);
    const ret = this.fn.TransacaoCartaoDebito(valor, cupomFiscal, retorno, RETURN_BUFFER_SIZE);
    const dados = this._parseRetorno(retorno);
    logger.info('TransacaoCartaoDebito', { valor, cupomFiscal, retorno: ret });
    return { sucesso: ret === 0, codigo: ret, dados };
  }

  confirmaDebito(rede, nsu, finalizacao) {
    const retorno = Buffer.alloc(RETURN_BUFFER_SIZE);
    const ret = this.fn.ConfirmaCartaoDebito(rede, nsu, finalizacao || '0', retorno, RETURN_BUFFER_SIZE);
    const dados = this._parseRetorno(retorno);
    logger.info('ConfirmaCartaoDebito', { rede, nsu, retorno: ret });
    return { sucesso: ret === 0, codigo: ret, dados };
  }

  transacaoVoucher(valor, cupomFiscal) {
    const retorno = Buffer.alloc(RETURN_BUFFER_SIZE);
    const ret = this.fn.TransacaoCartaoVoucher(valor, cupomFiscal, retorno, RETURN_BUFFER_SIZE);
    const dados = this._parseRetorno(retorno);
    logger.info('TransacaoCartaoVoucher', { valor, cupomFiscal, retorno: ret });
    return { sucesso: ret === 0, codigo: ret, dados };
  }

  finalizaTransacao(confirma) {
    const retorno = Buffer.alloc(RETURN_BUFFER_SIZE);
    const ret = this.fn.FinalizaTransacao(confirma ? 1 : 0, retorno, RETURN_BUFFER_SIZE);
    const dados = this._parseRetorno(retorno);
    logger.info('FinalizaTransacao', { confirma, retorno: ret });
    return { sucesso: ret === 0, codigo: ret, dados };
  }

  cancelamento(rede, nsu, data, valor) {
    const retorno = Buffer.alloc(RETURN_BUFFER_SIZE);
    const ret = this.fn.TransacaoCancelamentoPagamento(rede, nsu, data, valor, retorno, RETURN_BUFFER_SIZE);
    const dados = this._parseRetorno(retorno);
    logger.info('TransacaoCancelamentoPagamento', { rede, nsu, retorno: ret });
    return { sucesso: ret === 0, codigo: ret, dados };
  }

  reimpressao() {
    const retorno = Buffer.alloc(RETURN_BUFFER_SIZE);
    const ret = this.fn.TransacaoReimpressaoCupom(retorno, RETURN_BUFFER_SIZE);
    const dados = this._parseRetorno(retorno);
    logger.info('TransacaoReimpressaoCupom', { retorno: ret });
    return { sucesso: ret === 0, codigo: ret, dados };
  }

  ultimaTransacao() {
    const retorno = Buffer.alloc(RETURN_BUFFER_SIZE);
    const ret = this.fn.ObtemLogUltimaTransacao(retorno, RETURN_BUFFER_SIZE);
    const dados = this._parseRetorno(retorno);
    logger.info('ObtemLogUltimaTransacao', { retorno: ret });
    return { sucesso: ret === 0, codigo: ret, dados };
  }

  finalizar() {
    const ret = this.fn.FinalizaDPOS();
    this.initialized = false;
    logger.info('FinalizaDPOS', { retorno: ret });
    return { sucesso: ret === 0, codigo: ret };
  }

  _parseRetorno(buffer) {
    const str = buffer.toString('latin1').replace(/\0+$/, '');
    if (!str) return {};

    const campos = {};
    const linhas = str.split('\r\n').filter(Boolean);
    for (const linha of linhas) {
      const idx = linha.indexOf('=');
      if (idx > 0) {
        campos[linha.substring(0, idx).trim()] = linha.substring(idx + 1).trim();
      }
    }
    return campos;
  }
}

module.exports = DposDrv;
