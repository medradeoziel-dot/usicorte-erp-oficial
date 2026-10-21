import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { 
  createSefazExpressApp,
  WEBSERVICES_SEFAZ_SP,
  SOAP_ACTIONS_SEFAZ,
  criarAgenteHttpsSefaz,
  assinarXmlSefazServer,
  formatarErroConexaoSefaz,
  extrairDadosRetornoSefazXmlServer,
  enveloparXmlSoapSefaz,
  montarXmlNfeServer,
  extrairDadosRequisicaoSefaz,
  executarRequisicaoSoapNode,
  sefazSoapHandler
} from './src/server/sefazCore';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

// Re-exportações para retrocompatibilidade
export {
  WEBSERVICES_SEFAZ_SP,
  SOAP_ACTIONS_SEFAZ,
  criarAgenteHttpsSefaz,
  assinarXmlSefazServer,
  formatarErroConexaoSefaz,
  extrairDadosRetornoSefazXmlServer,
  enveloparXmlSoapSefaz,
  montarXmlNfeServer,
  extrairDadosRequisicaoSefaz,
  executarRequisicaoSoapNode,
  sefazSoapHandler
};

export async function buildApp(): Promise<express.Express> {
  const app = createSefazExpressApp();

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

  return app;
}

export async function startServer() {
  const app = await buildApp();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`⚡ UsiCorte ERP Server rodando na porta ${PORT} (http://0.0.0.0:${PORT})`);
    console.log(`🔒 Proxy SEFAZ HTTPS Agent ativo em: http://0.0.0.0:${PORT}/api/sefaz/soap`);
  });
}

// Inicia servidor se executado diretamente
startServer().catch((err) => {
  console.error('[Fatal Error] Falha ao iniciar o servidor UsiCorte ERP:', err);
  process.exit(1);
});
