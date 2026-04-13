import { Link } from 'react-router-dom';

function Footer() {
  return (
    <footer>
      <p>
        <strong>Not affiliated with Valve or Steam.</strong> All trademarks are property of their respective owners in the US and other countries.
      </p>
      <nav>
        <Link to="/legal">Privacy Policy & Disclaimers</Link>
      </nav>
    </footer>
  );
}

export default Footer;
