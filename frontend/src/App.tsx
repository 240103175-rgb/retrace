import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Loading, Shell } from './components/ui';
import { AuthProvider, useAuth } from './lib/auth';
import { T } from './lib/text';
import { ToastProvider } from './lib/toast';
import { AdminPage } from './pages/AdminPage';
import { CasePage } from './pages/CasePage';
import { CasesPage } from './pages/CasesPage';
import { LoginPage } from './pages/LoginPage';
import { ReportPage } from './pages/ReportPage';
import type { RetraceApi } from './services/api';
import { ApiProvider } from './services/ApiContext';

function RequireUser({ admin = false, children }: { admin?: boolean; children: ReactNode }) {
  const { user, checking } = useAuth();
  const location = useLocation();
  if (checking) return <Loading />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (admin && user.role !== 'admin') {
    return (
      <section className="panel center">
        <h1>{T.noAccess}</h1>
      </section>
    );
  }
  return <>{children}</>;
}

export function AppRoutes({ mock }: { mock: boolean }) {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="*"
        element={
          <Shell mock={mock}>
            <Routes>
              <Route path="/" element={<Navigate to="/cases" replace />} />
              <Route path="/cases" element={<RequireUser><CasesPage /></RequireUser>} />
              <Route path="/cases/:id" element={<RequireUser><CasePage /></RequireUser>} />
              <Route path="/cases/:id/reports/:reportId" element={<RequireUser><ReportPage /></RequireUser>} />
              <Route path="/admin" element={<RequireUser admin><AdminPage /></RequireUser>} />
              <Route path="*" element={<section className="panel center"><h1>{T.notFound}</h1></section>} />
            </Routes>
          </Shell>
        }
      />
    </Routes>
  );
}

export function App({ api, mock, router = true }: { api: RetraceApi; mock: boolean; router?: boolean }) {
  const tree = (
    <ApiProvider api={api}>
      <ToastProvider>
        <AuthProvider>
          <AppRoutes mock={mock} />
        </AuthProvider>
      </ToastProvider>
    </ApiProvider>
  );
  return router ? <BrowserRouter>{tree}</BrowserRouter> : tree;
}
