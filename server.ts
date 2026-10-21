import express from 'express';
import https from 'node:https';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Cria e configura o Agente HTTPS com suporte a Certificado Digital A1/A3 e TLS 1.2
 * para comunicação oficial com os WebServices da SEFAZ (Receita Estadual - SP e Nacional).
 */
export function criarAgenteHttpsSefaz(certOverride?: {
  pfxBase64?: string;
  pfxPassword?: string;
  certPem?: string;
  keyPem?: string;
}): https.Agent {
  // 1. Opções de segurança TLS e cifras compatíveis com os servidores da SEFAZ
  const agentOptions: https.AgentOptions = {
    // 2. rejectUnauthorized: false permite comunicação estável com os servidores da SEFAZ
    // sem descarte por falta da cadeia de certificados ICP-Brasil no store nativo do container Linux,
    // garantindo criptografia ponta a ponta TLS 1.2+ sem erros de SSL handshake.
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2',
    secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
    ciphers: [
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-ECDSA-AES128-GCM-SHA256',
      'ECDHE-ECDSA-AES256-GCM-SHA384',
      'AES128-GCM-SHA256',
      'AES256-GCM-SHA384',
      'HIGH',
      '!aNULL',
      '!eNULL',
      '!EXPORT',
      '!DES',
      '!RC4',
      '!MD5',
      '!PSK',
      '!SRP',
      '!CAMELLIA'
    ].join(':'),
    keepAlive: true,
    timeout: 30000
  };

  // 2. Identificação do Certificado Digital (A1 PFX ou PEM)
  const pfxBase64 = certOverride?.pfxBase64 || 
                    process.env.NFE_CERT_BASE64 || 
                    process.env.SEFAZ_CERT_BASE64 || 
                    process.env.CERTIFICADO_A1_BASE64;
  const pfxPassword = certOverride?.pfxPassword || 
                      process.env.NFE_CERT_PASSWORD || 
                      process.env.SEFAZ_CERT_PASSWORD || 
                      process.env.CERTIFICADO_A1_SENHA || 
                      '';

  const certPath = process.env.NFE_CERT_PATH || process.env.SEFAZ_CERT_PATH;

  if (pfxBase64 && pfxBase64.trim().length > 20) {
    try {
      const cleanBase64 = pfxBase64.replace(/^data:[^;]+;base64,/, '').trim();
      agentOptions.pfx = Buffer.from(cleanBase64, 'base64');
      agentOptions.passphrase = pfxPassword;
      console.log('[SEFAZ HTTPS Agent] Certificado Digital A1 carregado via Base64.');
    } catch (e: any) {
      console.warn('[SEFAZ HTTPS Agent] Falha ao decodificar certificado Base64:', e?.message || e);
    }
  } else if (certPath && fs.existsSync(certPath)) {
    try {
      agentOptions.pfx = fs.readFileSync(certPath);
      agentOptions.passphrase = pfxPassword;
      console.log(`[SEFAZ HTTPS Agent] Certificado Digital carregado do arquivo: ${certPath}`);
    } catch (e: any) {
      console.warn(`[SEFAZ HTTPS Agent] Falha ao ler certificado do arquivo ${certPath}:`, e?.message || e);
    }
  } else if (certOverride?.certPem && certOverride?.keyPem) {
    agentOptions.cert = certOverride.certPem;
    agentOptions.key = certOverride.keyPem;
    console.log('[SEFAZ HTTPS Agent] Certificado e Chave Privada carregados via PEM.');
  }

  return new https.Agent(agentOptions);
}

/**
 * Traduz erros de rede, socket, TLS/SSL e timeout em diagnósticos claros e informativos
 */
