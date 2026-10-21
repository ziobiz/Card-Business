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
import UserPage from './pages/UserPage';

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
          <Route path="usage" element={<ConsolePage />} />
          <Route path="fees" element={<ConsolePage />} />
          <Route path="org-ops" element={<ConsolePage />} />
          <Route path="users" element={<ConsolePage />} />
          <Route path="activity" element={<ConsolePage />} />
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
