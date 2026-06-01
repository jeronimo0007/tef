/**
 * TEF Manager — camada de abstração que seleciona automaticamente
 * o modo de integração (FFI ou Troca de Arquivos) conforme a config.
 */
const DposDrv = require('./dposdrv');
const FileExchange = require('./file-exchange');
const logger = require('../logger');

class TefManager {
  constructor() {
    this.mode = process.env.TEF_MODE || 'ffi';
    this.driver = null;
    this.cupomSequence = 1;
  }

  init() {
    if (this.mode === 'ffi') {
      this._initFFI();
    } else {
      this._initFileExchange();
    }
  }

  _initFFI() {
    const libraryPath = process.env.DPOSDRV_PATH;
    if (!libraryPath) {
      logger.error('DPOSDRV_PATH não configurado no .env');
      throw new Error('DPOSDRV_PATH não configurado');
    }

    this.driver = new DposDrv(libraryPath);
    const loaded = this.driver.load();
    if (!loaded) {
      throw new Error(`Não foi possível carregar a biblioteca: ${libraryPath}`);
    }

    const initResult = this.driver.inicializar();
    if (!initResult.sucesso) {
      throw new Error(`Falha ao inicializar DPOS: código ${initResult.codigo}`);
    }

    const empresa = process.env.EMPRESA || '01';
    const loja = process.env.LOJA || '0001';
    const pdv = process.env.PDV || '001';
    const configResult = this.driver.configurar(empresa, loja, pdv);
    if (!configResult.sucesso) {
      throw new Error(`Falha ao configurar DPOS: código ${configResult.codigo}`);
    }

    logger.info('TEF inicializado no modo FFI');
  }

  _initFileExchange() {
    this.driver = new FileExchange({
      reqDir: process.env.TEF_REQ_DIR || 'C:\\Cliente\\Req',
      respDir: process.env.TEF_RESP_DIR || 'C:\\Cliente\\Resp',
      gpPath: process.env.TEF_GP_PATH,
    });
    logger.info('TEF inicializado no modo Troca de Arquivos');
  }

  _nextCupom() {
    return String(this.cupomSequence++).padStart(6, '0');
  }

  /**
   * Formata valor em reais para centavos (string).
   * Ex: 10.50 → "1050", 100 → "10000"
   */
  _formatValor(valor) {
    const num = parseFloat(valor);
    if (isNaN(num) || num <= 0) {
      throw new Error('Valor inválido');
    }
    return String(Math.round(num * 100));
  }

  async venda(tipo, valor, opcoes = {}) {
    const valorFormatado = this._formatValor(valor);
    const cupom = opcoes.cupomFiscal || this._nextCupom();

    logger.info('Iniciando venda', { tipo, valor, valorFormatado, cupom });

    if (this.mode === 'ffi') {
      return this._vendaFFI(tipo, valorFormatado, cupom, opcoes);
    }
    return this._vendaFileExchange(tipo, valorFormatado, cupom);
  }

  _vendaFFI(tipo, valor, cupom, opcoes) {
    let resultado;

    switch (tipo) {
      case 'credito':
        if (opcoes.parcelas && parseInt(opcoes.parcelas, 10) > 1) {
          resultado = this.driver.transacaoCreditoCompleta(
            valor, cupom, opcoes.parcelas, opcoes.tipoParcelamento || '1', ''
          );
        } else {
          resultado = this.driver.transacaoCredito(valor, cupom);
        }
        break;
      case 'debito':
        resultado = this.driver.transacaoDebito(valor, cupom);
        break;
      case 'voucher':
        resultado = this.driver.transacaoVoucher(valor, cupom);
        break;
      default:
        throw new Error(`Tipo de transação inválido: ${tipo}`);
    }

    if (resultado.sucesso) {
      const rede = resultado.dados.rede || resultado.dados.Rede || '';
      const nsu = resultado.dados.nsu || resultado.dados.NSU || '';

      let confirma;
      switch (tipo) {
        case 'credito':
          confirma = this.driver.confirmaCredito(rede, nsu, '0');
          break;
        case 'debito':
          confirma = this.driver.confirmaDebito(rede, nsu, '0');
          break;
        case 'voucher':
          this.driver.finalizaTransacao(true);
          confirma = { sucesso: true };
          break;
      }

      this.driver.finalizaTransacao(true);

      return {
        sucesso: true,
        tipo,
        valor,
        cupom,
        rede,
        nsu,
        dados: resultado.dados,
        confirmacao: confirma,
      };
    }

    this.driver.finalizaTransacao(false);
    return {
      sucesso: false,
      tipo,
      valor,
      cupom,
      erro: `Transação negada (código: ${resultado.codigo})`,
      dados: resultado.dados,
    };
  }

  async _vendaFileExchange(tipo, valor, cupom) {
    let resultado;

    switch (tipo) {
      case 'credito':
        resultado = await this.driver.vendaCredito(valor, cupom);
        break;
      case 'debito':
        resultado = await this.driver.vendaDebito(valor, cupom);
        break;
      case 'voucher':
        resultado = await this.driver.vendaVoucher(valor, cupom);
        break;
      default:
        throw new Error(`Tipo de transação inválido: ${tipo}`);
    }

    if (resultado.sucesso) {
      const rede = resultado.dados['010-000'] || '';
      const nsu = resultado.dados['012-000'] || '';

      await this.driver.confirmacao(rede, nsu);

      return {
        sucesso: true,
        tipo,
        valor,
        cupom,
        rede,
        nsu,
        dados: resultado.dados,
      };
    }

    return {
      sucesso: false,
      tipo,
      valor,
      cupom,
      erro: resultado.dados['030-000'] || 'Transação negada',
      dados: resultado.dados,
    };
  }

  async cancelamento(rede, nsu, data, valor) {
    logger.info('Iniciando cancelamento', { rede, nsu, data, valor });

    if (this.mode === 'ffi') {
      const resultado = this.driver.cancelamento(rede, nsu, data, this._formatValor(valor));
      this.driver.finalizaTransacao(resultado.sucesso);
      return resultado;
    }

    return this.driver.cancelamento(rede, nsu, data, this._formatValor(valor));
  }

  async reimpressao() {
    logger.info('Solicitando reimpressão');

    if (this.mode === 'ffi') {
      return this.driver.reimpressao();
    }

    return this.driver.reimpressao();
  }

  async ultimaTransacao() {
    if (this.mode === 'ffi') {
      return this.driver.ultimaTransacao();
    }
    return { sucesso: false, erro: 'Não suportado no modo Troca de Arquivos' };
  }

  shutdown() {
    if (this.mode === 'ffi' && this.driver && this.driver.initialized) {
      this.driver.finalizar();
    }
    logger.info('TEF finalizado');
  }
}

module.exports = TefManager;
