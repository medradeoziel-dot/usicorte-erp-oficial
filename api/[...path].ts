import { createSefazExpressApp } from '../src/server/sefazCore';

const app = createSefazExpressApp();

/**
 * Vercel Serverless Function catch-all para sub-rotas da API (/api/...)
 */
export default function handler(req: any, res: any) {
  return app(req, res);
}
