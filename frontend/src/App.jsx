import { Routes, Route, useLocation } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import SteamLogin from './components/SteamLogin';
import LegalAndCompliance from './components/LegalAndCompliance';
import Footer from './components/Footer';
import LandingPage from './components/LandingPage';

function App() {
  const location = useLocation();
  const isLanding = location.pathname === '/';

  return (
    <>
      {!isLanding && (
        <header>
          <h1>Steam Game Analytics</h1>
        </header>
      )}

      <main className={isLanding ? '' : 'container'}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<SteamLogin />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/legal" element={<LegalAndCompliance />} />
        </Routes>
      </main>

      <Footer />
    </>
  );
}

export default App;
