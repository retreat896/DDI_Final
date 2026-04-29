import { Link } from 'react-router-dom';
import './LandingPage.css';

function LandingPage() {
  return (
    <div className="landing-page">
      <div className="landing-container">
        
        <header className="landing-header">
          <div className="landing-logo">
            <div className="landing-logo-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white"/>
                <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            SteamScope
          </div>
          <Link to="/login" className="landing-nav-btn">Sign In</Link>
        </header>

        <section className="hero">
          <h1>Discover your Steam library<br/><span>like never before.</span></h1>
          <p>
            Dive deep into your gaming habits, track your library's value, and explore platform-wide analytics. 
            All in one premium dashboard.
          </p>
          <div className="hero-buttons">
            <Link to="/login" className="btn-solid">Get Started Free</Link>
            <a href="#features" className="btn-outline">Explore Features</a>
          </div>
        </section>

        <section id="features" className="features">
          <div className="features-header">
            <h2>Build a better gaming life</h2>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                  <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                  <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                </svg>
              </div>
              <h3>Library Value Tracking</h3>
              <p>Analyze exactly how much your games are worth, track pricing trends, and calculate your exact playtime value.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20V10" />
                  <path d="M18 20V4" />
                  <path d="M6 20v-4" />
                </svg>
              </div>
              <h3>Peak CCU Stats</h3>
              <p>View historical player counts and identify the most active games across the entire Steam platform in real-time.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <h3>Financial Breakdown</h3>
              <p>Filter your games by cost, see where you've spent the most, and break down your investments by genre or publisher.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                  <path d="M2 12h20" />
                </svg>
              </div>
              <h3>Global Analytics</h3>
              <p>Explore data across 80,000+ Steam games, comparing your library against global trends and review distributions.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <h3>Comprehensive Data</h3>
              <p>We aggregate massive amounts of metadata, from developer histories to tag associations and genre correlations.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <h3>Review Insights</h3>
              <p>Correlate game pricing with user review scores to find hidden gems and avoid overhyped, overpriced titles.</p>
            </div>
          </div>
        </section>

        <section className="bottom-cta">
          <h2>Ready to analyze your library?</h2>
          <Link to="/login" className="btn-solid" style={{ position: 'relative', zIndex: 1 }}>Join the Platform</Link>
        </section>

      </div>
    </div>
  );
}

export default LandingPage;
