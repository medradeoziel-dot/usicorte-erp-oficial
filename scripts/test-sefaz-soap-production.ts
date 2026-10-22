import {
  compactarXmlSefaz,
  extrairDadosRetornoSefazXml,
  gerarEnvelopeSoapNfe,
  gerarEnvelopeSoapConsultaSituacao,
  gerarEnvelopeSoapConsultaRecibo,
  validarXmlPreTransmissaoSefaz,
  gerarXmlNfe,
  gerarChaveAcessoNfe
} from '../src/services/nfeService';
import {
  extrairDadosRetornoSefazXmlServer,
  assinarXmlSefazServer,
  extrairCredenciaisCertificado
} from '../src/server/sefazCore';

console.log('======================================================================');
console.log('🧪 TESTE COMPLETO: COMUNICAÇÃO SOAP SEFAZ-SP E TRANSMISSÃO SEGURA');
console.log('======================================================================\n');

let falhas = 0;
function assert(cond: boolean, desc: string) {
  if (cond) {
    console.log(`✅ [PASS] ${desc}`);
  } else {
    console.error(`❌ [FAIL] ${desc}`);
    falhas++;
  }
}

// ----------------------------------------------------------------------------------
// 1. Teste de Compactação e Remoção de Caracteres de Edição
// ----------------------------------------------------------------------------------
console.log('--- 1. Compactação de XML e Ausência de Caracteres de Edição ---');
const xmlComEspacosEQuebras = `\uFEFF
  <?xml version="1.0" encoding="utf-8"?>
  <!-- Comentário proibidíssimo pela SEFAZ -->
  <soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
    <soap12:Body>
      <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
        <enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
          <idLote>1</idLote>
          <indSinc>1</indSinc>
          <NFe>
            <infNFe Id="NFe35261025038430000123550010000031431888610196" versao="4.00">
              <prod>
                <cProd>001</cProd>
                <xProd>CHAPA DE ACO CARBONO 1/2" X 1000 X 2000 MM</xProd>
                <vProd>1250.00</vProd>
              </prod>
              <infAdic>
                <infCpl>DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. REF. PEDIDO USICORTE.</infCpl>
              </infAdic>
            </infNFe>
          </NFe>
        </enviNFe>
      </nfeDadosMsg>
    </soap12:Body>
  </soap12:Envelope>
`;

const xmlCompactado = compactarXmlSefaz(xmlComEspacosEQuebras);
assert(!xmlCompactado.startsWith('\uFEFF'), 'Removeu BOM inicial (\uFEFF)');
assert(!xmlCompactado.includes('<!--'), 'Removeu comentários XML');
assert(!xmlCompactado.includes('\n') && !xmlCompactado.includes('\r'), 'Não possui quebras de linha');
assert(!/>\s+</.test(xmlCompactado), 'Não possui espaços ou tabulações entre tags XML (> <)');
assert(xmlCompactado.includes('<xProd>CHAPA DE ACO CARBONO 1/2" X 1000 X 2000 MM</xProd>'), 'Preservou integralmente os espaços e conteúdo da descrição do produto <xProd>');
assert(xmlCompactado.includes('<infCpl>DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. REF. PEDIDO USICORTE.</infCpl>'), 'Preservou integralmente os dados em <infCpl>');

// ----------------------------------------------------------------------------------
// 2. Teste de Envelopes SOAP 1.2
// ----------------------------------------------------------------------------------
console.log('\n--- 2. Montagem de Envelopes SOAP 1.2 ---');
const nfeXml = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe"><infNFe Id="NFe35261025038430000123550010000031431888610196" versao="4.00"><ide><cUF>35</cUF></ide></infNFe></NFe>`;
const envelopeEnvio = gerarEnvelopeSoapNfe(nfeXml, '1', '1');
assert(envelopeEnvio.includes('soap12:Envelope'), 'Envelope utiliza namespace soap12');
assert(!envelopeEnvio.includes('\n'), 'Envelope não contém quebras de linha');
assert(!/>\s+</.test(envelopeEnvio), 'Envelope não contém espaços entre tags');
assert(envelopeEnvio.includes('<idLote>1</idLote><indSinc>1</indSinc>'), 'Contém tags de lote compactadas');

