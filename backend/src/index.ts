import express from 'express';
import cors from 'cors';
import { config, wirexCorporate } from './config.js';
import { fetchCorporateConfig, fetchPartnerToken } from './clients/corporateClient.js';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    product: 'card-business',
    apiBase: wirexCorporate.apiBase,
    chainId: wirexCorporate.chainId,
    credentialsSet: Boolean(wirexCorporate.clientId && wirexCorporate.clientSecret),
    partnerIdSet: Boolean(wirexCorporate.partnerId),
  });
});

app.get('/api/corporate/status', async (_req, res) => {
  const out: Record<string, unknown> = {
    apiBase: wirexCorporate.apiBase,
    chainId: wirexCorporate.chainId,
    credentialsSet: Boolean(wirexCorporate.clientId && wirexCorporate.clientSecret),
    partnerIdSet: Boolean(wirexCorporate.partnerId),
    mock: config.useMockWirex,
  };
  try {
    out.configReachable = true;
    out.config = await fetchCorporateConfig();
  } catch (e) {
    out.configReachable = false;
    out.configError = (e as Error).message;
  }
  if (config.useMockWirex) {
    out.tokenOk = false;
    out.note = 'USE_MOCK_WIREX=true. Corporate 키를 넣은 뒤 false 로 바꾸세요.';
    return res.json(out);
  }
  const token = await fetchPartnerToken();
  out.tokenOk = token.ok;
  if (token.ok) out.tokenPreview = token.preview;
  else out.tokenError = token.error;
  res.json(out);
});

app.listen(config.port, '127.0.0.1', () => {
  console.log(`Card-Business http://127.0.0.1:${config.port}`);
  console.log(`Corporate API ${wirexCorporate.apiBase}`);
});
