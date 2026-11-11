import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AdminShell from './components/AdminShell';
import AdminLogin from './pages/AdminLogin';
import AdminOtp from './pages/AdminOtp';
import AdminPassword from './pages/AdminPassword';
import ConsolePage from './pages/ConsolePage';
import { DashboardPage, ManualPage, RevenuePage, RiskPage } from './pages/DeskPages';
import { AccessPage, BrandPage, PlatformPage } from './pages/SettingsPages';
import LinkPage from './pages/LinkPage';
import OrgRegisterPage from './pages/OrgRegisterPage';
import CorporatePage from './pages/CorporatePage';
import SupportPortalPage from './pages/SupportPortalPage';
import UserPage from './pages/UserPage';
import { CardIssuePage, IssuedCardsPage, MembersPage, SpendHistoryPage } from './pages/BizPages';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Navigate to="/admin/login" replace />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/otp" element={<AdminOtp />} />
        <Route path="/hq" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/org" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin" element={<AdminShell />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="orgs" element={<OrgRegisterPage />} />
          <Route path="risk" element={<RiskPage />} />
          <Route path="revenue" element={<RevenuePage />} />
          <Route path="usage" element={<Navigate to="/admin/activity" replace />} />
          <Route path="fees" element={<ConsolePage />} />
          <Route path="org-ops" element={<Navigate to="/admin/staff" replace />} />
          <Route path="staff" element={<ConsolePage />} />
          <Route path="users" element={<MembersPage />} />
          <Route path="card-issue" element={<CardIssuePage />} />
          <Route path="issued-cards" element={<IssuedCardsPage />} />
          <Route path="activity" element={<SpendHistoryPage />} />
          <Route path="corp" element={<CorporatePage />} />
          <Route path="support" element={<SupportPortalPage />} />
          <Route path="brand" element={<BrandPage />} />
          <Route path="access" element={<AccessPage />} />
          <Route path="platform" element={<PlatformPage />} />
          <Route path="manual" element={<ManualPage />} />
          <Route path="link" element={<LinkPage />} />
          <Route path="me" element={<AdminPassword />} />
        </Route>
        <Route path="/me" element={<UserPage />} />
        <Route path="*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
