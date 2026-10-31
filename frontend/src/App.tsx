import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { PublicLayout } from './components/layout/PublicLayout';
import { AppLayout } from './components/layout/AppLayout';
import { AuthLayout } from './components/layout/AuthLayout';

import { LandingPage } from './pages/LandingPage';
import { MarketsPage } from './pages/MarketsPage';
import { TradingPage } from './pages/TradingPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { WatchlistPage } from './pages/WatchlistPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { OrdersPage } from './pages/OrdersPage';
import { DocsPage } from './pages/DocsPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <ThemeProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <Routes>
            {/* Public Marketing & Documentation Layout */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/docs" element={<DocsPage />} />
            </Route>

            {/* Authenticated Trading & Application Shell */}
            <Route element={<AppLayout />}>
              <Route path="/markets" element={<MarketsPage />} />
              <Route path="/trade" element={<Navigate to="/trade/BYTE-USD" replace />} />
              <Route path="/trade/:symbol" element={<TradingPage />} />
              <Route path="/portfolio" element={<PortfolioPage />} />
              <Route path="/watchlist" element={<WatchlistPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            {/* Focused Authentication Layout */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>

            {/* Fallback Catch-All */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ErrorBoundary>
    </ThemeProvider>
  );
}
