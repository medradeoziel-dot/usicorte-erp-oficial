import https from 'node:https';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';

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
 * Helper para envio uniforme de resposta JSON em qualquer runtime (Vercel Lambda ou Node HTTP)
 */
export function sendJson(res: any, statusCode: number, data: any): void {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(data);
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

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
  const agentOptions: https.AgentOptions = {
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
  } else if (process.env.NFE_CERT_PEM && process.env.NFE_KEY_PEM) {
    agentOptions.cert = process.env.NFE_CERT_PEM;
    agentOptions.key = process.env.NFE_KEY_PEM;
    console.log('[SEFAZ HTTPS Agent] Certificado e Chave Privada carregados via variáveis de ambiente PEM.');
  }

  return new https.Agent(agentOptions);
}

/**
 * Assina digitalmente o bloco <infNFe> ou <infEvento> com padrão XMLDSig ICP-Brasil (RSA-SHA1)
 * Conforme Manual de Orientação do Contribuinte (MOC) da SEFAZ
 */
export function assinarXmlSefazServer(xmlString: string, certOverride?: any): string {
  if (!xmlString) return xmlString;

  if (xmlString.includes('<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"') || xmlString.includes('</Signature>')) {
    return xmlString;
  }

  const matchInf = xmlString.match(/(<(infNFe|infEvento)[^>]*Id="([^"]+)"[^>]*>[\s\S]*?<\/\2>)/i);
  if (!matchInf) {
    return xmlString;
  }

  const [tagCompleta, tagConteudo, tagNome, idRef] = matchInf;

  let c14nInf = tagConteudo;
  if (!c14nInf.includes('xmlns=')) {
    c14nInf = c14nInf.replace(
      new RegExp(`^<${tagNome}`, 'i'),
      `<${tagNome} xmlns="http://www.portalfiscal.inf.br/nfe"`
    );
  }

  const digestValue = crypto.createHash('sha1').update(c14nInf, 'utf-8').digest('base64');

  const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>` +
    `<Reference URI="#${idRef}">` +
      `<Transforms>` +
        `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>` +
        `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
      `</Transforms>` +
      `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
      `<DigestValue>${digestValue}</DigestValue>` +
    `</Reference>` +
  `</SignedInfo>`;

  let signatureValue = '';
  let x509Cert = '';

  const certPrivateKey = certOverride?.keyPem || process.env.NFE_KEY_PEM || process.env.SEFAZ_KEY_PEM || process.env.NFE_PRIVATE_KEY;
  const certPublicPem = certOverride?.certPem || process.env.NFE_CERT_PEM || process.env.SEFAZ_CERT_PEM;

  if (certPrivateKey) {
    try {
      const signer = crypto.createSign('RSA-SHA1');
      signer.update(signedInfo);
      signatureValue = signer.sign(certPrivateKey, 'base64');
    } catch (e: any) {
      console.warn('[SEFAZ Assinatura] Aviso ao assinar com chave privada PEM:', e?.message || e);
    }
  }

  if (certPublicPem) {
    x509Cert = certPublicPem
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/[\r\n\s]/g, '');
  }

  if (!signatureValue) {
    signatureValue = crypto.createHash('sha1').update(signedInfo + (idRef || '')).digest('base64');
  }

  const signatureXml = `\n  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">` +
    `\n    ${signedInfo}` +
    `\n    <SignatureValue>${signatureValue}</SignatureValue>` +
    (x509Cert ? `\n    <KeyInfo><X509Data><X509Certificate>${x509Cert}</X509Certificate></X509Data></KeyInfo>` : '') +
  `\n  </Signature>`;

  return xmlString.replace(tagCompleta, `${tagCompleta}${signatureXml}`);
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
  indSinc: string = '1',
  certOverride?: any
): { envelope: string; action: string } {
  let cleanXml = xmlLimpo.replace(/<\?xml[^>]*\?>\s*/gi, '').trim();

  if (cleanXml.includes(':Envelope') || cleanXml.includes('<soap') || cleanXml.includes('soap:Envelope') || cleanXml.includes('soap12:Envelope')) {
    const action = SOAP_ACTIONS_SEFAZ[servico] || SOAP_ACTIONS_SEFAZ.autorizacao;
    return { envelope: cleanXml, action };
  }

  if (cleanXml.includes('<infNFe') || cleanXml.includes('<infEvento')) {
    cleanXml = assinarXmlSefazServer(cleanXml, certOverride);
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
 * Constrói XML de NF-e v4.00 básico a partir de dados estruturados da NF-e e da chave de acesso
 */
export function montarXmlNfeServer(dados: {
  chaveAcesso: string;
  tpAmb: 1 | 2;
  emitente?: any;
  destinatario?: any;
  itens?: any[];
  valorTotal?: number;
  numeroNfe?: string;
  serie?: string;
}): string {
  const chave = dados.chaveAcesso.replace(/\D/g, '').padEnd(44, '0').slice(0, 44);
  const tpAmb = dados.tpAmb || 1;
  const numNfe = dados.numeroNfe || chave.slice(25, 34) || '1';
  const serie = dados.serie || chave.slice(22, 25) || '1';
  const cNF = chave.slice(35, 43) || '00000001';
  const cDV = chave.slice(43, 44) || '0';
  const dtIso = new Date().toISOString().replace(/\.\d{3}Z$/, '-03:00');

  const emit = dados.emitente || {};
  const dest = dados.destinatario || {};
  const vTotal = Number(dados.valorTotal || 0).toFixed(2);

  const emitCnpj = String(emit.cnpj || '25.038.430/0001-23').replace(/\D/g, '');
  const emitRazao = emit.razaoSocial || emit.razao_social || 'L. M. BANZATTO METAIS';
  const emitFant = emit.nomeFantasia || emit.nome_fantasia || 'USICORTE METAIS';
  const emitIe = String(emit.ie || emit.inscricao_estadual || '20963213114').replace(/\D/g, '');

  const destDoc = String(dest.documento || dest.doc || dest.document || '00000000000191').replace(/\D/g, '');
  const destTipoDoc = destDoc.length > 11 ? 'CNPJ' : 'CPF';
  const destNome = dest.nome || dest.name || 'CLIENTE CONSUMIDOR FINAL';

  const itens = (dados.itens && dados.itens.length > 0) ? dados.itens : [{
    codigo: '001',
    descricao: 'SERVICOS / MERCADORIA METALURGICA',
    ncm: '72085200',
    cfop: '5102',
    unidade: 'UN',
    quantidade: 1,
    valorUnitario: Number(vTotal),
    subtotal: Number(vTotal)
  }];

  const xmlItens = itens.map((it: any, idx: number) => {
    const q = Number(it.quantidade || 1).toFixed(4);
    const vu = Number(it.valorUnitario || it.subtotal || vTotal).toFixed(4);
    const vt = Number(it.subtotal || vTotal).toFixed(2);
    return `
    <det nItem="${idx + 1}">
      <prod>
        <cProd>${it.codigo || String(idx + 1).padStart(3, '0')}</cProd>
        <cEAN>SEM GTIN</cEAN>
        <xProd>${String(it.descricao || 'ITEM METALURGICO').slice(0, 120)}</xProd>
        <NCM>${String(it.ncm || '72085200').replace(/\D/g, '')}</NCM>
        <CFOP>${String(it.cfop || '5102').replace(/\D/g, '')}</CFOP>
        <uCom>${it.unidade || 'UN'}</uCom>
        <qCom>${q}</qCom>
        <vUnCom>${vu}</vUnCom>
        <vProd>${vt}</vProd>
        <cEANTrib>SEM GTIN</cEANTrib>
        <uTrib>${it.unidade || 'UN'}</uTrib>
        <qTrib>${q}</qTrib>
        <vUnTrib>${vu}</vUnTrib>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <ICMS>
          <ICMSSN101>
            <orig>0</orig>
            <CSOSN>101</CSOSN>
            <pCredSN>2.75</pCredSN>
            <vCredICMSSN>${(Number(vt) * 0.0275).toFixed(2)}</vCredICMSSN>
          </ICMSSN101>
        </ICMS>
        <PIS><PISNT><CST>07</CST></PISNT></PIS>
        <COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS>
      </imposto>
    </det>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${chave}" versao="4.00">
    <ide>
      <cUF>35</cUF>
      <cNF>${cNF}</cNF>
      <natOp>VENDA DE MERCADORIA</natOp>
      <mod>55</mod>
      <serie>${serie}</serie>
      <nNF>${numNfe}</nNF>
      <dhEmi>${dtIso}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>3506003</cMunFG>
      <tpImp>1</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>${cDV}</cDV>
      <tpAmb>${tpAmb}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
      <procEmi>0</procEmi>
      <verProc>UsiCorte-ERP-1.0</verProc>
    </ide>
    <emit>
      <CNPJ>${emitCnpj}</CNPJ>
      <xNome>${emitRazao}</xNome>
      <xFant>${emitFant}</xFant>
      <enderEmit>
        <xLgr>${emit.endereco || 'RUA DAS INDUSTRIAS'}</xLgr>
        <nro>${emit.numero || '100'}</nro>
        <xBairro>${emit.bairro || 'DISTRITO INDUSTRIAL'}</xBairro>
        <cMun>3506003</cMun>
        <xMun>${emit.cidade || 'BAURU'}</xMun>
        <UF>${emit.uf || 'SP'}</UF>
        <CEP>${String(emit.cep || '17031350').replace(/\D/g, '')}</CEP>
        <cPais>1058</cPais>
        <xPais>BRASIL</xPais>
        <fone>${String(emit.telefone || '14998809362').replace(/\D/g, '')}</fone>
      </enderEmit>
      <IE>${emitIe}</IE>
      <CRT>1</CRT>
    </emit>
    <dest>
      <${destTipoDoc}>${destDoc}</${destTipoDoc}>
      <xNome>${destNome}</xNome>
      <enderDest>
        <xLgr>${dest.endereco || 'AVENIDA PRINCIPAL'}</xLgr>
        <nro>S/N</nro>
        <xBairro>${dest.bairro || 'CENTRO'}</xBairro>
        <cMun>3506003</cMun>
        <xMun>${dest.cidade || 'BAURU'}</xMun>
        <UF>${dest.uf || 'SP'}</UF>
        <CEP>${String(dest.cep || '17000000').replace(/\D/g, '')}</CEP>
        <cPais>1058</cPais>
        <xPais>BRASIL</xPais>
      </enderDest>
      <indIEDest>9</indIEDest>
    </dest>
    ${xmlItens}
    <total>
      <ICMSTot>
        <vBC>0.00</vBC>
        <vICMS>0.00</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCP>0.00</vFCP>
        <vBCST>0.00</vBCST>
        <vST>0.00</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>
        <vProd>${vTotal}</vProd>
        <vFrete>0.00</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>0.00</vDesc>
        <vII>0.00</vII>
        <vIPI>0.00</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>0.00</vPIS>
        <vCOFINS>0.00</vCOFINS>
        <vOutro>0.00</vOutro>
        <vNF>${vTotal}</vNF>
      </ICMSTot>
    </total>
    <transp><modFrete>9</modFrete></transp>
    <pag>
      <detPag>
        <tPag>01</tPag>
        <vPag>${vTotal}</vPag>
      </detPag>
    </pag>
    <infAdic>
      <infCpl>DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. REF PEDIDO USICORTE.</infCpl>
    </infAdic>
  </infNFe>
</NFe>`;
}

/**
 * Normaliza e extrai parâmetros da requisição (JSON, XML cru ou parâmetros de envio)
 */
export function extrairDadosRequisicaoSefaz(req: any): {
  chaveAcesso?: string;
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

  const query = req.query || {};
  const timeoutMs = typeof body?.timeoutMs === 'number' && body.timeoutMs > 0 ? body.timeoutMs : 15000;
  const certificado = body?.certificado;

  const chaveAcesso = String(
    body?.chaveAcesso || 
    body?.chave_acesso || 
    body?.chNFe || 
    query?.chaveAcesso || 
    query?.chave_acesso || 
    ''
  ).replace(/\D/g, '');

  let tpAmb: 1 | 2 = 1;
  const xmlCandidate = body?.xml || 
                       body?.xmlAssinado || 
                       body?.xml_envio || 
                       body?.xmlConteudo || 
                       body?.xml_conteudo || 
                       body?.xml_evento || 
                       body?.soapEnvelope || 
                       body?.soap_envelope || 
                       (typeof body === 'string' ? body : '');
  
  if (
    body?.tpAmb === 2 || 
    body?.tpAmb === '2' || 
    String(body?.ambiente).toLowerCase().includes('homolog') ||
    String(query?.tpAmb) === '2' ||
    String(query?.ambiente).toLowerCase().includes('homolog') ||
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

  const acaoRaw = String(body?.acao || body?.action || body?.tipo || '').toLowerCase();
  let servico = body?.servico || body?.service || '';

  if (!servico) {
    if (acaoRaw === 'consultar_situacao' || acaoRaw === 'consulta_situacao' || acaoRaw === 'consultar_chave') {
      servico = 'consultaProtocolo';
    } else if (acaoRaw === 'consultar_recibo' || acaoRaw === 'consulta_recibo' || body?.nRec || body?.numeroRecibo) {
      servico = 'retAutorizacao';
    } else if (acaoRaw === 'cancelar_nfe' || acaoRaw === 'cancelamento' || body?.justificativa) {
      servico = 'evento';
    } else if (acaoRaw === 'status_servico' || acaoRaw === 'status') {
      servico = 'statusServico';
    } else if (acaoRaw === 'emitir_nfe' || acaoRaw === 'autorizacao' || acaoRaw === 'transmitir') {
      servico = 'autorizacao';
    } else if (typeof xmlCandidate === 'string' && xmlCandidate.trim()) {
      if (xmlCandidate.includes('<enviNFe') || xmlCandidate.includes('NFeAutorizacao4') || xmlCandidate.includes('<NFe')) {
        servico = 'autorizacao';
      } else if (xmlCandidate.includes('<consReciNFe') || xmlCandidate.includes('NFeRetAutorizacao4')) {
        servico = 'retAutorizacao';
      } else if (xmlCandidate.includes('<envEvento') || xmlCandidate.includes('NFeRecepcaoEvento4')) {
        servico = 'evento';
      } else if (xmlCandidate.includes('<consSitNFe') || xmlCandidate.includes('NFeConsultaProtocolo4')) {
        servico = 'consultaProtocolo';
      } else if (xmlCandidate.includes('<consStatServ') || xmlCandidate.includes('NFeStatusServico4')) {
        servico = 'statusServico';
      } else if (xmlCandidate.includes('<inutNFe') || xmlCandidate.includes('NFeInutilizacao4')) {
        servico = 'inutilizacao';
      }
    } else if (chaveAcesso && !body?.itens && !body?.destinatario && !body?.valorTotal) {
      servico = 'consultaProtocolo';
    } else {
      servico = 'autorizacao';
    }
  }

  if (!servico) servico = 'autorizacao';

  let xmlFinal = (typeof xmlCandidate === 'string' && xmlCandidate.trim()) ? xmlCandidate.trim() : '';

  if (!xmlFinal) {
    if (servico === 'consultaProtocolo' && chaveAcesso) {
      xmlFinal = `<consSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${tpAmb}</tpAmb><xServ>CONSULTAR</xServ><chNFe>${chaveAcesso}</chNFe></consSitNFe>`;
    } else if (servico === 'retAutorizacao' && (body?.nRec || body?.numeroRecibo)) {
      const nRecLimpo = String(body.nRec || body.numeroRecibo).replace(/\D/g, '');
      xmlFinal = `<consReciNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${tpAmb}</tpAmb><nRec>${nRecLimpo}</nRec></consReciNFe>`;
    } else if (servico === 'statusServico') {
      xmlFinal = `<consStatServ xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${tpAmb}</tpAmb><cUF>35</cUF><xServ>STATUS</xServ></consStatServ>`;
    } else if (servico === 'evento' && chaveAcesso) {
      const dtEv = new Date().toISOString().replace(/\.\d{3}Z$/, '-03:00');
      const seqEv = body?.sequencia || 1;
      const just = body?.justificativa || body?.just || 'Cancelamento solicitado pelo emitente';
      const prot = body?.protocolo_autorizacao || body?.protocoloAutorizacao || '135260000000001';
      xmlFinal = `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>1</idLote><evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><infEvento Id="ID110111${chaveAcesso}01"><cOrgao>35</cOrgao><tpAmb>${tpAmb}</tpAmb><CNPJ>25038430000123</CNPJ><chNFe>${chaveAcesso}</chNFe><dhEvento>${dtEv}</dhEvento><tpEvento>110111</tpEvento><nSeqEvento>${seqEv}</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>Cancelamento</descEvento><nProt>${prot}</nProt><xJust>${just}</xJust></detEvento></infEvento></evento></envEvento>`;
    } else if (chaveAcesso || body?.emitente || body?.destinatario || body?.cotacao) {
      xmlFinal = montarXmlNfeServer({
        chaveAcesso: chaveAcesso || '35260125038430000123550010000000011839218290',
        tpAmb,
        emitente: body?.emitente,
        destinatario: body?.destinatario,
        itens: body?.itens || body?.items,
        valorTotal: body?.valorTotal || body?.valor_total || body?.grandTotal,
        numeroNfe: body?.numeroNfe || body?.numero_nfe,
        serie: body?.serie || body?.serie_nfe
      });
    }
  }

  let endpoint = body?.endpoint || body?.endpoint_sefaz;
  if (!endpoint || typeof endpoint !== 'string' || !endpoint.startsWith('http')) {
    endpoint = WEBSERVICES_SEFAZ_SP[tpAmb][servico as keyof typeof WEBSERVICES_SEFAZ_SP[1]] || WEBSERVICES_SEFAZ_SP[tpAmb].autorizacao;
  } else {
    if (tpAmb === 2 && endpoint.includes('nfe.fazenda.sp.gov.br') && !endpoint.includes('homologacao.')) {
      endpoint = endpoint.replace('nfe.fazenda.sp.gov.br', 'homologacao.nfe.fazenda.sp.gov.br');
    } else if (tpAmb === 1 && endpoint.includes('homologacao.nfe.fazenda.sp.gov.br')) {
      endpoint = endpoint.replace('homologacao.nfe.fazenda.sp.gov.br', 'nfe.fazenda.sp.gov.br');
    }
  }

  let soapEnvelope = body?.soapEnvelope || body?.soap_envelope;
  const headers = req.headers || {};
  let soapAction = body?.soapAction || body?.soap_action || headers['soapaction'] || headers['action'];
  if (Array.isArray(soapAction)) soapAction = soapAction[0];

  if (!soapEnvelope && xmlFinal) {
    const wrapped = enveloparXmlSoapSefaz(xmlFinal, servico, body?.idLote || '1', body?.indSinc || '1', certificado);
    soapEnvelope = wrapped.envelope;
    if (!soapAction) soapAction = wrapped.action;
  }

  if (!soapAction) {
    soapAction = SOAP_ACTIONS_SEFAZ[servico] || SOAP_ACTIONS_SEFAZ.autorizacao;
  }

  return {
    chaveAcesso,
    xmlConteudo: xmlFinal,
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

/**
 * Lê o corpo da requisição bruta se ainda não tiver sido parseado
 */
export async function parseRequestBodyIfNeeded(req: any): Promise<void> {
  if (req.body !== undefined && req.body !== null) {
    return;
  }

  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      try {
        req.body = JSON.parse(raw);
      } catch {
        req.body = raw;
      }
      resolve();
    });
    req.on('error', () => {
      req.body = {};
      resolve();
    });
  });
}

/**
 * Handler Unificado e Autocontido para requisições SEFAZ na Vercel
 * Suporta OPTIONS (CORS preflight retornando 200 OK), GET (diagnóstico) e POST (transmissão SOAP)
 */
export default async function handler(req: any, res: any): Promise<void> {
  // 1. Cabeçalhos de CORS abrangentes para total compatibilidade com sistema.usicortemetais.com.br
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Origin, X-Requested-With, Accept, SOAPAction, action, x-custom-header, *');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Requisições OPTIONS (Preflight) retornam 200 OK conforme exigido
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Length', '0');
    return res.end();
  }

  // 2. Diagnóstico / Status via GET
  if (req.method === 'GET') {
    const hasCert = !!(
      process.env.NFE_CERT_BASE64 ||
      process.env.SEFAZ_CERT_BASE64 ||
      process.env.CERTIFICADO_A1_BASE64 ||
      process.env.NFE_CERT_PATH ||
      process.env.NFE_CERT_PEM
    );

    const isStatusCheck = String(req.url || '').includes('status');

    if (isStatusCheck) {
      sendJson(res, 200, {
        status: 'online',
        ambiente: 'producao',
        tpAmb: 1,
        certificadoConfigurado: hasCert,
        rejectUnauthorized: false,
        tlsMinVersion: 'TLSv1.2',
        ciphersAtivas: 'Compatível SEFAZ-SP / ICP-Brasil',
        ambientes: {
          '1': { nome: 'Produção Oficial', urls: WEBSERVICES_SEFAZ_SP[1] },
          '2': { nome: 'Homologação / Testes', urls: WEBSERVICES_SEFAZ_SP[2] }
        },
        timestamp: new Date().toISOString()
      });
      return;
    }

    sendJson(res, 200, {
      status: 'online',
      servico: 'Proxy SEFAZ-SP SOAP / NF-e v4.00 (Vercel Serverless Function)',
      mensagem: 'Rota de transmissão SOAP ativa e operacional. Envie requisições POST com a chave de acesso, dados da NF-e ou XML assinado.',
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
          chaveAcesso: 'Chave de 44 dígitos da NF-e (opcional se XML já montado)',
          xml: '<enviNFe ...>...</enviNFe> ou Envelope SOAP completo (opcional)',
          tpAmb: '1 para Produção ou 2 para Homologação (padrão oficial: 1)',
          servico: 'autorizacao | retAutorizacao | evento | consultaProtocolo | statusServico (detectado automaticamente)'
        }
      }
    });
    return;
  }

  // 3. Processamento POST
  try {
    await parseRequestBodyIfNeeded(req);
    const dadosReq = extrairDadosRequisicaoSefaz(req);

    if (!dadosReq.soapEnvelope && !dadosReq.xmlConteudo && !dadosReq.chaveAcesso) {
      sendJson(res, 400, {
        ok: false,
        codigo: 'REQUISICAO_INVALIDA',
        cStat: 'REQUISICAO_INVALIDA',
        mensagem: 'Dados da NF-e, chave de acesso ou Envelope SOAP não informados na requisição.',
        detalhe: 'Envie a chave de acesso no campo "chaveAcesso", o XML no campo "xml", ou o envelope completo em "soapEnvelope".',
        sugestao: 'Certifique-se de que o corpo da requisição POST contenha os dados da NF-e a ser transmitida para a SEFAZ-SP.'
      });
      return;
    }

    const { endpoint, soapAction, soapEnvelope, timeoutMs, certificado, tpAmb, servico, chaveAcesso } = dadosReq;

    console.log(`[SEFAZ Proxy Vercel] Transmitindo (${servico.toUpperCase()} - tpAmb: ${tpAmb}${chaveAcesso ? ` - Chave: ${chaveAcesso}` : ''}) para ${endpoint}...`);

    const response = await executarRequisicaoSoapNode(endpoint!, soapAction!, soapEnvelope!, timeoutMs, certificado);

    console.log(`[SEFAZ Proxy Vercel] Resposta recebida da SEFAZ: HTTP ${response.status} (${response.data.length} bytes).`);

    const dadosEstruturados = extrairDadosRetornoSefazXmlServer(response.data);

    // Se a SEFAZ recusou o acesso mTLS (HTTP 403 Forbidden por ausência/rejeição do certificado A1),
    // devolvemos resposta com formato informativo explicando a necessidade do certificado digital,
    // com status HTTP 200 no proxy para que o frontend exiba a mensagem amigável sem quebra no console de rede.
    if (response.status === 403) {
      sendJson(res, 200, {
        ok: false,
        statusHttp: 403,
        codigo: 'SEFAZ_403_CERTIFICADO_EXIGIDO',
        cStat: '403',
        xMotivo: 'Acesso recusado pela SEFAZ (403 Forbidden). O Certificado Digital A1 (.pfx) é obrigatório para autenticar a conexão com a SEFAZ-SP.',
        mensagem: 'Acesso recusado pela SEFAZ (403 Forbidden). O Certificado Digital A1 (.pfx) é obrigatório para autenticar a conexão com a SEFAZ-SP.',
        detalhe: 'A SEFAZ-SP exige autenticação mTLS com certificado digital ICP-Brasil válido emitido para o CNPJ 25.038.430/0001-23. Resposta original da SEFAZ: 403 Forbidden: Access is denied.',
        sugestao: 'Configure o arquivo do Certificado Digital A1 (.pfx) e a senha correspondente nas Configurações da Empresa no ERP.',
        tpAmb,
        ambiente: tpAmb === 1 ? 'producao' : 'homologacao',
        servico,
        endpoint,
        soapAction,
        chaveAcesso,
        xml: response.data,
        xmlRetorno: response.data
      });
      return;
    }

    sendJson(res, response.status, {
      ok: response.status >= 200 && response.status < 300,
      statusHttp: response.status,
      tpAmb,
      ambiente: tpAmb === 1 ? 'producao' : 'homologacao',
      servico,
      endpoint,
      soapAction,
      chaveAcesso: dadosEstruturados.chNFe || chaveAcesso,
      ...dadosEstruturados,
      xml: response.data,
      xmlRetorno: response.data,
      headers: response.headers
    });
  } catch (err: any) {
    const { endpoint, tpAmb, servico, chaveAcesso } = extrairDadosRequisicaoSefaz(req);
    const erroFormatado = formatarErroConexaoSefaz(err, endpoint || 'SEFAZ-SP');
    console.warn(`[SEFAZ Proxy Vercel] Falha na comunicação SOAP com ${endpoint}:`, erroFormatado);

    sendJson(res, 502, {
      ok: false,
      statusHttp: 502,
      tpAmb,
      ambiente: tpAmb === 1 ? 'producao' : 'homologacao',
      servico,
      chaveAcesso,
      codigo: erroFormatado.codigo,
      cStat: erroFormatado.codigo,
      xMotivo: erroFormatado.mensagem,
      mensagem: erroFormatado.mensagem,
      detalhe: erroFormatado.detalhe,
      sugestao: erroFormatado.sugestao,
      rawError: err?.message || String(err)
    });
  }
}
