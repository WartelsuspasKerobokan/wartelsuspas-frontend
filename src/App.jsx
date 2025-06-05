import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import WelcomeScreen from './components/WelcomeScreen';
import VoucherInput from './components/VoucherInput';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import VoucherGenerator from './components/VoucherGenerator';
import Reports from './components/Reports';
import RevenueReport from './components/RevenueReport';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<WelcomeScreen />} />
        <Route
          path="/voucher"
          element={
            <ErrorBoundary>
              <VoucherInput />
            </ErrorBoundary>
          }
        />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin/dashboard"
          element={
            <ErrorBoundary>
              <AdminDashboard />
            </ErrorBoundary>
          }
        />
        <Route path="/admin/voucher" element={<VoucherGenerator />} />
        <Route path="/admin/reports" element={<Reports />} />
        <Route path="/admin/revenue" element={<RevenueReport />} />
      </Routes>
    </Router>
  );
}

export default App;