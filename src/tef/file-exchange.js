/**
 * Integração com Stone TEF via Troca de Arquivos.
 *
 * A automação escreve um arquivo de requisição (INTPOS.001) no diretório
 * de requisição, e o Gerenciador Padrão da Stone processa e devolve
 * o resultado em um arquivo de resposta (INTPOS.001) no diretório de resposta.
 *
 * Protocolo:
 *   1. Automação escreve INTPOS.001 em TEF_REQ_DIR
 *   2. Gerenciador Padrão lê, processa e escreve resultado em TEF_RESP_DIR
 *   3. Automação lê INTPOS.001 de TEF_RESP_DIR
 *   4. Automação escreve INTPOS.STS (confirmação) em TEF_REQ_DIR
 */
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const logger = require('../logger');

const REQ_FILENAME = 'INTPOS.001';
const STS_FILENAME = 'INTPOS.STS';
const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 120000;

class FileExchange {
  constructor(config) {
    this.reqDir = config.reqDir;
    this.respDir = config.respDir;
    this.gpPath = config.gpPath;
  }

  _ensureDirs() {
    for (const dir of [this.reqDir, this.respDir]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info('Diretório criado', { dir });
      }
    }
  }

  _buildReqContent(campos) {
    return Object.entries(campos)
      .map(([chave, valor]) => `${chave} = ${valor}`)
      .join('\r\n') + '\r\n';
  }

  _parseRespContent(content) {
    const campos = {};
    const linhas = content.split(/\r?\n/).filter(Boolean);
    for (const linha of linhas) {
      const idx = linha.indexOf('=');
      if (idx > 0) {
        campos[linha.substring(0, idx).trim()] = linha.substring(idx + 1).trim();
      }
    }
    return campos;
  }

  _writeReqFile(campos) {
    this._ensureDirs();
    const filePath = path.join(this.reqDir, REQ_FILENAME);
    const content = this._buildReqContent(campos);
    fs.writeFileSync(filePath, content, 'latin1');
    logger.info('Arquivo de requisição escrito', { filePath, campos });
  }

  _writeStsFile(status) {
    const filePath = path.join(this.reqDir, STS_FILENAME);
    fs.writeFileSync(filePath, status, 'latin1');
    logger.info('Arquivo STS escrito', { filePath, status });
  }

  _waitForResponse() {
    return new Promise((resolve, reject) => {
      const respPath = path.join(this.respDir, REQ_FILENAME);
      const startTime = Date.now();

      const check = () => {
        if (fs.existsSync(respPath)) {
          try {
            const content = fs.readFileSync(respPath, 'latin1');
            fs.unlinkSync(respPath);
            const dados = this._parseRespContent(content);
            logger.info('Resposta recebida', { dados });
            resolve(dados);
          } catch (err) {
            reject(err);
          }
          return;
        }

        if (Date.now() - startTime > POLL_TIMEOUT_MS) {
          reject(new Error('Timeout aguardando resposta do Gerenciador Padrão'));
          return;
        }

        setTimeout(check, POLL_INTERVAL_MS);
      };

      check();
    });
  }

  _launchGP() {
    if (!this.gpPath || !fs.existsSync(this.gpPath)) {
      logger.warn('Gerenciador Padrão não encontrado, aguardando processamento manual', {
        gpPath: this.gpPath,
      });
      return;
    }

    return new Promise((resolve, reject) => {
      execFile(this.gpPath, [], (error) => {
        if (error) {
          logger.error('Erro ao executar Gerenciador Padrão', { error: error.message });
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async transacao(tipo, campos) {
    const reqCampos = {
      '000-000': tipo,
      ...campos,
    };

    this._writeReqFile(reqCampos);

    try {
      await this._launchGP();
    } catch {
      logger.warn('GP não executado, aguardando resposta de outro processo');
    }

    const dados = await this._waitForResponse();

    this._writeStsFile('0');

    return {
      sucesso: dados['009-000'] === '0' || dados['009-000'] === '00',
      dados,
    };
  }

  async vendaCredito(valor, cupomFiscal) {
    return this.transacao('CRT', {
      '001-000': '0',
      '002-000': valor,
      '003-000': cupomFiscal,
    });
  }

  async vendaDebito(valor, cupomFiscal) {
    return this.transacao('CRT', {
      '001-000': '1',
      '002-000': valor,
      '003-000': cupomFiscal,
    });
  }

  async vendaVoucher(valor, cupomFiscal) {
    return this.transacao('CRT', {
      '001-000': '2',
      '002-000': valor,
      '003-000': cupomFiscal,
    });
  }

  async cancelamento(rede, nsu, data, valor) {
    return this.transacao('CNC', {
      '001-000': rede,
      '002-000': nsu,
      '003-000': data,
      '004-000': valor,
    });
  }

  async reimpressao() {
    return this.transacao('REI', {});
  }

  async confirmacao(rede, nsu) {
    return this.transacao('CNF', {
      '001-000': rede,
      '002-000': nsu,
    });
  }
}

module.exports = FileExchange;
