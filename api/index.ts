import { createSefazExpressApp } from '../src/server/sefazCore';

const app = createSefazExpressApp();

/**
 * Vercel Serverless Function central para a API do UsiCorte ERP
 * Roteia /api/* para a aplicação Express com todos os endpoints fiscais e status
 */
export default function handler(req: any, res: any) {
  return app(req, res);
}