const envelopeConsSit = gerarEnvelopeSoapConsultaSituacao('35261025038430000123550010000031431888610196');
assert(envelopeConsSit.includes('<chNFe>35261025038430000123550010000031431888610196</chNFe>'), 'Consulta situação monta chave de 44 dígitos');
assert(!/>\s+</.test(envelopeConsSit), 'Consulta situação sem espaços entre tags');

const envelopeConsRec = gerarEnvelopeSoapConsultaRecibo('351000123456789');
assert(envelopeConsRec.includes('<nRec>351000123456789</nRec>'), 'Consulta recibo monta nRec corretamente');
assert(!/>\s+</.test(envelopeConsRec), 'Consulta recibo sem espaços entre tags');

// ----------------------------------------------------------------------------------
// 3. Teste de Diferenciação de Respostas SEFAZ (HTTP 200, Rejeição, Lote, SOAP Fault)
// ----------------------------------------------------------------------------------
console.log('\n--- 3. Tratamento de Respostas SEFAZ & SOAP Faults ---');

// Cenário A: Autorização com Sucesso (100)
const xmlAutorizado = `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4"><retEnviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>1</tpAmb><cStat>104</cStat><xMotivo>Lote processado</xMotivo><protNFe versao="4.00"><infProt><tpAmb>1</tpAmb><chNFe>35261025038430000123550010000031431888610196</chNFe><dhRecbto>2026-10-22T10:15:00-03:00</dhRecbto><nProt>135260000000001</nProt><cStat>100</cStat><xMotivo>Autorizado o uso da NF-e</xMotivo></infProt></protNFe></retEnviNFe></nfeResultMsg></soap:Body></soap:Envelope>`;
const retAut = extrairDadosRetornoSefazXml(xmlAutorizado);
assert(retAut.isAutorizada === true, 'Cenário A: isAutorizada deve ser true');
assert(retAut.nProt === '135260000000001', 'Cenário A: protocolo extraído');
assert(retAut.tipoResposta === 'autorizacao', 'Cenário A: tipoResposta é autorizacao');

// Cenário B: Lote Pendente em Processamento (103/105)
const xmlPendente = `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4"><retEnviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>1</tpAmb><cStat>103</cStat><xMotivo>Lote recebido com Sucesso</xMotivo><infRec><nRec>351000987654321</nRec></infRec></retEnviNFe></nfeResultMsg></soap:Body></soap:Envelope>`;
const retPend = extrairDadosRetornoSefazXml(xmlPendente);
assert(retPend.isAutorizada === false, 'Cenário B: isAutorizada deve ser false para lote pendente');
assert(retPend.isLotePendente === true, 'Cenário B: isLotePendente deve ser true');
assert(retPend.nRec === '351000987654321', 'Cenário B: recibo do lote extraído');
assert(retPend.tipoResposta === 'lote_pendente', 'Cenário B: tipoResposta é lote_pendente');

// Cenário C: Rejeição Fiscal (ex: 204 Duplicidade sem protocolo)
const xmlRejeicao = `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><nfeResultMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4"><retEnviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><tpAmb>1</tpAmb><cStat>204</cStat><xMotivo>Rejeição: Duplicidade de NF-e</xMotivo></retEnviNFe></nfeResultMsg></soap:Body></soap:Envelope>`;
const retRej = extrairDadosRetornoSefazXml(xmlRejeicao);
assert(retRej.isAutorizada === false, 'Cenário C: isAutorizada false');
assert(retRej.isLotePendente === false, 'Cenário C: isLotePendente false');
assert(retRej.cStat === '204', 'Cenário C: cStat 204');
assert(retRej.tipoResposta === 'rejeicao_fiscal', 'Cenário C: tipoResposta é rejeicao_fiscal');

// Cenário D: SOAP Fault ("Não é permitida a presença de caracteres de edição...")
const xmlSoapFault = `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><soap:Fault><soap:Code><soap:Value>soap:Sender</soap:Value></soap:Code><soap:Reason><soap:Text xml:lang="pt-BR">Não é permitida a presença de caracteres de edição no início/fim da mensagem ou entre as tags da mensagem.</soap:Text></soap:Reason></soap:Fault></soap:Body></soap:Envelope>`;
const retFault = extrairDadosRetornoSefazXml(xmlSoapFault);
assert(retFault.isFault === true, 'Cenário D: isFault detectado');
assert(retFault.isAutorizada === false, 'Cenário D: isAutorizada false');
assert(retFault.tipoResposta === 'soap_fault', 'Cenário D: tipoResposta é soap_fault');
assert(retFault.xMotivo?.includes('Não é permitida a presença de caracteres de edição'), 'Cenário D: mensagem exata do SOAP Fault extraída');

