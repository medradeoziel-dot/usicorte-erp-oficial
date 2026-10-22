import { 
  parseRequestBodyIfNeeded,
  extrairDadosRequisicaoSefaz,
  executarRequisicaoSoapNode,
  extrairDadosRetornoSefazXmlServer,
  formatarErroConexaoSefaz,
  sanitizarMensagemErro,
  criarAgenteHttpsSefaz,
  resolverVariavelAmbienteCertificado,
  WEBSERVICES_SEFAZ_SP,
  SOAP_ACTIONS_SEFAZ,
  sendJson
} from '../../src/server/sefazCore';

export * from '../../src/server/sefazCore';

/**
 * Handler Vercel Serverless Function para /api/sefaz/soap
 * 
 * 1. Tratamento de Exceções (Try/Catch Global):
 *    - Bloco try/catch em toda a execução para capturar qualquer erro e retornar
 *      JSON com { success: false, error: error.message } em vez de quebrar com status 500 genérico.
 * 
 * 2. Ação de Consulta por Chave (NfeConsultaProtocolo / NFeConsultaProtocolo4):
 *    - Tratamento de parâmetros chave/chaveAcesso/chNFe.
 *    - WebService oficial SP Produção: https://nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx
 *    - Namespace SOAP: http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4
 * 
 * 3. Timeouts no Servidor:
 *    - Timeout padrão de 25 segundos para todas as conexões com a SEFAZ.
 */
