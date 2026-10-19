import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API } from '../api';

type Status = {
  apiBase?: string;
  chainId?: number;
  credentialsSet?: boolean;
  partnerIdSet?: boolean;
  mock?: boolean;
  configReachable?: boolean;
  chainName?: string;
};

export default function LinkPage() {
  const { t } = useTranslation();
  const [row, setRow] = useState<Status | null>(null);

  const load = () => {
    void fetch(`${API}/api/corporate/status`).then(async (res) => setRow((await res.json()) as Status));
  };

  useEffect(() => { load(); }, []);

  return (
    <section className="panel">
      <h2>{t('link.title')}</h2>
      <p className="hint">{t('link.lead')}</p>
      <table>
        <tbody>
          <tr><th>{t('link.env')}</th><td>{row?.mock ? t('link.mock') : t('link.live')}</td></tr>
          <tr><th>{t('link.api')}</th><td>{row?.apiBase}</td></tr>
          <tr><th>{t('link.chain')}</th><td>{row?.chainName || row?.chainId}</td></tr>
          <tr><th>{t('link.keys')}</th><td>{row?.credentialsSet ? t('link.yes') : t('link.no')}</td></tr>
          <tr><th>{t('link.partner')}</th><td>{row?.partnerIdSet ? t('link.yes') : t('link.no')}</td></tr>
          <tr><th>{t('link.reach')}</th><td>{row?.configReachable ? t('link.ok') : t('link.fail')}</td></tr>
        </tbody>
      </table>
      <button type="button" onClick={load}>{t('link.refresh')}</button>
    </section>
  );
}