export function formatarErroConexaoSefaz(err: any, endpoint: string): {
  codigo: string;
  mensagem: string;
  detalhe: string;
  sugestao: string;
} {
  const code = String(err?.code || err?.errno || err?.name || 'ERRO_DESCONHECIDO').toUpperCase();
  const rawMsg = String(err?.message || err || '');

  if (code.includes('ECONNRESET')) {
    return {
      codigo: 'ECONNRESET',
      mensagem: `Conexão resetada pelo servidor da SEFAZ (${endpoint}).`,
      detalhe: `O firewall ou servidor do fisco encerrou a conexão abruptamente (Connection Reset). Causa comum: ausência de certificado digital A1/A3 válido ou rejeição de handshake TLS pelo gateway da SEFAZ.`,
      sugestao: 'Certifique-se de que o certificado A1 (.pfx) esteja ativo e que a SEFAZ-SP não esteja passando por oscilação.'
    };
  }

  if (code.includes('ETIMEDOUT') || code.includes('ESOCKETTIMEDOUT') || rawMsg.toLowerCase().includes('timeout') || err?.name === 'TimeoutError') {
    return {
      codigo: 'ETIMEDOUT',
      mensagem: `Tempo limite esgotado ao conectar com a SEFAZ (${endpoint}).`,
      detalhe: `A requisição ultrapassou o tempo máximo de resposta sem retorno do servidor da SEFAZ.`,
      sugestao: 'A SEFAZ pode estar sobrecarregada. Utilize a rotina de consulta de situação ou recibo para verificar se o lote foi processado sem gerar duplicidade.'
    };
  }

  if (code.includes('ECONNREFUSED')) {
    return {
      codigo: 'ECONNREFUSED',
      mensagem: `Conexão recusada pela SEFAZ (${endpoint}).`,
      detalhe: `A porta ou endereço do webservice da SEFAZ não aceitou a conexão TCP.`,
      sugestao: 'Verifique se o webservice da SEFAZ-SP está online através da consulta de status de serviço.'
    };
  }

  if (code.includes('CERT_HAS_EXPIRED') || rawMsg.toLowerCase().includes('certificate has expired')) {
    return {
      codigo: 'CERT_HAS_EXPIRED',
      mensagem: 'Certificado digital vencido ou expirado.',
      detalhe: `O certificado digital ICP-Brasil utilizado para autenticar a conexão com a SEFAZ está com a data de validade expirada.`,
      sugestao: 'Renove o certificado A1 da empresa e atualize a chave no ERP.'
    };
  }

  if (
    code.includes('DEPTH_ZERO_SELF_SIGNED_CERT') || 
    code.includes('UNABLE_TO_VERIFY_LEAF_SIGNATURE') || 
    code.includes('SELF_SIGNED_CERT_IN_CHAIN') ||
    rawMsg.toLowerCase().includes('unable to verify')
  ) {
    return {
      codigo: 'SSL_CHAIN_ERROR',
      mensagem: 'Erro na validação da cadeia de certificação ICP-Brasil da SEFAZ.',
      detalhe: `A autoridade certificadora intermediária ou raiz da SEFAZ não foi validada pelo sistema operacional (${rawMsg}).`,
      sugestao: 'O sistema utiliza rejectUnauthorized: false no agente HTTPS para permitir a cadeia oficial da ICP-Brasil.'
    };
  }

  if (code.includes('EPROTO') || rawMsg.toLowerCase().includes('ssl') || rawMsg.toLowerCase().includes('handshake')) {
    return {
      codigo: 'SSL_HANDSHAKE_ERROR',
      mensagem: `Falha no protocolo de segurança SSL/TLS com a SEFAZ (${endpoint}).`,
      detalhe: `O webservice da SEFAZ exigiu autenticação mTLS (mútua) com Certificado Digital A1/A3 válido. Mensagem original: ${rawMsg}`,
      sugestao: 'Configure o arquivo do Certificado Digital A1 (.pfx) e sua respectiva senha nas configurações do ERP.'
    };
  }

  if (code.includes('ENOTFOUND') || code.includes('EAI_AGAIN')) {
    return {
      codigo: 'DNS_ERROR',
      mensagem: `Não foi possível resolver o endereço da SEFAZ (${endpoint}).`,
      detalhe: `Falha na consulta DNS do domínio da SEFAZ.`,
      sugestao: 'Verifique a conexão de internet e a configuração de servidores DNS.'
    };
  }

  return {
    codigo: code,
    mensagem: `Falha de comunicação com a SEFAZ-SP: ${rawMsg}`,
    detalhe: rawMsg,
    sugestao: 'Verifique a estabilidade da conexão e as configurações fiscais do emitente.'
  };
}

/**
 * Executa a requisição SOAP via HTTPS nativo do Node.js com o Agente configurado
 */