// Cenário E: SOAP Fault no Servidor (extrairDadosRetornoSefazXmlServer)
const retFaultServer = extrairDadosRetornoSefazXmlServer(xmlSoapFault);
assert(retFaultServer.isFault === true, 'Cenário E (Server): isFault true');
assert(retFaultServer.tipoResposta === 'soap_fault', 'Cenário E (Server): tipoResposta soap_fault');
assert(retFaultServer.xMotivo?.includes('Não é permitida a presença de caracteres de edição'), 'Cenário E (Server): mensagem de edição extraída');

// ----------------------------------------------------------------------------------
// 4. Teste de Assinatura Digital e Canonicalização C14N
// ----------------------------------------------------------------------------------
console.log('\n--- 4. Assinatura Digital XMLDSig ICP-Brasil ---');
const xmlAssinado = assinarXmlSefazServer(nfeXml);
assert(xmlAssinado.includes('<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"'), 'Bloco Signature inserido no XML');
assert(xmlAssinado.includes('<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>'), 'Canonicalization C14N presente');
assert(xmlAssinado.includes('<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>'), 'Algoritmo RSA-SHA1 presente');
assert(xmlAssinado.includes('<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>'), 'Digest SHA1 presente');
assert(!/>\s+</.test(xmlAssinado), 'Bloco Signature sem espaços entre tags');

// ----------------------------------------------------------------------------------
// 5. Teste de Validação Pré-Transmissão
// ----------------------------------------------------------------------------------
console.log('\n--- 5. Validação Pré-Transmissão do XML ---');
const emitenteMock = {
  cnpj: '25038430000123',
  razaoSocial: 'USICORTE METAIS E PECAS LTDA',
  nomeFantasia: 'USICORTE METAIS',
  ie: '20963213114',
  endereco: 'RUA CORONEL IVON CESAR PIMENTEL',
  numero: '3-41',
  bairro: 'PARQUE PAULISTA',
  cidade: 'BAURU',
  uf: 'SP',
  cep: '17031350',
  telefone: '1432031122',
  aliquotaIcmsSimples: 2.75,
  regimeTributario: 'Simples Nacional' as const
};

const destinatarioMock = {
  nome: 'CLIENTE METALURGICA TESTE LTDA',
  documento: '12345678000195',
  tipoDocumento: 'CNPJ' as const,
  endereco: 'AVENIDA DAS INDUSTRIAS',
  numero: '1000',
  bairro: 'DISTRITO INDUSTRIAL',
  cidade: 'BAURU',
  uf: 'SP',
  cep: '17034000',
  indicadorIe: '9'
};

const itensMock = [{
  id: 'item-1',
  ordem: 1,
  codigo: '001',
  descricao: 'CORTE LASER CHAPA ACO 1/2 POL',
  ncm: '72085200',
  cfop: '5102',
  unidade: 'PC',
  quantidade: 10,
  valorUnitario: 150.0,
  subtotal: 1500.0,
  csosn: '101'
}];

const chaveMock = gerarChaveAcessoNfe(
  emitenteMock.uf,
  new Date(),
  emitenteMock.cnpj,
  '1',
  '123'
);

const xmlCompleto = gerarXmlNfe(
  emitenteMock,
  destinatarioMock,
  itensMock,
  '123',
  '1',
  chaveMock,
  1500.0,
  new Date()
);

const validacao = validarXmlPreTransmissaoSefaz(xmlCompleto);
assert(validacao.valido === true, `XML gerado pelo sistema é 100% válido (erros: ${validacao.erros.join(', ') || 'nenhum'})`);
assert(validacao.detalhes.cDVValido === true, 'Dígito verificador Módulo 11 válido');
assert(validacao.detalhes.totalCalculado === 1500.0, 'Total calculado bate com o valor da nota');

console.log('\n======================================================================');
if (falhas === 0) {
  console.log('🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!');
} else {
  console.error(`⚠️ TOTAL DE FALHAS: ${falhas}`);
  process.exit(1);
}
console.log('======================================================================');