export default async function handler(req: any, res: any): Promise<void> {
  // Configuração imediata de cabeçalhos CORS para o Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Origin, X-Requested-With, Accept, SOAPAction, action, x-custom-header, *');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Length', '0');
    return res.end();
  }

  // 1. Try/Catch Global em toda a execução da função
  try {
    // Requisição GET devolve diagnóstico do endpoint e certificado
    if (req.method === 'GET') {
      const isStatusCheck = String(req.url || '').includes('status') || String(req.url || '').includes('diagnostico');
      const agentCheck = criarAgenteHttpsSefaz();
      const envInfo = resolverVariavelAmbienteCertificado();

      const diagnostico = {
        success: true,
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
          '1': { 
            nome: 'Produção Oficial', 
            urls: WEBSERVICES_SEFAZ_SP[1] 
          },
          '2': { 
            nome: 'Homologação / Testes', 
            urls: WEBSERVICES_SEFAZ_SP[2] 
          }
        },
        orientacoesVercel: agentCheck.hasCert
          ? `Certificado digital A1 configurado com sucesso via ${agentCheck.variavelCertOrigem || 'ambiente'}.`
          : 'Para emissão em produção, configure as variáveis NFE_CERT_BASE64 (arquivo .pfx convertido em Base64) e NFE_CERT_PASSWORD (senha) no painel de configurações de ambiente da Vercel (Project Settings > Environment Variables > Production).',
        timestamp: new Date().toISOString()
      };

      if (isStatusCheck) {
        return sendJson(res, 200, diagnostico);
      }

      return sendJson(res, 200, {
        ...diagnostico,
        mensagem: 'Rota de transmissão SOAP ativa e operacional. Envie requisições POST com a chave de acesso, dados da NF-e ou XML assinado.',
        instrucoesUso: {
          metodo: 'POST',
          corpoJson: {
            chave: 'Chave de 44 dígitos da NF-e (opcional se XML já montado)',
            chaveAcesso: 'Chave de 44 dígitos da NF-e',
            xml: '<enviNFe ...>...</enviNFe> ou Envelope SOAP completo (opcional)',
            tpAmb: '1 para Produção ou 2 para Homologação (padrão oficial: 1)',
            action: 'NfeConsultaProtocolo | NFeAutorizacao4 | NFeRetAutorizacao4 | NFeRecepcaoEvento4'
          }
        }
      });
    }

    // Leitura resiliente do corpo da requisição (previne pendência de stream no Vercel)
    await parseRequestBodyIfNeeded(req);

    // Extração e normalização dos dados recebidos
    const dadosReq = extrairDadosRequisicaoSefaz(req);

    if (!dadosReq.soapEnvelope && !dadosReq.xmlConteudo && !dadosReq.chaveAcesso) {
      return sendJson(res, 200, {
        success: false,
        ok: false,
        statusHttp: 400,
        codigo: 'REQUISICAO_INVALIDA',
        cStat: 'REQUISICAO_INVALIDA',
        error: 'Dados da NF-e, chave de acesso ou Envelope SOAP não informados na requisição.',
        mensagem: 'Dados da NF-e, chave de acesso ou Envelope SOAP não informados na requisição.',
        detalhe: 'Envie a chave de acesso no campo "chave" ou "chaveAcesso", o XML no campo "xml", ou o envelope completo em "soapEnvelope".',
        sugestao: 'Certifique-se de que o corpo da requisição POST contenha a chave ou o XML a ser transmitido para a SEFAZ-SP.'
      });
    }

    let { endpoint, soapAction, soapEnvelope, timeoutMs, certificado, tpAmb, servico, chaveAcesso } = dadosReq;

    // 3. Timeouts no Servidor: garantia de 25 segundos
    const timeoutEfetivo = Math.max(timeoutMs || 25000, 25000);

    // 2. Ação de Consulta por Chave (NfeConsultaProtocolo / NFeConsultaProtocolo4):
    // Garante rigorosamente o endpoint e envelope oficiais da SEFAZ-SP
    if (servico === 'consultaProtocolo') {
      endpoint = WEBSERVICES_SEFAZ_SP[tpAmb].consultaProtocolo; // 'https://nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx'
      soapAction = SOAP_ACTIONS_SEFAZ.consultaProtocolo; // 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4'

      if (!soapEnvelope || !soapEnvelope.includes('<consSitNFe') || !soapEnvelope.includes('NFeConsultaProtocolo4')) {
        const chaveLimpa = (chaveAcesso || '').replace(/\D/g, '');
        if (chaveLimpa) {
          soapEnvelope = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4"><consSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>${tpAmb}</tpAmb><xServ>CONSULTAR</xServ><chNFe>${chaveLimpa}</chNFe></consSitNFe></nfeDadosMsg></soap12:Body></soap12:Envelope>`;
        }
      }
    }

    let envelopeParaTransmissao = soapEnvelope || '';
    if (envelopeParaTransmissao.includes('<nfeProc')) {
      const mNfe = envelopeParaTransmissao.match(/<NFe xmlns="http:\/\/www\.portalfiscal\.inf\.br\/nfe"[\s\S]*?<\/NFe>/);
      if (mNfe) {
        console.warn('[Vercel SEFAZ Proxy] Envelope continha nfeProc. Extraindo <NFe> para envio.');
        envelopeParaTransmissao = envelopeParaTransmissao.replace(/<nfeProc[\s\S]*?<\/nfeProc>/, mNfe[0]);
      }
    }

    if (envelopeParaTransmissao && 
        (envelopeParaTransmissao.includes('<infNFe') || envelopeParaTransmissao.includes('<infEvento')) && 
        !envelopeParaTransmissao.includes('<Signature')) {
      const { assinarXmlSefazServer } = await import('../../src/server/sefazCore');
      envelopeParaTransmissao = assinarXmlSefazServer(envelopeParaTransmissao, certificado);
    }

    console.log(`[Vercel /api/sefaz/soap] Transmitindo (${servico.toUpperCase()} - tpAmb: ${tpAmb}${chaveAcesso ? ` - Chave: ${chaveAcesso}` : ''}) para ${endpoint} (timeout: ${timeoutEfetivo}ms)...`);

    const response = await executarRequisicaoSoapNode(
      endpoint!, 
      soapAction!, 
      envelopeParaTransmissao, 
      timeoutEfetivo, 
      certificado
    );

    console.log(`[Vercel /api/sefaz/soap] Resposta recebida da SEFAZ: HTTP ${response.status} (${response.data.length} bytes, hasCert: ${response.hasCert}, validacao: ${response.validacaoStatus}).`);

    // Falta ou recusa de Certificado mTLS (HTTP 403)
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

      return sendJson(res, 403, {
        success: false,
        ok: false,
        statusHttp: 403,
        error: detalheErro,
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
    }

    const dadosEstruturados = extrairDadosRetornoSefazXmlServer(response.data);

    if (dadosEstruturados.tipoResposta === 'consumo_indevido') {
      return sendJson(res, 429, {
        success: false,
        ok: false,
        statusHttp: 429,
        codigo: 'SEFAZ_656_CONSUMO_INDEVIDO',
        tipoResposta: 'consumo_indevido',
        isConsumoIndevido: true,
        cStat: '656',
        error: dadosEstruturados.xMotivo || 'Rejeição: Consumo Indevido',
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
    }

    const isSucessoHttp = response.status >= 200 && response.status < 300;

    return sendJson(res, response.status, {
      success: isSucessoHttp && !dadosEstruturados.isFault,
      ok: isSucessoHttp && !dadosEstruturados.isFault,
      statusHttp: response.status,
      sucessoTransporte: isSucessoHttp,
      tipoResposta: dadosEstruturados.tipoResposta,
      isAutorizada: dadosEstruturados.isAutorizada,
      isLotePendente: dadosEstruturados.isLotePendente,
      isFault: dadosEstruturados.isFault,
      cStat: dadosEstruturados.cStat,
      xMotivo: dadosEstruturados.xMotivo,
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
    // 1. Try/Catch Global: intercepta qualquer erro não tratado e devolve JSON com { success: false, error: error.message }
    let endpoint = 'https://nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx';
    let tpAmb: 1 | 2 = 1;
    let servico = 'consultaProtocolo';
    let chaveAcesso = '';

    try {
      const dados = extrairDadosRequisicaoSefaz(req);
      endpoint = dados.endpoint || endpoint;
      tpAmb = dados.tpAmb;
      servico = dados.servico;
      chaveAcesso = dados.chaveAcesso || '';
    } catch {}

    const erroFormatado = formatarErroConexaoSefaz(err, endpoint);
    console.error(`[Vercel /api/sefaz/soap] Falha capturada no Try/Catch Global:`, erroFormatado);

    return sendJson(res, 200, {
      success: false,
      ok: false,
      error: erroFormatado.mensagem || err?.message || String(err),
      mensagem: erroFormatado.mensagem || err?.message || String(err),
      statusHttp: 500,
      tpAmb,
      ambiente: tpAmb === 1 ? 'producao' : 'homologacao',
      servico,
      chaveAcesso,
      codigo: erroFormatado.codigo,
      cStat: erroFormatado.codigo,
      xMotivo: erroFormatado.mensagem,
      detalhe: erroFormatado.detalhe,
      sugestao: erroFormatado.sugestao,
      rawError: sanitizarMensagemErro(err?.message || String(err)),
      timestamp: new Date().toISOString()
    });
  }
}
