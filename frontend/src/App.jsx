import { Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import SteamLogin from './components/SteamLogin';
import LegalAndCompliance from './components/LegalAndCompliance';
import Footer from './components/Footer';

function App() {
  return (
    <>
      <header>
        <h1>Steam Profile Analytics</h1>
      </header>
      
      <main className="container">
        <Routes>
          <Route path="/" element={<SteamLogin />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/legal" element={<LegalAndCompliance />} />
        </Routes>
      </main>

      <Footer />
    </>
  );
}

export default App;
