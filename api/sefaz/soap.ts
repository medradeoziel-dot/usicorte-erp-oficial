import { sefazSoapHandler } from '../../src/server/sefazCore';

/**
 * Vercel Serverless Function dedicada para /api/sefaz/soap
 * Atende nativamente as requisições SOAP da SEFAZ em produção (https://sistema.usicortemetais.com.br/api/sefaz/soap)
 */
export default async function handler(req: any, res: any) {
  return sefazSoapHandler(req, res);
}
