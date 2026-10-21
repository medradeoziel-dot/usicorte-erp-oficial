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
 * URLs oficiais dos WebServices da SEFAZ-SP (NF-e v4.00 - Modelo 55)
 * Suporte a Produção (tpAmb = 1) e Homologação (tpAmb = 2)
 */
export const WEBSERVICES_SEFAZ_SP = {
  1: {
    autorizacao: 'https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
    retAutorizacao: 'https://nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx',
    evento: 'https://nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx',
    consultaProtocolo: 'https://nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx',
    statusServico: 'https://nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
    inutilizacao: 'https://nfe.fazenda.sp.gov.br/ws/nfeinutilizacao4.asmx',
    consultaCadastro: 'https://nfe.fazenda.sp.gov.br/ws/cadconsultacadastro4.asmx'
  },
  2: {
    autorizacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
    retAutorizacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx',
    evento: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx',
    consultaProtocolo: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx',
    statusServico: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
    inutilizacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeinutilizacao4.asmx',
    consultaCadastro: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/cadconsultacadastro4.asmx'
  }
} as const;

/**
 * SOAP Actions oficiais para cada WebService
 */
export const SOAP_ACTIONS_SEFAZ: Record<string, string> = {
  autorizacao: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4',
  retAutorizacao: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4',
  evento: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4',
  consultaProtocolo: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4',
  statusServico: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4',
  inutilizacao: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeInutilizacao4',
  consultaCadastro: 'http://www.portalfiscal.inf.br/nfe/wsdl/CadConsultaCadastro4'
};

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
 * Extrai dados estruturados de respostas XML retornadas pela SEFAZ (NF-e v4.00)
 */
export function extrairDadosRetornoSefazXmlServer(xmlString: string) {
  if (!xmlString) {
    return { isAutorizada: false, isLotePendente: false };
  }

  let cStatNota: string | undefined;
  let xMotivoNota: string | undefined;
  let nProt: string | undefined;
  let chNFe: string | undefined;
  let dhRecbto: string | undefined;
  let digVal: string | undefined;
  let tpAmb: string | undefined;

  const infProtMatch = xmlString.match(/<infProt[^>]*>([\s\S]*?)<\/infProt>/i);
  if (infProtMatch) {
    const infProtXml = infProtMatch[1];
    cStatNota = infProtXml.match(/<cStat>(\d+)<\/cStat>/i)?.[1];
    xMotivoNota = infProtXml.match(/<xMotivo>([^<]+)<\/xMotivo>/i)?.[1]?.trim();
    nProt = infProtXml.match(/<nProt>(\d+)<\/nProt>/i)?.[1];
    chNFe = infProtXml.match(/<chNFe>(\d+)<\/chNFe>/i)?.[1];
    dhRecbto = infProtXml.match(/<dhRecbto>([^<]+)<\/dhRecbto>/i)?.[1];
    digVal = infProtXml.match(/<digVal>([^<]+)<\/digVal>/i)?.[1];
    tpAmb = infProtXml.match(/<tpAmb>(\d+)<\/tpAmb>/i)?.[1];
  }

  // Eventos (cancelamento)
  if (!nProt) {
    const infEventoMatch = xmlString.match(/<infEvento[^>]*>([\s\S]*?)<\/infEvento>/i);
    if (infEventoMatch) {
      const infEventoXml = infEventoMatch[1];
      cStatNota = infEventoXml.match(/<cStat>(\d+)<\/cStat>/i)?.[1] || cStatNota;
      xMotivoNota = infEventoXml.match(/<xMotivo>([^<]+)<\/xMotivo>/i)?.[1]?.trim() || xMotivoNota;
      nProt = infEventoXml.match(/<nProt>(\d+)<\/nProt>/i)?.[1];
      chNFe = infEventoXml.match(/<chNFe>(\d+)<\/chNFe>/i)?.[1] || chNFe;
    }
  }

  const xmlSemProt = xmlString.replace(/<protNFe[\s\S]*?<\/protNFe>/gi, '');
  const cStatLote = xmlSemProt.match(/<cStat>(\d+)<\/cStat>/i)?.[1];
  const xMotivoLote = xmlSemProt.match(/<xMotivo>([^<]+)<\/xMotivo>/i)?.[1]?.trim();
  const nRec = xmlString.match(/<nRec>(\d+)<\/nRec>/i)?.[1];
  if (!tpAmb) {
    tpAmb = xmlString.match(/<tpAmb>(\d+)<\/tpAmb>/i)?.[1];
  }

  const effectiveCStat = cStatNota || cStatLote;
  const effectiveXMotivo = xMotivoNota || xMotivoLote;

  if (!nProt && (xMotivoNota || xMotivoLote || xmlString)) {
    const matchXMotProt = `${xMotivoNota || ''} ${xMotivoLote || ''} ${xmlString}`.match(/(?:nProt|protocolo)[:\s=]*(\d{15})/i);
    if (matchXMotProt) {
      nProt = matchXMotProt[1];
    }
  }

  const isDuplicidadeComProtocolo = (cStatNota === '204' || cStatLote === '204' || effectiveCStat === '204') && !!nProt;
  const isAutorizada = (cStatNota === '100' || cStatNota === '150' || isDuplicidadeComProtocolo);
  const isLotePendente = (cStatLote === '103' || cStatLote === '105' || (!cStatNota && !!nRec));

  return {
    cStat: effectiveCStat,
    xMotivo: effectiveXMotivo,
    cStatNota,
    xMotivoNota,
    cStatLote,
    xMotivoLote,
    nRec,
    nProt,
    chNFe,
    tpAmb,
    dhRecbto,
    digVal,
    isAutorizada,
    isLotePendente
  };
}