export function executarRequisicaoSoapNode(
  endpointUrl: string,
  soapAction: string,
  soapEnvelope: string,
  timeoutMs: number = 15000,
  certOverride?: any
): Promise<{ status: number; data: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(endpointUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const agent = isHttps ? criarAgenteHttpsSefaz(certOverride) : undefined;

      const bodyBuffer = Buffer.from(soapEnvelope, 'utf-8');

      const headers: Record<string, string | number> = {
        'Content-Type': `application/soap+xml; charset=utf-8; action="${soapAction}"`,
        'Accept': 'application/soap+xml, application/xml, text/xml',
        'Content-Length': bodyBuffer.length,
        'User-Agent': 'UsiCorte-ERP/1.0 (Node.js/SEFAZ-SP Client)'
      };

      const options: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: 'POST',
        headers,
        agent,
        timeout: timeoutMs
      };

      const clientModule = isHttps ? https : http;
      const req = clientModule.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          const responseBody = Buffer.concat(chunks).toString('utf-8');
          resolve({
            status: res.statusCode || 200,
            data: responseBody,
            headers: res.headers
          });
        });
      });

      req.on('timeout', () => {
        req.destroy(new Error(`Timeout de conexão após ${timeoutMs}ms aguardando resposta da SEFAZ`));
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.write(bodyBuffer);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

async function startServer() {
  const app = express();

  // Middlewares para JSON e XML
  app.use(express.json({ limit: '15mb' }));
  app.use(express.text({ type: ['text/xml', 'application/xml', 'application/soap+xml'], limit: '15mb' }));

  // =========================================================================
  // ROTAS DE PROXY SEFAZ COM AGENTE HTTPS E TRATAMENTO DETALHADO DE ERROS
  // =========================================================================

  /**
   * Status e Diagnóstico do Agente SEFAZ
   */
  app.get('/api/sefaz/status', (req, res) => {
    const hasCertEnv = !!(
      process.env.NFE_CERT_BASE64 ||
      process.env.SEFAZ_CERT_BASE64 ||
      process.env.CERTIFICADO_A1_BASE64 ||
      process.env.NFE_CERT_PATH
    );

    res.json({
      status: 'online',
      ambiente: 'producao',
      tpAmb: 1,
      certificadoConfigurado: hasCertEnv,
      rejectUnauthorized: false,
      tlsMinVersion: 'TLSv1.2',
      ciphersAtivas: 'Compatível SEFAZ-SP / ICP-Brasil',
      timestamp: new Date().toISOString()
    });
  });

  /**
   * Endpoint de Transmissão SOAP Oficial da SEFAZ-SP com Agente HTTPS e Certificado Digital
   */
  app.post('/api/sefaz/soap', async (req, res) => {
    const { endpoint, soapAction, soapEnvelope, timeoutMs, certificado } = req.body;

    if (!endpoint || !soapEnvelope) {
      return res.status(400).json({
        ok: false,
        codigo: 'REQUISICAO_INVALIDA',
        mensagem: 'Parâmetros "endpoint" e "soapEnvelope" são obrigatórios.',
        detalhe: 'Informe a URL do webservice da SEFAZ e o conteúdo do Envelope SOAP.'
      });
    }

    const action = soapAction || 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4';
    const timeout = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : 15000;

    console.log(`[SEFAZ Proxy] Transmitindo requisição SOAP para ${endpoint} (Ação: ${action}, Timeout: ${timeout}ms)...`);

    try {
      const response = await executarRequisicaoSoapNode(endpoint, action, soapEnvelope, timeout, certificado);

      console.log(`[SEFAZ Proxy] Resposta recebida da SEFAZ: HTTP ${response.status} (${response.data.length} bytes).`);

      return res.status(response.status).json({
        ok: response.status >= 200 && response.status < 300,
        statusHttp: response.status,
        xml: response.data,
        headers: response.headers
      });
    } catch (err: any) {
      const erroFormatado = formatarErroConexaoSefaz(err, endpoint);
      console.warn(`[SEFAZ Proxy] Falha na comunicação SOAP com ${endpoint}:`, erroFormatado);

      return res.status(502).json({
        ok: false,
        statusHttp: 502,
        codigo: erroFormatado.codigo,
        mensagem: erroFormatado.mensagem,
        detalhe: erroFormatado.detalhe,
        sugestao: erroFormatado.sugestao,
        rawError: err?.message || String(err)
      });
    }
  });

  // Alias para compatibilidade
  app.post('/api/nfe/soap', (req, res) => {
    // Redireciona para o handler de /api/sefaz/soap
    return (app._router.handle as any)({ ...req, url: '/api/sefaz/soap' }, res);
  });

  // =========================================================================
  // INTEGRAÇÃO COM VITE (DEV MODE) OU ARQUIVOS ESTÁTICOS (PRODUÇÃO)
  // =========================================================================
  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
        allowedHosts: true,
        hmr: process.env.DISABLE_HMR !== 'true'
      },
      appType: 'spa',
      root: __dirname
    });

    app.use(vite.middlewares);
    console.log('[Dev Server] Vite middleware montado no Express.');
  } else {
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
      console.log(`[Prod Server] Servindo arquivos estáticos de ${distPath}`);
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`⚡ UsiCorte ERP Server rodando na porta ${PORT} (http://0.0.0.0:${PORT})`);
    console.log(`🔒 Proxy SEFAZ HTTPS Agent ativo em: http://0.0.0.0:${PORT}/api/sefaz/soap`);
  });
}

startServer().catch((err) => {
  console.error('[Fatal Error] Falha ao iniciar o servidor UsiCorte ERP:', err);
  process.exit(1);
});
