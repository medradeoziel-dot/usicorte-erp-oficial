import https from 'node:https';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import url from 'node:url';
import tls from 'node:tls';
import dotenv from 'dotenv';
import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Element as XmlElement } from '@xmldom/xmldom';

// Garante carregamento das variáveis de ambiente em qualquer modo de execução
dotenv.config();

/**
 * Correção do aviso [DEP0169] (url.parse() deprecation) no Node.js 22+
 * Redireciona o uso interno de bibliotecas legadas para a API padronizada WHATWG URL
 */
if (typeof (url as any).parse === 'function') {
  const originalUrlParse = (url as any).parse;
  (url as any).parse = function (urlString: string, parseQueryString?: boolean, slashesDenoteHost?: boolean): any {
    if (typeof urlString !== 'string') {
      return originalUrlParse.apply(this, arguments as any);
    }
    try {
      const hasProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(urlString);
      const parsed = hasProtocol ? new URL(urlString) : new URL(urlString, 'http://localhost');
      return {
        protocol: hasProtocol ? parsed.protocol : null,
        slashes: hasProtocol ? true : null,
        auth: (parsed.username || parsed.password) ? `${parsed.username}:${parsed.password}` : null,
        host: hasProtocol ? parsed.host : null,
        port: hasProtocol ? parsed.port : null,
        hostname: hasProtocol ? parsed.hostname : null,
        hash: parsed.hash || null,
        search: parsed.search || null,
        query: parseQueryString 
          ? Object.fromEntries(parsed.searchParams) 
          : (parsed.search ? parsed.search.slice(1) : null),
        pathname: parsed.pathname,
        path: `${parsed.pathname}${parsed.search}`,
        href: hasProtocol ? parsed.href : `${parsed.pathname}${parsed.search}${parsed.hash}`
      };
    } catch {
      return originalUrlParse.apply(this, arguments as any);
    }
  };
}

/**
 * Sanitiza mensagens de erro e logs para impedir qualquer vazamento
 * de senhas, passphrases, chaves privadas ou certificados
 */
export function sanitizarMensagemErro(msg: string): string {
  if (!msg || typeof msg !== 'string') return '';
  return msg
    .replace(/(password|passphrase|senha|secret|token)[:=\s]+[^\s,;&]+/gi, '$1: [REDACTED]')
    .replace(/-----BEGIN[A-Z\s]+PRIVATE KEY-----[\s\S]*?-----END[A-Z\s]+PRIVATE KEY-----/gi, '[PRIVATE KEY REDACTED]')
    .replace(/MIIG[A-Za-z0-9+/=]{30,}/g, '[CERTIFICATE BASE64 REDACTED]');
}

/**
 * Limpa e padroniza strings Base64 de Certificados Digitais A1 (.pfx/.p12)
 * Remove aspas acidentais, cabeçalhos data URI, banners PEM/PKCS12,
 * codificações URL e quebras de linha reais ou literais (\n, \r)
 */
