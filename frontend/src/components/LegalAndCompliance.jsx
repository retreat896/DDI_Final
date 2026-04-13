function LegalAndCompliance() {
  return (
    <div className="glass-panel" style={{ textAlign: 'left', maxWidth: '800px', margin: '0 auto' }}>
      <h2>Privacy Policy</h2>
      <p>This application explicitly retrieves Steam Profile data and Steam Game library data only when explicitly requested by you via the Steam OpenID login process.</p>
      <p>Your public Steam ID, persona name, and avatar are temporarily stored in a local development database for analytical presentation strictly on this device.</p>
      <p>We do not intercept, view, or store your Steam account password. Authentication is officially handled by Valve's Steam servers.</p>

      <h2>Disclaimers (AS-IS Warranty & Liability)</h2>
      <p><strong>NO WARRANTY.</strong> WE PROVIDE THIS APPLICATION, THE STEAM WEB API, STEAM DATA, AND VALVE BRAND & LINKS "AS IS," "WITH ALL FAULTS" AND "AS AVAILABLE," AND THE ENTIRE RISK AS TO SATISFACTORY QUALITY, PERFORMANCE, ACCURACY, AND EFFORT IS WITH YOU. ALL WARRANTIES OR CONDITIONS, EXPRESS, STATUTORY AND IMPLIED ARE EXPRESSLY DISCLAIMED.</p>
      <p><strong>LIABILITY LIMITATION.</strong> IN NO EVENT WILL WE BE LIABLE FOR ANY DAMAGES, INCLUDING WITHOUT LIMITATION ANY INDIRECT, CONSEQUENTIAL, SPECIAL, INCIDENTAL, OR PUNITIVE DAMAGES ARISING OUT OF YOUR USE OF THIS APPLICATION OR STEAM DATA. YOUR SOLE AND EXCLUSIVE REMEDY IS TO DISCONTINUE USING THE APPLICATION.</p>

      <p style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#94a3b8' }}>
        This application uses the Steam Web API. Not endorsed or affiliated with Valve or Steam.
      </p>
    </div>
  );
}

export default LegalAndCompliance;
