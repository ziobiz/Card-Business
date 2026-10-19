import express from 'express';
import cors from 'cors';
import { config, wirexCorporate } from './config.js';
import { fetchCorporateConfig, fetchPartnerToken } from './clients/corporateClient.js';
import consoleRouter from './routes/console.js';

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

app.use('/api', consoleRouter);

app.get('/api/corporate/status', async (_req, res) => {
  const out: Record<string, unknown> = {
    apiBase: wirexCorporate.apiBase,
    chainId: wirexCorporate.chainId,
    credentialsSet: Boolean(wirexCorporate.clientId && wirexCorporate.clientSecret),
    partnerIdSet: Boolean(wirexCorporate.partnerId),
    mock: config.useMockWirex,
  };
  try {
    const summary = await fetchCorporateConfig();
    out.configReachable = true;
    if (summary.chainName) out.chainName = summary.chainName;
    if (summary.chainId) out.reportedChainId = summary.chainId;
  } catch (e) {
    out.configReachable = false;
    out.configError = (e as Error).message;
  }
  if (!wirexCorporate.clientId || !wirexCorporate.clientSecret) {
    out.tokenOk = false;
    out.tokenError = 'WIREX_CLIENT_ID / WIREX_CLIENT_SECRET 가 없습니다. Corporate 키를 넣으세요.';
    return res.json(out);
  }
  if (config.useMockWirex) {
    out.tokenOk = false;
    out.note = 'USE_MOCK_WIREX=true. Corporate 키를 넣은 뒤 false 로 바꾸세요.';
    return res.json(out);
  }
  const token = await fetchPartnerToken();
  out.tokenOk = token.ok;
  if (!token.ok) out.tokenError = token.error;
  res.json(out);
});

app.listen(config.port, '127.0.0.1', () => {
  console.log(`Card-Business http://127.0.0.1:${config.port}`);
  console.log(`Corporate API ${wirexCorporate.apiBase}`);
});