export function limparCertificadoBase64(raw: string | undefined): string {
  if (!raw || typeof raw !== 'string') return '';
  let str = raw.trim();

  // Remove aspas ou barras de escape no início e no final (ex: "..." ou \"...\")
  str = str.replace(/^["'\\]+|["'\\]+$/g, '');

  // Remove prefixos data URI (ex: data:application/x-pkcs12;base64,)
  str = str.replace(/^data:[^;]+;base64,/i, '');

  // Remove possíveis cabeçalhos PEM / PKCS12
  str = str.replace(/-----BEGIN[A-Z0-9\s_-]+-----/gi, '');
  str = str.replace(/-----END[A-Z0-9\s_-]+-----/gi, '');

  // Remove quebras de linha literais (\n, \r) e espaços/tabs
  str = str.replace(/\\r/g, '').replace(/\\n/g, '');
  str = str.replace(/[\r\n\s\t]/g, '');

  // Se houver codificação URL (%2B -> +, %2F -> /, %3D -> =), decodifica
  if (str.includes('%2B') || str.includes('%2F') || str.includes('%3D')) {
    try {
      str = decodeURIComponent(str);
    } catch {
      // continua com a string original
    }
  }

  // Mantém estritamente caracteres válidos da base64
  return str.replace(/[^A-Za-z0-9+/=]/g, '');
}

/**
 * Limpa a senha do certificado removendo aspas acidentais vindas do painel do Vercel ou de arquivos .env
 */
export function limparSenhaCertificado(raw: string | undefined): string {
  if (!raw || typeof raw !== 'string') return '';
  let clean = raw.trim();
  clean = clean.replace(/^["']|["']$/g, '');
  clean = clean.replace(/^\\["']|\\["']$/g, '');
  return clean;
}

export interface CertificadoAmbienteResolvido {
  pfxBase64?: string;
  pfxPassword?: string;
  variavelBase64Nome?: string;
  variavelSenhaNome?: string;
  certPath?: string;
  certPathExiste: boolean;
  certPem?: string;
  keyPem?: string;
  origemCert: 'Base64' | 'Arquivo' | 'PEM' | 'Nenhum';
}

/**
 * Localiza com resiliência total o Certificado Digital A1 e sua senha no ambiente Vercel/Node.
 * 
 * Ordem de verificação:
 * 1. Overrides diretos passados no payload ou parâmetros
 * 2. Variáveis de ambiente oficiais do projeto (NFE_CERT_BASE64, CERTIFICADO_A1_BASE64, SEFAZ_CERT_BASE64)
 * 3. Variáveis de ambiente com prefixo VITE_ (comuns em projetos Vite no Vercel) e aliases
 * 4. Varredura insensível a maiúsculas/minúsculas no process.env (compatível com Linux no Vercel)
 * 5. Senhas associadas (NFE_CERT_PASSWORD, CERTIFICADO_A1_SENHA, SEFAZ_CERT_PASSWORD e aliases)
 * 6. Caminho local (com diagnóstico de incompatibilidade para Vercel Serverless)
 */
export function resolverVariavelAmbienteCertificado(override?: {
  pfxBase64?: string;
  pfxPassword?: string;
  certificadoBase64?: string;
  senhaCertificado?: string;
  senha?: string;
  password?: string;
  passphrase?: string;
  certPem?: string;
  keyPem?: string;
}): CertificadoAmbienteResolvido {
  // 1. Overrides diretos
  if (override?.pfxBase64 || override?.certificadoBase64) {
    const rawB64 = override.pfxBase64 || override.certificadoBase64;
    const rawPass = override.pfxPassword || override.senhaCertificado || override.senha || override.password || override.passphrase || '';
    return {
      pfxBase64: rawB64,
      pfxPassword: rawPass,
      variavelBase64Nome: 'override_direto',
      variavelSenhaNome: rawPass ? 'override_direto' : undefined,
      certPathExiste: false,
      origemCert: 'Base64'
    };
  }

  // 2. Busca pelas variáveis prioritárias do projeto
  const nomesBase64Prioritarios = [
    'NFE_CERT_BASE64',
    'CERTIFICADO_A1_BASE64',
    'SEFAZ_CERT_BASE64',
    'VITE_NFE_CERT_BASE64',
    'VITE_CERTIFICADO_A1_BASE64',
    'VITE_SEFAZ_CERT_BASE64',
    'CERTIFICADO_BASE64',
    'CERT_BASE64',
    'PFX_BASE64',
    'CERTIFICADO_A1_PFX',
    'CERTIFICADO_A1',
    'NFE_CERT'
  ];

  let pfxBase64: string | undefined;
  let variavelBase64Nome: string | undefined;

  for (const nome of nomesBase64Prioritarios) {
    const val = process.env[nome];
    if (val && typeof val === 'string' && val.trim().length > 20 && val.trim() !== 'undefined' && val.trim() !== 'null') {
      pfxBase64 = val;
      variavelBase64Nome = nome;
      break;
    }
  }

  // 3. Varredura insensível a maiúsculas/minúsculas no process.env
  if (!pfxBase64) {
    for (const [key, val] of Object.entries(process.env)) {
      if (val && typeof val === 'string' && val.trim().length > 20 && val.trim() !== 'undefined' && val.trim() !== 'null') {
        const lowerKey = key.toLowerCase();
        if (
          (lowerKey.includes('cert') || lowerKey.includes('pfx') || lowerKey.includes('a1')) &&
          (lowerKey.includes('base64') || lowerKey.includes('b64'))
        ) {
          pfxBase64 = val;
          variavelBase64Nome = key;
          break;
        }
      }
    }
  }

  // 4. Busca da senha do certificado
  const nomesSenhaPrioritarios = [
    'NFE_CERT_PASSWORD',
    'CERTIFICADO_A1_SENHA',
    'SEFAZ_CERT_PASSWORD',
    'VITE_NFE_CERT_PASSWORD',
    'VITE_CERTIFICADO_A1_SENHA',
    'VITE_SEFAZ_CERT_PASSWORD',
    'NFE_CERT_PASS',
    'NFE_SENHA',
    'SEFAZ_SENHA',
    'CERTIFICADO_SENHA',
    'CERTIFICADO_PASSWORD',
    'CERT_PASSWORD',
    'CERT_PASS',
    'PFX_PASSWORD'
  ];

  let pfxPassword: string | undefined;
  let variavelSenhaNome: string | undefined;

  for (const nome of nomesSenhaPrioritarios) {
    const val = process.env[nome];
    if (val !== undefined && val !== null && typeof val === 'string' && val.trim() !== 'undefined' && val.trim() !== 'null') {
      pfxPassword = val;
      variavelSenhaNome = nome;
      break;
    }
  }

  if (pfxPassword === undefined) {
    for (const [key, val] of Object.entries(process.env)) {
      if (val && typeof val === 'string' && val.trim() !== 'undefined' && val.trim() !== 'null') {
        const lowerKey = key.toLowerCase();
        if (
          (lowerKey.includes('cert') || lowerKey.includes('nfe') || lowerKey.includes('sefaz') || lowerKey.includes('a1')) &&
          (lowerKey.includes('senha') || lowerKey.includes('pass') || lowerKey.includes('secret'))
        ) {
          pfxPassword = val;
          variavelSenhaNome = key;
          break;
        }
      }
    }
  }

  // 5. Arquivo local
  const certPath = process.env.NFE_CERT_PATH || process.env.SEFAZ_CERT_PATH;
  let certPathExiste = false;
  if (certPath && typeof certPath === 'string' && certPath.trim()) {
    try {
      certPathExiste = fs.existsSync(certPath.trim());
    } catch {
      certPathExiste = false;
    }
  }

  // 6. PEM
  const certPem = override?.certPem || process.env.NFE_CERT_PEM || process.env.SEFAZ_CERT_PEM;
  const keyPem = override?.keyPem || process.env.NFE_KEY_PEM || process.env.SEFAZ_KEY_PEM;

  let origemCert: 'Base64' | 'Arquivo' | 'PEM' | 'Nenhum' = 'Nenhum';
  if (pfxBase64) {
    origemCert = 'Base64';
  } else if (certPathExiste) {
    origemCert = 'Arquivo';
  } else if (certPem && keyPem) {
    origemCert = 'PEM';
  }

  return {
    pfxBase64,
    pfxPassword: pfxPassword || '',
    variavelBase64Nome,
    variavelSenhaNome,
    certPath,
    certPathExiste,
    certPem,
    keyPem,
    origemCert
  };
}

/**
 * Formata certificados e chaves em formato PEM, convertendo \n literais para quebras reais
 */
export function formatarPem(raw: string | undefined): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  let clean = raw.trim().replace(/^["']|["']$/g, '');
  if (clean.includes('\\n')) {
    clean = clean.replace(/\\n/g, '\n');
  }
  return clean;
}

/**
 * Extrai com segurança as credenciais criptográficas (Chave Privada RSA em PEM e Certificado X.509 em Base64)
 * a partir de arquivos PKCS#12 (.pfx/.p12) ou variáveis de ambiente PEM
 */
export function extrairCredenciaisCertificado(certOverride?: any): {
  keyPem?: string;
  certPem?: string;
  x509CertB64?: string;
  hasCert: boolean;
  origem: string;
} {
  const envInfo = resolverVariavelAmbienteCertificado(certOverride);

  // 1. Se forneceu PEM direto
  if (envInfo.keyPem && envInfo.certPem) {
    const keyPem = formatarPem(envInfo.keyPem);
    const certPem = formatarPem(envInfo.certPem);
    const x509CertB64 = certPem
      ? certPem.replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '').replace(/[\r\n\s]/g, '')
      : undefined;
    return { keyPem, certPem, x509CertB64, hasCert: !!keyPem, origem: 'PEM' };
  }

  // 2. Se forneceu PKCS#12 (.pfx) em Base64 ou Arquivo
  let pfxBuffer: Buffer | undefined;
  if (envInfo.pfxBase64) {
    try {
      const cleanB64 = limparCertificadoBase64(envInfo.pfxBase64);
      pfxBuffer = Buffer.from(cleanB64, 'base64');
    } catch {}
  } else if (envInfo.certPath && envInfo.certPathExiste) {
    try {
      pfxBuffer = fs.readFileSync(envInfo.certPath);
    } catch {}
  }

  if (pfxBuffer && pfxBuffer.length > 0) {
    try {
      const cleanPassword = limparSenhaCertificado(envInfo.pfxPassword);
      const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, cleanPassword || '');

      let keyPem: string | undefined;
      let certPem: string | undefined;
      let x509CertB64: string | undefined;

      const chaves: any[] = [];
      const certs: any[] = [];
      for (const sc of p12.safeContents) {
        for (const sb of sc.safeBags) {
          if (sb.key) chaves.push(sb.key);
          if (sb.cert) certs.push(sb.cert);
        }
      }

      const ehCA = (c: any) => {
        const bc = c.extensions?.find((e: any) => e.name === 'basicConstraints');
        return !!(bc && bc.cA === true);
      };
      const mod = (k: any) => (k && k.n ? k.n.toString(16) : '');

      // Escolhe o certificado da EMPRESA (folha), que corresponde à chave privada
      let chaveSel: any = undefined;
      let certSel: any = undefined;
      for (const k of chaves) {
        const c = certs.find(c => mod(c.publicKey) === mod(k) && !ehCA(c)) || certs.find(c => mod(c.publicKey) === mod(k));
        if (c) { chaveSel = k; certSel = c; break; }
      }
      if (!chaveSel) chaveSel = chaves[0];
      if (!certSel) certSel = certs.find(c => !ehCA(c)) || certs[0];

      if (chaveSel) keyPem = forge.pki.privateKeyToPem(chaveSel);
      if (certSel) {
        certPem = forge.pki.certificateToPem(certSel);
        const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certSel)).getBytes();
        x509CertB64 = Buffer.from(certDer, 'binary').toString('base64').replace(/[\r\n\s]/g, '');
        const cn = certSel.subject?.getField?.('CN')?.value || 'desconhecido';
        console.log(`[SEFAZ Cert] Certificado selecionado para assinatura: "${cn}" | válido até ${certSel.validity?.notAfter?.toISOString?.()} | ${certs.length} certificado(s) no PFX`);
      }

      return {
        keyPem,
        certPem,
        x509CertB64,
        hasCert: !!keyPem,
        origem: envInfo.variavelBase64Nome || 'PKCS12'
      };
    } catch (e: any) {
      console.warn('[SEFAZ Cert] Falha ao extrair chave e certificado do PKCS#12:', sanitizarMensagemErro(e?.message || String(e)));
    }
  }

  return { hasCert: false, origem: 'Nenhum' };
}

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
// SOAPAction oficial da SEFAZ exige o nome da operação no final (ex.: .../NFeConsultaProtocolo4/nfeConsultaNF).
// Sem ele a SEFAZ-SP responde HTTP 500 (SOAP Fault) e a nota nunca é consultada/transmitida.
const OPERACOES_SOAP_SEFAZ: Record<string, string> = {
  NFeAutorizacao4: 'nfeAutorizacaoLote',
  NFeRetAutorizacao4: 'nfeRetAutorizacaoLote',
  NFeRecepcaoEvento4: 'nfeRecepcaoEvento',
  NFeConsultaProtocolo4: 'nfeConsultaNF',
  NFeStatusServico4: 'nfeStatusServicoNF',
  NFeInutilizacao4: 'nfeInutilizacaoNF',
  CadConsultaCadastro4: 'consultaCadastro'
};
export function normalizarSoapActionSefaz(action: string): string {
  const a = String(action || '').trim().replace(/\/+$/, '');
  const m = a.match(/\/wsdl\/([A-Za-z0-9]+)$/);
  if (m && OPERACOES_SOAP_SEFAZ[m[1]]) return `${a}/${OPERACOES_SOAP_SEFAZ[m[1]]}`;
  return a;
}

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

export interface AgenteHttpsSefazResultado {
  agent: https.Agent;
  hasCert: boolean;
  certType: string;
  variavelCertOrigem?: string;
  tamanhoBytes?: number;
  validacaoStatus: 'valido' | 'falha' | 'nao_configurado';
  detalheValidacao?: string;
}

/**
 * Cria e configura o Agente HTTPS com suporte a Certificado Digital A1 e TLS 1.2
 * para comunicação oficial com os WebServices da SEFAZ (mTLS).
 * Valida o arquivo PKCS#12 e a senha via tls.createSecureContext sem expor segredos.
 */
export function criarAgenteHttpsSefaz(certOverride?: {
  pfxBase64?: string;
  pfxPassword?: string;
  certificadoBase64?: string;
  senhaCertificado?: string;
  senha?: string;
  password?: string;
  passphrase?: string;
  certPem?: string;
  keyPem?: string;
}): AgenteHttpsSefazResultado {
  const SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION = (crypto.constants as any).SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION || 0x00040000;
  const SSL_OP_LEGACY_SERVER_CONNECT = crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT || 0x00000004;

  const agentOptions: https.AgentOptions = {
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2',
    secureOptions: SSL_OP_LEGACY_SERVER_CONNECT | SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION,
    ciphers: [
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-ECDSA-AES128-GCM-SHA256',
      'ECDHE-ECDSA-AES256-GCM-SHA384',
      'AES128-GCM-SHA256',
      'AES256-GCM-SHA384',
      'DEFAULT@SECLEVEL=1',
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

  const envInfo = resolverVariavelAmbienteCertificado(certOverride);

  let hasCert = false;
  let certType = 'Nenhum';
  let validacaoStatus: 'valido' | 'falha' | 'nao_configurado' = 'nao_configurado';
  let detalheValidacao: string | undefined;
  let tamanhoBytes: number | undefined;

  // 1. Carregamento via Base64 (cenário principal do Vercel e produção)
  if (envInfo.pfxBase64 && envInfo.pfxBase64.trim().length > 20) {
    try {
      const cleanBase64 = limparCertificadoBase64(envInfo.pfxBase64);
      const cleanPassword = limparSenhaCertificado(envInfo.pfxPassword);
      const pfxBuffer = Buffer.from(cleanBase64, 'base64');
      tamanhoBytes = pfxBuffer.length;

      if (pfxBuffer.length < 50) {
        detalheValidacao = `Buffer do certificado possui apenas ${pfxBuffer.length} bytes (esperado > 50 bytes). Formato Base64 inválido.`;
        validacaoStatus = 'falha';
        console.warn(`[SEFAZ HTTPS Agent] ⚠️ ${detalheValidacao}`);
      } else {
        // Validação criptográfica do arquivo PKCS#12 e da senha via TLS SecureContext
        let validadoComSucesso = false;
        try {
          tls.createSecureContext({ pfx: pfxBuffer, passphrase: cleanPassword });
          validadoComSucesso = true;
          validacaoStatus = 'valido';
          detalheValidacao = 'Certificado PKCS#12 e senha validados com sucesso no OpenSSL.';
        } catch (valErr: any) {
          const errMsg = String(valErr?.message || valErr || '');
          validacaoStatus = 'falha';
          if (errMsg.toLowerCase().includes('mac verify failure') || errMsg.toLowerCase().includes('bad decrypt')) {
            detalheValidacao = `Senha incorreta para o Certificado Digital A1 (variável: ${envInfo.variavelSenhaNome || 'NFE_CERT_PASSWORD'}). Verifique a senha configurada no Vercel.`;
            console.warn(`[SEFAZ HTTPS Agent] ❌ Erro de Senha: A senha configurada em ${envInfo.variavelSenhaNome || 'NFE_CERT_PASSWORD'} não corresponde ao arquivo .pfx (OpenSSL: mac verify failure).`);
          } else {
            detalheValidacao = `Falha ao decodificar PKCS#12 (.pfx): ${sanitizarMensagemErro(errMsg)}. Verifique se a string Base64 não foi corrompida.`;
            console.warn(`[SEFAZ HTTPS Agent] ❌ Falha na validação PKCS#12 (${envInfo.variavelBase64Nome || 'Base64'}): ${sanitizarMensagemErro(errMsg)}`);
          }
        }

        // Aplica credenciais no agente HTTPS
        agentOptions.pfx = pfxBuffer;
        agentOptions.passphrase = cleanPassword;
        hasCert = true;
        certType = 'A1_PKCS12_Base64';

        if (validadoComSucesso) {
          console.log(`[SEFAZ HTTPS Agent] ✅ Certificado Digital A1 (.pfx) carregado e validado com sucesso! (${pfxBuffer.length} bytes, variável: ${envInfo.variavelBase64Nome || 'override'}, senha: ${envInfo.variavelSenhaNome ? 'fornecida' : 'não informada'}).`);
        } else {
          console.warn(`[SEFAZ HTTPS Agent] ⚠️ Certificado Digital A1 carregado (${pfxBuffer.length} bytes), mas houve alerta de validação: ${detalheValidacao}`);
        }
      }
    } catch (e: any) {
      detalheValidacao = `Erro ao decodificar Base64: ${sanitizarMensagemErro(e?.message || String(e))}`;
      validacaoStatus = 'falha';
      console.warn(`[SEFAZ HTTPS Agent] ❌ ${detalheValidacao}`);
    }
  } else if (envInfo.certPath) {
    if (envInfo.certPathExiste) {
      try {
        const cleanPassword = limparSenhaCertificado(envInfo.pfxPassword);
        const pfxBuffer = fs.readFileSync(envInfo.certPath);
        tamanhoBytes = pfxBuffer.length;
        agentOptions.pfx = pfxBuffer;
        agentOptions.passphrase = cleanPassword;
        hasCert = true;
        certType = 'A1_Arquivo_Local';
        validacaoStatus = 'valido';
        console.log(`[SEFAZ HTTPS Agent] ✅ Certificado Digital carregado do arquivo local: ${envInfo.certPath} (${pfxBuffer.length} bytes).`);
      } catch (e: any) {
        detalheValidacao = `Falha ao ler arquivo local: ${sanitizarMensagemErro(e?.message || String(e))}`;
        validacaoStatus = 'falha';
        console.warn(`[SEFAZ HTTPS Agent] ❌ ${detalheValidacao}`);
      }
    } else {
      detalheValidacao = `A variável NFE_CERT_PATH ("${envInfo.certPath}") foi definida, mas o arquivo não foi encontrado no Vercel. Funções serverless não compartilham disco local. Configure o certificado em NFE_CERT_BASE64 com o conteúdo em Base64.`;
      console.warn(`[SEFAZ HTTPS Agent] ⚠️ ${detalheValidacao}`);
    }
  } else if (envInfo.certPem && envInfo.keyPem) {
    agentOptions.cert = formatarPem(envInfo.certPem);
    agentOptions.key = formatarPem(envInfo.keyPem);
    hasCert = true;
    certType = 'PEM_Env';
    validacaoStatus = 'valido';
    console.log('[SEFAZ HTTPS Agent] ✅ Certificado e Chave Privada carregados via PEM.');
  }

  if (!hasCert) {
    console.warn('[SEFAZ HTTPS Agent] ⚠️ ATENÇÃO: Nenhum Certificado Digital A1 foi detectado no ambiente do Vercel. As requisições mTLS para a SEFAZ serão rejeitadas com HTTP 403 Forbidden.');
    console.warn('[SEFAZ HTTPS Agent] ℹ️ Como configurar: No Vercel, acesse Project Settings > Environment Variables e adicione NFE_CERT_BASE64 (arquivo .pfx em Base64) e NFE_CERT_PASSWORD (senha) no ambiente Production.');
  }

  return { 
    agent: new https.Agent(agentOptions), 
    hasCert, 
    certType, 
    variavelCertOrigem: envInfo.variavelBase64Nome, 
    tamanhoBytes, 
    validacaoStatus, 
    detalheValidacao 
  };
}

/**
 * Remove estritamente caracteres de edição (espaços em branco, quebras de linha \r e \n, tabulações)
 * que estejam situados entre tags XML (> <), no início ou no fim do documento.
 * Preserva integralmente os textos internos das tags (descrições de produtos, nomes, endereços e valores fiscais).
 * Elimina Byte Order Mark (BOM: \uFEFF) e comentários XML proibidos pelos schemas da SEFAZ.
 */
export function compactarXmlSefaz(xml: string): string {
  if (!xml || typeof xml !== 'string') return '';
  return xml
    .replace(/^[\uFEFF\u200B\u200C\u200D\u2060]+/, '')
    .replace(/[\uFEFF\u200B\u200C\u200D\u2060]/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>[\s\r\n\t\u00A0]+</g, '><')
    .replace(/\s+\/>/g, '/>')
    .trim();
}

/** XMLDSig: C14N 1.0 real, nunca hash de texto XML montado manualmente. */
const NS_NFE = 'http://www.portalfiscal.inf.br/nfe';
const NS_DSIG = 'http://www.w3.org/2000/09/xmldsig#';
const C14N_NFE = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';

function lerXmlAssinatura(xml: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('DTD e entidades externas não são permitidas no XML fiscal.');
  return new DOMParser({ onError: () => { throw new Error('XML fiscal malformado.'); } }).parseFromString(xml, 'text/xml');
}

function alvosAssinatura(doc: ReturnType<typeof lerXmlAssinatura>) {
  return Array.from(doc.getElementsByTagNameNS(NS_NFE, '*')).filter(
    el => el.localName === 'infNFe' || el.localName === 'infEvento'
  );
}

/** Confere digest e RSA no documento exato que será enviado, sem chamar a SEFAZ. */
export function validarAssinaturaXmlSefaz(xml: string, certificadoEsperado?: string): void {
  const doc = lerXmlAssinatura(xml);
  const alvos = alvosAssinatura(doc);
  const ids = new Set<string>();
  for (const el of Array.from(doc.getElementsByTagName('*'))) {
    const id = el.getAttribute('Id');
    if (id && ids.has(id)) throw new Error('XML fiscal contém Id duplicado.');
    if (id) ids.add(id);
  }
  for (const alvo of alvos) {
    const id = alvo.getAttribute('Id');
    const pai = alvo.parentNode;
    if (!id || !pai) throw new Error('Bloco fiscal sem Id ou sem elemento pai.');
    const signatures = Array.from(pai.childNodes).filter(
      node => node.nodeType === 1 && (node as XmlElement).localName === 'Signature' && (node as XmlElement).namespaceURI === NS_DSIG
    );
    if (signatures.length !== 1) throw new Error('Bloco fiscal deve possuir exatamente uma assinatura.');
    const signature = signatures[0] as XmlElement;
    const refs = signature.getElementsByTagNameNS(NS_DSIG, 'Reference');
    if (refs.length !== 1 || refs.item(0)?.getAttribute('URI') !== `#${id}`) {
      throw new Error('Referência da assinatura não corresponde ao bloco fiscal.');
    }
    const b64 = signature.getElementsByTagNameNS(NS_DSIG, 'X509Certificate').item(0)?.textContent?.replace(/\s/g, '');
    if (!b64) throw new Error('Certificado ausente na assinatura fiscal.');
    const cert = new crypto.X509Certificate(Buffer.from(b64, 'base64'));
    const verifier = new SignedXml({ publicCert: certificadoEsperado || cert.toString(), getCertFromKeyInfo: () => null });
    verifier.loadSignature(signature as any);
    if (!verifier.checkSignature(xml)) throw new Error('Assinatura XML inválida na verificação local. A nota não foi enviada.');
  }
}

export function assinarXmlSefazServer(xmlString: string, certOverride?: any): string {
  if (!xmlString) return xmlString;
  const doc = lerXmlAssinatura(xmlString);
  const alvos = alvosAssinatura(doc);
  if (!alvos.length) {
    if (/<(?:[\w.-]+:)?(?:infNFe|infEvento)\b/.test(xmlString)) {
      throw new Error('Bloco fiscal sem namespace oficial da NF-e. A nota não foi enviada.');
    }
    return xmlString;
  }
  const creds = extrairCredenciaisCertificado(certOverride);
  if (!creds.keyPem || !creds.certPem || !creds.x509CertB64) {
    throw new Error('Não foi possível assinar a NF-e com o Certificado Digital A1 (chave ou certificado ausente). A nota não foi enviada.');
  }
  const cert = new crypto.X509Certificate(creds.certPem);
  if (!cert.checkPrivateKey(crypto.createPrivateKey(creds.keyPem))) {
    throw new Error('A chave privada não corresponde ao certificado da assinatura. A nota não foi enviada.');
  }
  const ids = new Set<string>();
  for (const el of Array.from(doc.getElementsByTagName('*'))) {
    const id = el.getAttribute('Id');
    if (id && ids.has(id)) throw new Error('XML fiscal contém Id duplicado.');
    if (id) ids.add(id);
  }
  for (const alvo of alvos) {
    const id = alvo.getAttribute('Id');
    const pai = alvo.parentNode;
    if (!id || !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(id) || !pai || pai.nodeType !== 1) {
      throw new Error('Bloco fiscal com Id inválido ou sem elemento pai.');
    }
    // Não reutiliza a assinatura antiga enviada pelo navegador.
    for (const node of Array.from(pai.childNodes)) {
      if (node.nodeType === 1 && (node as XmlElement).localName === 'Signature' && (node as XmlElement).namespaceURI === NS_DSIG) pai.removeChild(node);
    }
    // Torna explícitos os namespaces herdados para a assinatura continuar válida
    // tanto no SOAP completo quanto após a extração da NF-e pelo destinatário.
    const container = pai as XmlElement;
    let ancestral = container.parentNode;
    while (ancestral && ancestral.nodeType === 1) {
      for (const attr of Array.from((ancestral as XmlElement).attributes)) {
        if ((attr.name === 'xmlns' || attr.prefix === 'xmlns') && !container.hasAttribute(attr.name)) {
          container.setAttributeNS('http://www.w3.org/2000/xmlns/', attr.name, attr.value);
        }
      }
      ancestral = ancestral.parentNode;
    }
  }
  let resultado = new XMLSerializer().serializeToString(doc);
  for (const alvo of alvos) {
    const id = alvo.getAttribute('Id');
    const xpath = `//*[@Id='${id}']`;
    const signer = new SignedXml({
      privateKey: creds.keyPem,
      publicCert: creds.certPem,
      canonicalizationAlgorithm: C14N_NFE,
      signatureAlgorithm: `${NS_DSIG}rsa-sha1`,
    });
    signer.addReference({ xpath, transforms: [`${NS_DSIG}enveloped-signature`, C14N_NFE], digestAlgorithm: `${NS_DSIG}sha1` });
    signer.computeSignature(resultado, { location: { reference: `${xpath}/..`, action: 'append' } });
    resultado = signer.getSignedXml();
  }
  validarAssinaturaXmlSefaz(resultado, creds.certPem);
  console.log('[SEFAZ Assinatura] C14N 1.0: digest e assinatura RSA verificados localmente.');
  return resultado;
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
  const rawMsg = sanitizarMensagemErro(String(err?.message || err || ''));

  if (code.includes('ECONNRESET')) {
    return {
      codigo: 'ECONNRESET',
      mensagem: `Conexão resetada pelo servidor da SEFAZ (${endpoint}).`,
      detalhe: `O firewall ou servidor do fisco encerrou a conexão abruptamente (Connection Reset). Causa comum: ausência de certificado digital A1 válido ou rejeição de handshake TLS pelo gateway da SEFAZ.`,
      sugestao: 'Certifique-se de que o certificado A1 (.pfx) esteja ativo nas variáveis de ambiente do Vercel e que a SEFAZ-SP não esteja passando por oscilação.'
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
      sugestao: 'Renove o certificado A1 da empresa e atualize a chave NFE_CERT_BASE64 no Vercel.'
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
      detalhe: `O webservice da SEFAZ exigiu autenticação mTLS (mútua) com Certificado Digital A1 válido. Mensagem: ${rawMsg}`,
      sugestao: 'Configure o arquivo do Certificado Digital A1 (.pfx em Base64) e a senha nas variáveis de ambiente NFE_CERT_BASE64 e NFE_CERT_PASSWORD.'
    };
  }

  if (code.includes('ENOTFOUND') || code.includes('EAI_AGAIN')) {
    return {
      codigo: 'DNS_ERROR',
      mensagem: `Não foi possível resolver o endereço da SEFAZ (${endpoint}).`,
      detalhe: `Falha na consulta DNS do domínio da SEFAZ.`,
      sugestao: 'Verifique a conexão de rede e a disponibilidade dos servidores de DNS.'
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
  if (!xmlString || typeof xmlString !== 'string' || !xmlString.trim()) {
    return {
      isAutorizada: false,
      isLotePendente: false,
      isFault: false,
      tipoResposta: 'resposta_vazia',
      cStat: 'XML_VAZIO',
      xMotivo: 'Resposta vazia retornada pela SEFAZ'
    };
  }

  if (!xmlString.includes('<')) {
    return {
      isAutorizada: false,
      isLotePendente: false,
      isFault: false,
      tipoResposta: 'resposta_vazia',
      cStat: 'NAO_XML',
      xMotivo: xmlString.trim().slice(0, 300) || 'Resposta da SEFAZ não possui formato XML'
    };
  }

  // 1. Verificação explícita de SOAP Fault (<soap:Fault> ou <env:Fault>)
  let isFault = false;
  let faultCode: string | undefined;
  let faultString: string | undefined;

  const faultMatch = xmlString.match(/<(?:\w+:)?Fault[^>]*>([\s\S]*?)<\/(?:\w+:)?Fault>/i);
  if (faultMatch) {
    isFault = true;
    const faultXml = faultMatch[1];
    faultCode = faultXml.match(/<(?:\w+:)?(?:faultcode|Value)>([^<]+)<\/(?:\w+:)?(?:faultcode|Value)>/i)?.[1]?.trim();
    faultString = faultXml.match(/<(?:\w+:)?faultstring>([^<]+)<\/(?:\w+:)?faultstring>/i)?.[1]?.trim()
      || faultXml.match(/<(?:\w+:)?Text[^>]*>([^<]+)<\/(?:\w+:)?Text>/i)?.[1]?.trim()
      || faultXml.match(/<(?:\w+:)?Reason[^>]*>([\s\S]*?)<\/(?:\w+:)?Reason>/i)?.[1]?.replace(/<[^>]+>/g, '').trim();
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

  let effectiveCStat = cStatNota || cStatLote;
  let effectiveXMotivo = xMotivoNota || xMotivoLote;

  if (isFault && (!effectiveCStat || effectiveCStat === '100')) {
    effectiveCStat = faultCode || 'SOAP_FAULT';
    effectiveXMotivo = faultString || effectiveXMotivo || 'Falha SOAP na comunicação com a SEFAZ';
  }

  if (!nProt && (xMotivoNota || xMotivoLote || xmlString)) {
    const matchXMotProt = `${xMotivoNota || ''} ${xMotivoLote || ''} ${xmlString}`.match(/(?:nProt|protocolo)[:\s=]*(\d{15})/i);
    if (matchXMotProt) {
      nProt = matchXMotProt[1];
    }
  }

  const isDuplicidadeComProtocolo = (cStatNota === '204' || cStatLote === '204' || effectiveCStat === '204') && !!nProt;
  const isAutorizada = (cStatNota === '100' || cStatNota === '150' || isDuplicidadeComProtocolo) && !isFault;
  const isLotePendente = (cStatLote === '103' || cStatLote === '105' || (!cStatNota && !!nRec)) && !isFault;
  const isConsumoIndevido = cStatLote === '656' || cStatNota === '656' || effectiveCStat === '656';

  let tipoResposta = 'desconhecido';
  if (isAutorizada) {
    tipoResposta = 'autorizacao';
  } else if (isConsumoIndevido) {
    tipoResposta = 'consumo_indevido';
  } else if (isLotePendente) {
    tipoResposta = 'lote_pendente';
  } else if (isFault) {
    tipoResposta = 'soap_fault';
  } else if (effectiveCStat && effectiveCStat !== '100' && effectiveCStat !== '150') {
    tipoResposta = 'rejeicao_fiscal';
  }

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
    isLotePendente,
    isFault,
    isConsumoIndevido,
    tipoResposta,
    faultCode,
    faultString
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
  let cleanXml = compactarXmlSefaz(xmlLimpo.replace(/<\?xml[^>]*\?>\s*/gi, ''));

  if (cleanXml.includes(':Envelope') || cleanXml.includes('<soap') || cleanXml.includes('soap:Envelope') || cleanXml.includes('soap12:Envelope')) {
    const action = SOAP_ACTIONS_SEFAZ[servico] || SOAP_ACTIONS_SEFAZ.autorizacao;
    return { envelope: assinarXmlSefazServer(cleanXml, certOverride), action };
  }

  // Assina somente depois de montar o contexto SOAP completo.

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

  const envelope = compactarXmlSefaz(`<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>${bodyContent}</soap12:Body></soap12:Envelope>`);

  return { envelope: assinarXmlSefazServer(envelope, certOverride), action };
}

/**
 * Constrói XML de NF-e v4.00 básico a partir de dados estruturados da NF-e e da chave de acesso
 */
function escapeXmlSoap(unsafe: string | null | undefined): string {
  return String(unsafe || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function sanitizarTextoSoap(unsafe: string | null | undefined, maxLength?: number): string {
  if (!unsafe) return '';
  let clean = String(unsafe)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (maxLength && clean.length > maxLength) {
    clean = clean.slice(0, maxLength).trim();
  }
  return escapeXmlSoap(clean);
}

const TABELA_IBGE_MUNICIPIOS_SOAP: Record<string, string> = {
  'bauru': '3506003',
  'sao paulo': '3550308',
  'campinas': '3509502',
  'guarulhos': '3518800',
  'sao bernardo do campo': '3548708',
  'santo andre': '3547809',
  'osasco': '3534401',
  'sorocaba': '3552205',
  'ribeirao preto': '3543402',
  'sao jose dos campos': '3549904',
  'sao jose do rio preto': '3549805',
  'mogi das cruzes': '3530607',
  'jundiai': '3525904',
  'piracicaba': '3538709',
  'santos': '3548500',
  'maua': '3529401',
  'diadema': '3513801',
  'carapicuiba': '3510609',
  'itaquaquecetuba': '3523107',
  'franca': '3516200',
  'praia grande': '3541000',
  'guaruja': '3518701',
  'taubate': '3554102',
  'limeira': '3526902',
  'suzano': '3552502',
  'taboao da serra': '3552809',
  'sumare': '3552403',
  'barueri': '3505708',
  'embu das artes': '3515004',
  'sao carlos': '3548906',
  'indaiatuba': '3520509',
  'cotia': '3513009',
  'marilia': '3529005',
  'americana': '3501608',
  'araraquara': '3503208',
  'jacarei': '3524402',
  'hortolandia': '3519071',
  'presidente prudente': '3541406',
  'rio claro': '3543907',
  'aracatuba': '3502804',
  'santa barbara d oeste': '3545803',
  'ferraz de vasconcelos': '3515707',
  'francisco morato': '3516309',
  'itapecerica da serra': '3522208',
  'itu': '3523909',
  'braganca paulista': '3507605',
  'pindamonhangaba': '3538006',
  'itapetininga': '3522307',
  'sao caetano do sul': '3548807',
  'franco da rocha': '3516408',
  'mogi guacu': '3530706',
  'jau': '3525300',
  'botucatu': '3507506',
  'atibaia': '3504107',
  'santana de parnaiba': '3547304',
  'araras': '3503307',
  'cubatao': '3513504',
  'valinhos': '3556206',
  'sertaozinho': '3551702',
  'jandira': '3525003',
  'birigui': '3506508',
  'ribeirao pires': '3543303',
  'votorantim': '3557006',
  'barretos': '3505500',
  'catanduva': '3511102',
  'guaratingueta': '3518404',
  'salto': '3545209',
  'tatui': '3554003',
  'ourinhos': '3534708',
  'paulinia': '3536505',
  'assis': '3504008',
  'leme': '3526704',
  'itapevi': '3522505',
  'lencois paulista': '3526803',
  'agudos': '3500709',
  'pederneiras': '3536703',
  'piratininga': '3539103',
  'macatuba': '3528007',
  'barra bonita': '3505500',
  'lins': '3527108',
  'avare': '3504503',
  'vinhedo': '3556701',
  'rio de janeiro': '3304557',
  'belo horizonte': '3106200',
  'curitiba': '4106902',
  'porto alegre': '4314902',
  'florianopolis': '4205407',
  'goiania': '5208707',
  'brasilia': '5300108',
  'salvador': '2927408',
  'fortaleza': '2304400',
  'recife': '2611606',
  'manaus': '1302603',
  'belem': '1501402',
  'vitoria': '3205309',
  'cuiaba': '5103403',
  'campo grande': '5002704'
};

function obterCodigoIbgeMunicipioSoap(cidade?: string, uf?: string, codigoFornecido?: string, cep?: string): string {
  if (codigoFornecido) {
    const limpo = String(codigoFornecido).replace(/\D/g, '');
    if (limpo.length === 7) return limpo;
  }
  const cidNormalizada = (cidade || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (cidNormalizada && TABELA_IBGE_MUNICIPIOS_SOAP[cidNormalizada]) {
    return TABELA_IBGE_MUNICIPIOS_SOAP[cidNormalizada];
  }
  if (cidNormalizada.includes('bauru')) return '3506003';
  if (cidNormalizada.includes('sao paulo')) return '3550308';
  if (cidNormalizada.includes('campinas')) return '3509502';
  if (cidNormalizada.includes('piracicaba')) return '3538709';
  if (cidNormalizada.includes('ribeirao')) return '3543402';
  if (cidNormalizada.includes('sorocaba')) return '3552205';

  const cepDigitos = (cep || '').replace(/\D/g, '');
  if (cepDigitos.startsWith('170') || cepDigitos.startsWith('171')) {
    return '3506003';
  }
  const ufUpper = (uf || 'SP').trim().toUpperCase();
  if (ufUpper === 'SP') return '3506003';
  return '3506003';
}

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
  
  const dtIso = (() => {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      const parts = formatter.formatToParts(new Date());
      const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00';
      const y = getPart('year');
      const m = getPart('month');
      const d = getPart('day');
      const hh = getPart('hour');
      const mm = getPart('minute');
      const ss = getPart('second');
      return `${y}-${m}-${d}T${hh}:${mm}:${ss}-03:00`;
    } catch {
      return new Date().toISOString().replace(/\.\d{3}Z$/, '-03:00');
    }
  })();

  const emit = dados.emitente || {};
  const dest = dados.destinatario || {};
  const vTotal = Number(dados.valorTotal || 0).toFixed(2);

  const emitCnpj = String(emit.cnpj || '25038430000123').replace(/\D/g, '');
  const emitRazao = sanitizarTextoSoap(emit.razaoSocial || emit.razao_social || 'L. M. BANZATTO METAIS', 60);
  const emitFant = sanitizarTextoSoap(emit.nomeFantasia || emit.nome_fantasia || 'USICORTE METAIS', 60);
  const emitIe = String(emit.ie || emit.inscricao_estadual || '20963213114').replace(/\D/g, '');
  const emitCep = String(emit.cep || '17031350').replace(/\D/g, '').padEnd(8, '0').slice(0, 8);
  const emitFone = String(emit.telefone || '14998809362').replace(/\D/g, '');
  const rawEmitIbge = String(emit.codigoIbge || emit.ibge || emit.cMun || emit.ibgeCode || emit.ibge_cidade || '3506003').replace(/\D/g, '');
  const emitMunIbge = (rawEmitIbge.length === 7) ? rawEmitIbge : '3506003';

  const destDoc = String(dest.documento || dest.doc || dest.document || '00000000000191').replace(/\D/g, '');
  const destTipoDoc = destDoc.length <= 11 ? 'CPF' : 'CNPJ';
  const destNome = sanitizarTextoSoap(dest.nome || dest.name || 'CLIENTE CONSUMIDOR FINAL', 60);
  const destCep = String(dest.cep || '17000000').replace(/\D/g, '').padEnd(8, '0').slice(0, 8);
  const rawDestIe = String(dest.ie || dest.inscricaoEstadual || dest.inscricao_estadual || '').trim();
  const destIe = rawDestIe.replace(/\D/g, '');
  const isDestIeIsento = !destIe || rawDestIe.toUpperCase().includes('ISENTO');
  const destFone = String(dest.telefone || dest.phone || '').replace(/\D/g, '');
  const rawDestIbge = String(dest.codigoIbge || dest.ibge || dest.cMun || dest.ibgeCode || dest.ibge_cidade || '').replace(/\D/g, '');
  const destMunIbge = (rawDestIbge.length === 7) ? rawDestIbge : obterCodigoIbgeMunicipioSoap(dest.cidade || dest.city, dest.uf || dest.state, rawDestIbge, destCep);

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
    const cleanDesc = sanitizarTextoSoap(it.descricao || 'ITEM METALURGICO', 120);
    const cleanNcm = String(it.ncm || '72085200').replace(/\D/g, '').padEnd(8, '0').slice(0, 8);
    const cleanCfop = String(it.cfop || '5102').replace(/\D/g, '').slice(0, 4);
    const cleanUn = sanitizarTextoSoap(it.unidade || 'UN', 6);
    return `
    <det nItem="${idx + 1}">
      <prod>
        <cProd>${sanitizarTextoSoap(it.codigo || String(idx + 1).padStart(3, '0'), 60)}</cProd>
        <cEAN>SEM GTIN</cEAN>
        <xProd>${cleanDesc}</xProd>
        <NCM>${cleanNcm}</NCM>
        <CFOP>${cleanCfop}</CFOP>
        <uCom>${cleanUn}</uCom>
        <qCom>${q}</qCom>
        <vUnCom>${vu}</vUnCom>
        <vProd>${vt}</vProd>
        <cEANTrib>SEM GTIN</cEANTrib>
        <uTrib>${cleanUn}</uTrib>
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
      <dhSaiEnt>${dtIso}</dhSaiEnt>
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
        <xLgr>${sanitizarTextoSoap(emit.endereco || emit.street || 'RUA CORONEL IVON CESAR PIMENTEL', 60)}</xLgr>
        <nro>${sanitizarTextoSoap(emit.numero || emit.number || '3-41', 60)}</nro>
        <xBairro>${sanitizarTextoSoap(emit.bairro || emit.neighborhood || 'PARQUE PAULISTA', 60)}</xBairro>
        <cMun>${emitMunIbge}</cMun>
        <xMun>${sanitizarTextoSoap(emit.cidade || emit.city || 'BAURU', 60)}</xMun>
        <UF>${(emit.uf || emit.state || 'SP').toUpperCase().slice(0, 2)}</UF>
        <CEP>${emitCep}</CEP>
        <cPais>1058</cPais>
        <xPais>BRASIL</xPais>
        ${emitFone ? `<fone>${emitFone}</fone>` : ''}
      </enderEmit>
      <IE>${emitIe}</IE>
      <CRT>1</CRT>
    </emit>
    <dest>
      <${destTipoDoc}>${destDoc}</${destTipoDoc}>
      <xNome>${destNome}</xNome>
      <enderDest>
        <xLgr>${sanitizarTextoSoap(dest.endereco || dest.street || 'AVENIDA PRINCIPAL', 60)}</xLgr>
        <nro>${sanitizarTextoSoap(dest.numero || dest.number || 'S/N', 60)}</nro>
        <xBairro>${sanitizarTextoSoap(dest.bairro || dest.neighborhood || 'CENTRO', 60)}</xBairro>
        <cMun>${destMunIbge}</cMun>
        <xMun>${sanitizarTextoSoap(dest.cidade || dest.city || 'BAURU', 60)}</xMun>
        <UF>${(dest.uf || dest.state || 'SP').toUpperCase().slice(0, 2)}</UF>
        <CEP>${destCep}</CEP>
        <cPais>1058</cPais>
        <xPais>BRASIL</xPais>
        ${destFone ? `<fone>${destFone}</fone>` : ''}
      </enderDest>
      <indIEDest>${dest.indicadorIe || dest.indIEDest || (isDestIeIsento ? '9' : '1')}</indIEDest>
      ${!isDestIeIsento && destIe.length >= 2 ? `<IE>${destIe}</IE>` : ''}
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
    <transp>
      <modFrete>9</modFrete>
    </transp>
    <pag>
      <detPag>
        <tPag>01</tPag>
        <vPag>${vTotal}</vPag>
      </detPag>
    </pag>
    <infAdic>
      <infCpl>${sanitizarTextoSoap(`DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. REF PEDIDO USICORTE.`, 5000)}</infCpl>
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

  // A tela exibe a chave em grupos ("3526 1025 ..."); se o XML do evento vier
  // do navegador com esses espacos, o Id da assinatura fica invalido.
  let chave44 = chaveAcesso;
  if (chave44.length !== 44) {
    const fonte = `${xmlFinal} ${body?.soapEnvelope || body?.soap_envelope || ''}`.replace(/[\s ]*/g, '');
    const m = fonte.match(/(?:chNFe>|ID110111|Id="NFe)(\d{44})/);
    if (m) chave44 = m[1];
  }
  if (chave44.length === 44) {
    const chaveComEspacos = new RegExp(chave44.split('').join('[\\s ]*'), 'g');
    xmlFinal = xmlFinal.replace(chaveComEspacos, chave44);
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
  if (typeof soapEnvelope === 'string' && chave44.length === 44) {
    const chaveComEspacos = new RegExp(chave44.split('').join('[\\s ]*'), 'g');
    soapEnvelope = soapEnvelope.replace(chaveComEspacos, chave44);
  }
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
 * Executa a requisição SOAP via HTTPS nativo do Node.js com o Agente mTLS configurado
 */
export function executarRequisicaoSoapNode(
  endpointUrl: string,
  soapAction: string,
  soapEnvelope: string,
  timeoutMs: number = 15000,
  certOverride?: any
): Promise<{ 
  status: number; 
  data: string; 
  headers: http.IncomingHttpHeaders; 
  hasCert: boolean; 
  certType: string;
  variavelCertOrigem?: string;
  validacaoStatus?: 'valido' | 'falha' | 'nao_configurado';
  detalheValidacao?: string;
}> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(endpointUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const { agent, hasCert, certType, variavelCertOrigem, validacaoStatus, detalheValidacao } = isHttps 
        ? criarAgenteHttpsSefaz(certOverride) 
        : { agent: undefined, hasCert: false, certType: 'HTTP', variavelCertOrigem: undefined, validacaoStatus: 'nao_configurado' as const, detalheValidacao: undefined };

      // Última transformação: compacta ANTES de reassinar e verificar.
      // Nenhuma alteração de espaços, tags ou namespaces após este ponto.
      const envelopeValidado = assinarXmlSefazServer(compactarXmlSefaz(soapEnvelope), certOverride);
      validarAssinaturaXmlSefaz(envelopeValidado);
      const bodyBuffer = Buffer.from(envelopeValidado, 'utf-8');

      const headers: Record<string, string | number> = {
        'Content-Type': `application/soap+xml; charset=utf-8; action="${normalizarSoapActionSefaz(soapAction)}"`,
        'Accept': 'application/soap+xml, application/xml, text/xml',
        'Content-Length': bodyBuffer.length,
        'SOAPAction': normalizarSoapActionSefaz(soapAction),
        'Host': parsedUrl.host,
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
            headers: res.headers,
            hasCert,
            certType,
            variavelCertOrigem,
            validacaoStatus,
            detalheValidacao
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
 * Suporta OPTIONS (CORS preflight retornando 200 OK), GET (diagnóstico seguro) e POST (transmissão SOAP mTLS)
 */
export default async function handler(req: any, res: any): Promise<void> {
  // 1. Cabeçalhos de CORS abrangentes para total compatibilidade com sistema.usicortemetais.com.br
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Origin, X-Requested-With, Accept, SOAPAction, action, x-custom-header, *');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Requisições OPTIONS (Preflight) retornam 200 OK
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Length', '0');
    return res.end();
  }

  // 2. Diagnóstico / Status via GET
  if (req.method === 'GET') {
    const isStatusCheck = String(req.url || '').includes('status') || String(req.url || '').includes('diagnostico');
    const agentCheck = criarAgenteHttpsSefaz();
    const envInfo = resolverVariavelAmbienteCertificado();

    const diagnostico = {
      status: 'online',
      servico: 'Proxy SEFAZ-SP SOAP / NF-e v4.00 (Vercel Serverless Function)',
      ambientePadrao: 'producao (tpAmb = 1)',
      tpAmb: 1,
      certificado: {
        configurado: agentCheck.hasCert,
        tipo: agentCheck.certType,
        variavelOrigem: agentCheck.variavelCertOrigem || null,
        tamanhoBytes: agentCheck.tamanhoBytes || 0,
        senhaConfigurada: !!envInfo.pfxPassword,
        variavelSenhaOrigem: envInfo.variavelSenhaNome || null,
        statusValidacao: agentCheck.validacaoStatus,
        detalheValidacao: agentCheck.detalheValidacao || (agentCheck.hasCert ? 'Certificado pronto para autenticação mTLS.' : 'Nenhum certificado detectado.')
      },
      certificadoConfigurado: agentCheck.hasCert,
      certificadoTipo: agentCheck.certType,
      tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2',
        ciphers: 'Compatível SEFAZ-SP / ICP-Brasil (mTLS)'
      },
      ambientes: {
        '1': { nome: 'Produção Oficial', urls: WEBSERVICES_SEFAZ_SP[1] },
        '2': { nome: 'Homologação / Testes', urls: WEBSERVICES_SEFAZ_SP[2] }
      },
      orientacoesVercel: agentCheck.hasCert
        ? `Certificado digital A1 configurado com sucesso via ${agentCheck.variavelCertOrigem || 'ambiente'}.`
        : 'Para emissão em produção, configure as variáveis NFE_CERT_BASE64 (arquivo .pfx convertido em Base64) e NFE_CERT_PASSWORD (senha) no painel de configurações de ambiente da Vercel (Project Settings > Environment Variables > Production).',
      timestamp: new Date().toISOString()
    };

    if (isStatusCheck) {
      sendJson(res, 200, diagnostico);
      return;
    }

    sendJson(res, 200, {
      ...diagnostico,
      mensagem: 'Rota de transmissão SOAP ativa e operacional. Envie requisições POST com a chave de acesso, dados da NF-e ou XML assinado.',
      instrucoesUso: {
        metodo: 'POST',
        corpoJson: {
          chaveAcesso: 'Chave de 44 dígitos da NF-e (opcional se XML já montado)',
          xml: '<enviNFe ...>...</enviNFe> ou Envelope SOAP completo (opcional)',
          tpAmb: '1 para Produção ou 2 para Homologação (padrão oficial: 1)',
          servico: 'autorizacao | retAutorizacao | evento | consultaProtocolo | statusServico'
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
        statusHttp: 400,
        codigo: 'REQUISICAO_INVALIDA',
        cStat: 'REQUISICAO_INVALIDA',
        mensagem: 'Dados da NF-e, chave de acesso ou Envelope SOAP não informados na requisição.',
        detalhe: 'Envie a chave de acesso no campo "chaveAcesso", o XML no campo "xml", ou o envelope completo em "soapEnvelope".',
        sugestao: 'Certifique-se de que o corpo da requisição POST contenha os dados da NF-e a ser transmitida para a SEFAZ-SP.'
      });
      return;
    }

    const { endpoint, soapAction, soapEnvelope, timeoutMs, certificado, tpAmb, servico, chaveAcesso } = dadosReq;

    let envelopeParaTransmissao = dadosReq.soapEnvelope || '';
    // Se o cliente enviou um nfeProc (NF-e + protNFe), extrai apenas a <NFe> para transmissão:
    // a SEFAZ rejeita enviNFe contendo nfeProc/protNFe com erro de schema.
    if (envelopeParaTransmissao.includes('<nfeProc')) {
      const mNfe = envelopeParaTransmissao.match(/<NFe xmlns="http:\/\/www\.portalfiscal\.inf\.br\/nfe"[\s\S]*?<\/NFe>/);
      if (mNfe) {
        console.warn('[SEFAZ Proxy Vercel] Envelope continha nfeProc/protNFe. Extraindo apenas a <NFe> para transmissão.');
        envelopeParaTransmissao = envelopeParaTransmissao.replace(/<nfeProc[\s\S]*?<\/nfeProc>/, mNfe[0]);
      }
    }
    // A função de envio reassina e valida o XML final, inclusive assinaturas antigas.

    console.log(`[SEFAZ Proxy Vercel] Transmitindo (${servico.toUpperCase()} - tpAmb: ${tpAmb}${chaveAcesso ? ` - Chave: ${chaveAcesso}` : ''}) para ${endpoint}...`);

    if (!endpoint || !soapAction) throw new Error('Endpoint ou ação SOAP não informado.');
    const response = await executarRequisicaoSoapNode(endpoint, soapAction, envelopeParaTransmissao, timeoutMs, certificado);

    console.log(`[SEFAZ Proxy Vercel] Resposta recebida da SEFAZ: HTTP ${response.status} (${response.data.length} bytes, hasCert: ${response.hasCert}, validacao: ${response.validacaoStatus}).`);

    const dadosEstruturados = extrairDadosRetornoSefazXmlServer(response.data);

    // Se a SEFAZ recusou o acesso com HTTP 403 (mTLS exigido / certificado ausente ou rejeitado),
    // PRESERVA RIGOROSAMENTE o status HTTP 403 (NUNCA devolve 200 OK para falha)
    if (response.status === 403) {
      let detalheErro = '';
      let codigoErro = 'SEFAZ_403_CERTIFICADO_EXIGIDO';

      if (!response.hasCert) {
        codigoErro = 'SEFAZ_403_CERTIFICADO_AUSENTE';
        detalheErro = 'Nenhum Certificado Digital A1 foi detectado no ambiente do Vercel. A SEFAZ-SP exige autenticação mTLS com certificado ICP-Brasil para autorização de NF-e.';
      } else if (response.validacaoStatus === 'falha') {
        codigoErro = 'SEFAZ_403_CERTIFICADO_INVALIDO';
        detalheErro = `O certificado foi detectado (${response.variavelCertOrigem || 'Base64'}), mas falhou na validação de segurança: ${response.detalheValidacao}`;
      } else {
        codigoErro = 'SEFAZ_403_CERTIFICADO_RECUSADO';
        detalheErro = 'A SEFAZ-SP recusou o certificado digital apresentado (HTTP 403 Forbidden: Access is denied). Verifique se o certificado A1 (.pfx) é emitido sob a hierarquia ICP-Brasil, se não está revogado ou vencido, e se a senha configurada no Vercel confere com o arquivo.';
      }

      sendJson(res, 403, {
        ok: false,
        statusHttp: 403,
        codigo: codigoErro,
        cStat: '403',
        xMotivo: 'Acesso recusado pela SEFAZ (403 Forbidden). O Certificado Digital A1 (.pfx) é obrigatório para autenticar a conexão mTLS com a SEFAZ-SP.',
        mensagem: 'Acesso recusado pela SEFAZ (403 Forbidden). O Certificado Digital A1 (.pfx) é obrigatório para autenticar a conexão mTLS com a SEFAZ-SP.',
        detalhe: detalheErro,
        sugestao: response.hasCert
          ? 'Verifique a validade do certificado na SEFAZ e se a senha em NFE_CERT_PASSWORD está correta.'
          : 'Cadastre as variáveis NFE_CERT_BASE64 (arquivo .pfx convertido em Base64 de linha única) e NFE_CERT_PASSWORD (senha do certificado) nas variáveis de ambiente da Vercel (Project Settings > Environment Variables > Production).',
        certificadoConfigurado: response.hasCert,
        certificadoTipo: response.certType,
        certificadoOrigem: response.variavelCertOrigem || null,
        certificadoValidacao: response.validacaoStatus || 'nao_configurado',
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

    if (dadosEstruturados.tipoResposta === 'consumo_indevido') {
      sendJson(res, 429, {
        ok: false,
        statusHttp: 429,
        codigo: 'SEFAZ_656_CONSUMO_INDEVIDO',
        tipoResposta: 'consumo_indevido',
        isConsumoIndevido: true,
        cStat: '656',
        xMotivo: dadosEstruturados.xMotivo || 'Rejeição: Consumo Indevido',
        mensagem: 'A SEFAZ bloqueou temporariamente esta nota por excesso de tentativas. Aguarde 1 hora antes de transmitir ou consultar novamente.',
        sugestao: 'Não clique em transmitir nem em consultar até passar 1 hora. Cada nova tentativa pode reiniciar o bloqueio.',
        bloqueadoAte: Date.now() + 60 * 60 * 1000,
        retentavel: false,
        tpAmb,
        servico,
        chaveAcesso: dadosEstruturados.chNFe || chaveAcesso,
        xmlRetorno: response.data
      });
      return;
    }

    // Para outros status HTTP (200, 500, etc.), preserva o status real recebido
    const isSucessoHttp = response.status >= 200 && response.status < 300;

    sendJson(res, response.status, {
      ok: isSucessoHttp,
      statusHttp: response.status,
      sucessoTransporte: isSucessoHttp,
      nRec: dadosEstruturados.nRec,
      nProt: dadosEstruturados.nProt,
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
    // Não repete extração/assinatura dentro do catch: a própria falha pode ser criptográfica.
    const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : 'SEFAZ-SP';
    const tpAmb = req.body?.tpAmb === 2 || req.body?.tpAmb === '2' ? 2 : 1;
    const servico = req.body?.servico || 'autorizacao';
    const chaveAcesso = String(req.body?.chaveAcesso || '').replace(/\D/g, '');
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
      rawError: sanitizarMensagemErro(err?.message || String(err))
    });
  }
}
