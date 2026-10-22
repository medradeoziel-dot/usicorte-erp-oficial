# Correções aplicadas — Emissão de NF-e (Usicorte ERP)

Data: 22/10/2026

## O que estava errado

1. **Protocolo de autorização falso**: o sistema gerava um número de protocolo
   aleatório (começando com "135" + a data) e gravava no XML ANTES de transmitir
   à SEFAZ. Se a transmissão falhava, o XML ficava com um protocolo que não
   existe na SEFAZ — a nota parecia autorizada, mas não era.

2. **Digest (digVal) fabricado**: a função `gerarDigVal()` criava um resumo
   falso para o bloco de protocolo. Esse valor só pode vir da SEFAZ.

3. **XML transmitido com protNFe embutido**: o envelope de envio levava o XML
   já com o bloco de protocolo (nfeProc), o que a SEFAZ rejeita por erro de
   schema.

4. **Recibo do lote só no navegador**: quando a nota ficava "Pendente"
   (status 103/105), o número do recibo era salvo apenas no navegador
   (localStorage). Ao trocar de computador ou limpar o cache, o recibo se
   perdia e o botão "Consultar Recibo" não tinha o que consultar.

## O que foi corrigido

- `src/services/nfeService.ts`
  - Removida a geração de protocolo falso: `protocolo` começa vazio e só
    recebe valor da resposta real da SEFAZ.
  - Removida a função `gerarDigVal()` (digest fabricado).
  - `gerarXmlNfe()` só embute o bloco `protNFe` quando recebe um protocolo
    real de 15 dígitos; caso contrário, gera o XML sem protocolo.
  - O XML transmitido à SEFAZ agora é sempre a NF-e pura (sem protNFe).
  - Após a autorização, o XML salvo/baixado é reconstruído com o protocolo
    real retornado pela SEFAZ.
  - Nos caminhos de "Pendente", o número do recibo agora também é gravado
    no banco de dados (campo `nfe_recibo`).
  - A consulta de recibo/situação agora também lê o recibo do banco de dados,
    não só do navegador.

- `src/lib/db.ts`
  - `updateCotacaoNfeStatusDb()` aceita e grava `nfe_recibo` (em atualização
    separada e tolerante a falhas, para não quebrar nada se a coluna ainda
    não existir).

- `api/sefaz/soap.ts` e `src/server/sefazCore.ts`
  - Proteção no servidor: se chegar um XML com nfeProc/protNFe, o servidor
    extrai apenas a `<NFe>` antes de assinar e transmitir.

## Ação necessária no banco de dados (Supabase)

Execute UMA VEZ no SQL Editor do Supabase do projeto:

```sql
alter table cotacoes add column if not exists nfe_recibo text;
```

Sem essa coluna o sistema continua funcionando (o recibo fica salvo na
mensagem da nota e no navegador), mas com ela a consulta de recibo fica
garantida mesmo trocando de computador.

## Como publicar

Suba esta versão para o repositório/hospedagem (Vercel) normalmente.
Nenhuma variável de ambiente nova foi criada; o certificado digital A1
(NFE_CERT_BASE64 / NFE_CERT_PASSWORD) continua sendo necessário para a
transmissão real.

## Sobre a nota 3172 (XML enviado para análise)

Aquela nota NUNCA chegou à SEFAZ: o protocolo `135261021839086860` gravado
nela é falso. Após publicar esta correção, emita a nota novamente pelo
sistema (o número 3172 não foi gasto na SEFAZ, pois ela nunca foi
registrada lá). Se ao reemitir aparecer rejeição de duplicidade, aí sim
significa que a SEFAZ tem registro — use o botão "Consultar Recibo /
Situação" para recuperar o protocolo real.