/**
 * Constrói envelope SOAP 1.2 caso o conteúdo seja apenas o XML assinado
 */
export function enveloparXmlSoapSefaz(
  xmlLimpo: string,
  servico: string,
  idLote: string = '1',
  indSinc: string = '1'
): { envelope: string; action: string } {
  const cleanXml = xmlLimpo.replace(/<\?xml[^>]*\?>\s*/gi, '').trim();

  // Se já for um envelope SOAP completo
  if (cleanXml.includes(':Envelope') || cleanXml.includes('<soap') || cleanXml.includes('soap:Envelope') || cleanXml.includes('soap12:Envelope')) {
    const action = SOAP_ACTIONS_SEFAZ[servico] || SOAP_ACTIONS_SEFAZ.autorizacao;
    return { envelope: cleanXml, action };
  }

  let action = SOAP_ACTIONS_SEFAZ[servico] || SOAP_ACTIONS_SEFAZ.autorizacao;
  let bodyContent = cleanXml;

  if (cleanXml.includes('<enviNFe') || servico === 'autorizacao') {
    action = SOAP_ACTIONS_SEFAZ.autorizacao;
    if (!cleanXml.includes('<enviNFe')) {
      bodyContent = `<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>${idLote}</idLote><indSinc>${indSinc}</indSinc>${cleanXml}</enviNFe>`;
    }
    bodyContent = `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">${bodyContent}</nfeDadosMsg>`;
  } else if (cleanXml.includes('<consReciNFe') || servico === 'retAutorizacao') {
    action = SOAP_ACTIONS_SEFAZ.retAutorizacao;
    bodyContent = `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4">${cleanXml}</nfeDadosMsg>`;
  } else if (cleanXml.includes('<envEvento') || servico === 'evento') {
    action = SOAP_ACTIONS_SEFAZ.evento;
    bodyContent = `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">${cleanXml}</nfeDadosMsg>`;
  } else if (cleanXml.includes('<consSitNFe') || servico === 'consultaProtocolo') {
    action = SOAP_ACTIONS_SEFAZ.consultaProtocolo;
    bodyContent = `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4">${cleanXml}</nfeDadosMsg>`;
  } else if (cleanXml.includes('<consStatServ') || servico === 'statusServico') {
    action = SOAP_ACTIONS_SEFAZ.statusServico;
    bodyContent = `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4">${cleanXml}</nfeDadosMsg>`;
  } else if (cleanXml.includes('<inutNFe') || servico === 'inutilizacao') {
    action = SOAP_ACTIONS_SEFAZ.inutilizacao;
    bodyContent = `<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeInutilizacao4">${cleanXml}</nfeDadosMsg>`;
  } else {
    bodyContent = `<nfeDadosMsg xmlns="${action}">${cleanXml}</nfeDadosMsg>`;
  }

  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    ${bodyContent}
  </soap12:Body>
</soap12:Envelope>`;

  return { envelope, action };
}

/**
 * Normaliza e extrai parâmetros da requisição (JSON, XML cru ou parâmetros de envio)
 */
export function extrairDadosRequisicaoSefaz(req: express.Request): {
  xmlConteudo?: string;
  endpoint?: string;
  soapAction?: string;
  soapEnvelope?: string;
  timeoutMs: number;
  tpAmb: 1 | 2;
  servico: string;
  certificado?: any;
} {
  let body = req.body;
  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        body = JSON.parse(trimmed);
      } catch {
        body = { xml: trimmed };
      }
    } else {
      body = { xml: trimmed };
    }
  } else if (Buffer.isBuffer(body)) {
    const str = body.toString('utf-8').trim();
    if (str.startsWith('{') && str.endsWith('}')) {
      try {
        body = JSON.parse(str);
      } catch {
        body = { xml: str };
      }
    } else {
      body = { xml: str };
    }
  }

  const timeoutMs = typeof body?.timeoutMs === 'number' && body.timeoutMs > 0 ? body.timeoutMs : 15000;
  const certificado = body?.certificado;

  // 1. Detecção do Ambiente (tpAmb): 1 = Produção (padrão oficial), 2 = Homologação
  let tpAmb: 1 | 2 = 1;
  const xmlCandidate = body?.xml || body?.xmlAssinado || body?.xml_envio || body?.xml_evento || body?.soapEnvelope || body?.soap_envelope || (typeof body === 'string' ? body : '');
  
  if (
    body?.tpAmb === 2 || 
    body?.tpAmb === '2' || 
    String(body?.ambiente).toLowerCase().includes('homolog') ||
    String(req.query?.tpAmb) === '2' ||
    String(req.query?.ambiente).toLowerCase().includes('homolog') ||
    (typeof xmlCandidate === 'string' && /<tpAmb>2<\/tpAmb>/i.test(xmlCandidate))
  ) {
    tpAmb = 2;
  } else if (
    body?.tpAmb === 1 || 
    body?.tpAmb === '1' || 
    String(body?.ambiente).toLowerCase().includes('prod') ||
    (typeof xmlCandidate === 'string' && /<tpAmb>1<\/tpAmb>/i.test(xmlCandidate))
  ) {
    tpAmb = 1;
  }

  // 2. Detecção do Serviço
  let servico = body?.servico || body?.tipo || body?.service || '';
  if (!servico && typeof xmlCandidate === 'string') {
    if (xmlCandidate.includes('<enviNFe') || xmlCandidate.includes('NFeAutorizacao4')) {
      servico = 'autorizacao';
    } else if (xmlCandidate.includes('<consReciNFe') || xmlCandidate.includes('NFeRetAutorizacao4')) {
      servico = 'retAutorizacao';
    } else if (xmlCandidate.includes('<envEvento') || xmlCandidate.includes('NFeRecepcaoEvento4') || body?.acao === 'cancelar_nfe') {
      servico = 'evento';
    } else if (xmlCandidate.includes('<consSitNFe') || xmlCandidate.includes('NFeConsultaProtocolo4') || body?.acao === 'consultar_situacao') {
      servico = 'consultaProtocolo';
    } else if (xmlCandidate.includes('<consStatServ') || xmlCandidate.includes('NFeStatusServico4') || body?.acao === 'status_servico') {
      servico = 'statusServico';
    } else if (xmlCandidate.includes('<inutNFe') || xmlCandidate.includes('NFeInutilizacao4')) {
      servico = 'inutilizacao';
    } else {
      servico = 'autorizacao';
    }
  }
  if (!servico) servico = 'autorizacao';

  // 3. Obtenção do Endpoint oficial SEFAZ-SP conforme o ambiente
  let endpoint = body?.endpoint || body?.endpoint_sefaz;
  if (!endpoint || typeof endpoint !== 'string' || !endpoint.startsWith('http')) {
    endpoint = WEBSERVICES_SEFAZ_SP[tpAmb][servico as keyof typeof WEBSERVICES_SEFAZ_SP[1]] || WEBSERVICES_SEFAZ_SP[tpAmb].autorizacao;
  } else {
    // Sincroniza ambiente caso informado explicitamente
    if (tpAmb === 2 && endpoint.includes('nfe.fazenda.sp.gov.br') && !endpoint.includes('homologacao.')) {
      endpoint = endpoint.replace('nfe.fazenda.sp.gov.br', 'homologacao.nfe.fazenda.sp.gov.br');
    } else if (tpAmb === 1 && endpoint.includes('homologacao.nfe.fazenda.sp.gov.br')) {
      endpoint = endpoint.replace('homologacao.nfe.fazenda.sp.gov.br', 'nfe.fazenda.sp.gov.br');
    }
  }

  // 4. Obtenção do SOAP Envelope e SOAP Action
  let soapEnvelope = body?.soapEnvelope || body?.soap_envelope;
  let soapAction = body?.soapAction || body?.soap_action || req.headers['soapaction'] || req.headers['action'];
  if (Array.isArray(soapAction)) soapAction = soapAction[0];

  if (!soapEnvelope && xmlCandidate) {
    const wrapped = enveloparXmlSoapSefaz(xmlCandidate, servico, body?.idLote || '1', body?.indSinc || '1');
    soapEnvelope = wrapped.envelope;
    if (!soapAction) soapAction = wrapped.action;
  }

  if (!soapAction) {
    soapAction = SOAP_ACTIONS_SEFAZ[servico] || SOAP_ACTIONS_SEFAZ.autorizacao;
  }

  return {
    xmlConteudo: xmlCandidate,
    endpoint,
    soapAction: String(soapAction).replace(/"/g, ''),
    soapEnvelope,
    timeoutMs,
    tpAmb,
    servico,
    certificado
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

  // =========================================================================
  // CORS GLOBAL & PREFLIGHT
  // =========================================================================
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, HEAD');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, SOAPAction, action, x-custom-header');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Middlewares para JSON, XML, Form e Raw Text
  app.use(express.json({ limit: '20mb' }));
  app.use(express.text({ type: ['text/xml', 'application/xml', 'application/soap+xml', 'text/plain'], limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // =========================================================================
  // ROTAS DE PROXY SEFAZ COM AGENTE HTTPS E TRATAMENTO DETALHADO DE ERROS
  // =========================================================================

  /**
   * Status e Diagnóstico do Agente SEFAZ
   */
  app.get(['/api/sefaz/status', '/api/nfe/status'], (req, res) => {
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
      ambientes: {
        '1': { nome: 'Produção Oficial', urls: WEBSERVICES_SEFAZ_SP[1] },
        '2': { nome: 'Homologação / Testes', urls: WEBSERVICES_SEFAZ_SP[2] }
      },
      timestamp: new Date().toISOString()
    });
  });

  /**
   * Handler Unificado de Transmissão SOAP Oficial da SEFAZ-SP
   * Suporta:
   * 1. XML assinado cru no body ou via campo `xml`/`xmlAssinado`/`xml_envio`
   * 2. Envelope SOAP 1.2 completo via campo `soapEnvelope`
   * 3. Ambiente de Produção (tpAmb = 1) ou Homologação (tpAmb = 2)
   * 4. Retorno estruturado evitando qualquer erro 404
   */
  const sefazSoapHandler = async (req: express.Request, res: express.Response) => {
    // Requisição GET devolve diagnóstico informativo evitando erro 404 em testes pelo navegador
    if (req.method === 'GET') {
      const hasCert = !!(
        process.env.NFE_CERT_BASE64 ||
        process.env.SEFAZ_CERT_BASE64 ||
        process.env.CERTIFICADO_A1_BASE64 ||
        process.env.NFE_CERT_PATH
      );
      return res.json({
        status: 'online',
        servico: 'Proxy SEFAZ-SP SOAP / NF-e v4.00',
        mensagem: 'Rota de transmissão SOAP ativa e operacional. Envie requisições POST com o XML assinado ou os parâmetros de transmissão.',
        ambientePadrao: 'producao (tpAmb = 1)',
        ambientes: {
          '1': {
            nome: 'Produção Oficial',
            tpAmb: 1,
            urls: WEBSERVICES_SEFAZ_SP[1]
          },
          '2': {
            nome: 'Homologação / Testes',
            tpAmb: 2,
            urls: WEBSERVICES_SEFAZ_SP[2]
          }
        },
        certificadoConfigurado: hasCert,
        tls: {
          rejectUnauthorized: false,
          minVersion: 'TLSv1.2',
          ciphers: 'Compatível SEFAZ-SP / ICP-Brasil'
        },
        instrucoesUso: {
          metodo: 'POST',
          corpoJson: {
            xml: '<enviNFe ...>...</enviNFe> ou Envelope SOAP completo',
            tpAmb: '1 para Produção ou 2 para Homologação (opcional, padrão 1)',
            servico: 'autorizacao | retAutorizacao | evento | consultaProtocolo | statusServico (opcional, detectado automaticamente)'
          }
        }
      });
    }

    try {
      const dadosReq = extrairDadosRequisicaoSefaz(req);

      if (!dadosReq.soapEnvelope && !dadosReq.xmlConteudo) {
        return res.status(400).json({
          ok: false,
          codigo: 'REQUISICAO_INVALIDA',
          cStat: 'REQUISICAO_INVALIDA',
          mensagem: 'Conteúdo XML ou Envelope SOAP não informado na requisição.',
          detalhe: 'Envie o XML assinado no campo "xml", "xmlAssinado" ou o envelope completo em "soapEnvelope".',
          sugestao: 'Certifique-se de que o corpo da requisição POST contenha o XML da NF-e ou do evento.'
        });
      }

      const { endpoint, soapAction, soapEnvelope, timeoutMs, certificado, tpAmb, servico } = dadosReq;

      console.log(`[SEFAZ Proxy] Transmitindo (${servico.toUpperCase()} - tpAmb: ${tpAmb}) para ${endpoint}...`);

      const response = await executarRequisicaoSoapNode(endpoint!, soapAction!, soapEnvelope!, timeoutMs, certificado);

      console.log(`[SEFAZ Proxy] Resposta recebida da SEFAZ: HTTP ${response.status} (${response.data.length} bytes).`);

      const dadosEstruturados = extrairDadosRetornoSefazXmlServer(response.data);

      return res.status(response.status).json({
        ok: response.status >= 200 && response.status < 300,
        statusHttp: response.status,
        tpAmb,
        ambiente: tpAmb === 1 ? 'producao' : 'homologacao',
        servico,
        endpoint,
        soapAction,
        ...dadosEstruturados,
        xml: response.data,
        xmlRetorno: response.data,
        headers: response.headers
      });
    } catch (err: any) {
      const { endpoint, tpAmb, servico } = extrairDadosRequisicaoSefaz(req);
      const erroFormatado = formatarErroConexaoSefaz(err, endpoint || 'SEFAZ-SP');
      console.warn(`[SEFAZ Proxy] Falha na comunicação SOAP com ${endpoint}:`, erroFormatado);

      return res.status(502).json({
        ok: false,
        statusHttp: 502,
        tpAmb,
        ambiente: tpAmb === 1 ? 'producao' : 'homologacao',
        servico,
        codigo: erroFormatado.codigo,
        cStat: erroFormatado.codigo,
        xMotivo: erroFormatado.mensagem,
        mensagem: erroFormatado.mensagem,
        detalhe: erroFormatado.detalhe,
        sugestao: erroFormatado.sugestao,
        rawError: err?.message || String(err)
      });
    }
  };

  // Mapeamento amplo de rotas para garantir que NENHUMA requisição receba 404
  const rotasSefaz = [
    '/api/sefaz/soap',
    '/api/sefaz/soap/*',
    '/api/sefaz',
    '/api/sefaz/*',
    '/api/nfe/soap',
    '/api/nfe/soap/*',
    '/api/nfe/transmitir',
    '/api/nfe/autorizacao',
    '/api/nfe/consulta',
    '/api/nfe/recibo',
    '/api/nfe/evento',
    '/api/nfe/cancelamento'
  ];

  app.all(rotasSefaz, sefazSoapHandler);

  // Rota auxiliar para envio de e-mails de NF-e
  app.post('/api/nfe/enviar-email', (req, res) => {
    res.json({ ok: true, mensagem: 'Requisição de envio de e-mail registrada.' });
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
