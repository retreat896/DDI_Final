# Steam Game Analytics Dashboard

A data-driven web application that provides comprehensive analytics and visualizations of Steam gaming data. Explore your personal gaming footprint, compare player profiles, and discover trends across the entire Steam platform with interactive D3.js charts.

## Project Overview

This application integrates:
- **Personal Library Analytics**: Connect your Steam account to analyze your playtime, library composition, and gaming activity
- **Platform-Wide Insights**: Explore 70,000+ games on Steam with data-driven visualizations covering genres, pricing, reviews, release trends, and more
- **Interactive Visualizations**: D3.js-powered charts with real-time tooltips and filtering
- **Guest Access**: Browse platform statistics without authentication

## Tech Stack

### Frontend
- **React 19** with Vite
- **D3.js** for interactive data visualizations
- **React Router** for navigation
- **Axios** for API communication
- **Socket.io** for real-time updates

### Backend
- **Python Flask** REST API
- **PostgreSQL** database
- **Steam Web API** integration
- **Flasgger** for API documentation
- **Flask-SocketIO** for WebSocket support

### Deployment
- **Cloudflare Workers** serverless functions
- **Cloudflare D1** SQLite database
- **Vite** build optimization

### Data
- Steam API (player profiles, game libraries, reviews)
- Kaggle Steam dataset (70,000+ games, historical data)

## Project Structure

```
steam-analytics/
├── frontend/                   # React + Vite application
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── Dashboard.jsx     # Main dashboard with tabs
│   │   │   ├── StatsCards.jsx    # Summary stat cards
│   │   │   ├── SteamLogin.jsx    # Authentication
│   │   │   ├── Footer.jsx        # Footer component
│   │   │   ├── LegalAndCompliance.jsx
│   │   │   └── charts/           # D3.js chart components
│   │   │       ├── PlaytimeBarChart.jsx
│   │   │       ├── PlaytimeDonutChart.jsx
│   │   │       ├── GenreBreakdownChart.jsx
│   │   │       ├── TopOwnedGamesChart.jsx
│   │   │       ├── PeakCCUChart.jsx
│   │   │       └── ... (8 more charts)
│   │   ├── App.jsx
│   │   └── utils/
│   ├── vite.config.js
│   └── package.json
│
├── backend/                     # Python Flask API
│   ├── app.py                   # Main Flask application
│   ├── db.py                    # Database connection & schema
│   ├── requirements.txt         # Python dependencies
│   └── postman_collection.json  # API documentation
│
├── cloudflare-worker/           # Serverless Cloudflare deployment
│   ├── index.js                 # Worker entry point
│   ├── seed-d1.mjs              # Local D1 database seeder
│   ├── seed-d1-remote.mjs       # Remote D1 seeder
│   ├── build-frontend.mjs       # Frontend build script
│   ├── wrangler.jsonc           # Cloudflare config
│   └── package.json
│
├── database/                     # Local PostgreSQL setup
│   ├── docker-compose.yml
│   └── init.sql                 # Database schema initialization
│
├── import_datasets.py           # Steam dataset importer
└── package.json                 # Root package configuration

```

## Features

### Personal Library Analytics (Authenticated Users)
- **Top Played Games**: Bar chart showing most-played games with hours spent
- **Playtime Distribution**: Donut chart visualizing library breakdown
- **Recent Activity**: Scatter plot comparing recent vs. total playtime
- **Library Breakdown**: Genre and feature composition analysis
- **Profile Comparison**: Side-by-side comparison of multiple player profiles

### Platform-Wide Insights (Guest & Authenticated)
- **Genre Analysis**: Distribution of games across genres
- **Review Scores**: Distribution of player review ratings
- **Price Distribution**: Game pricing trends and ranges
- **Publisher Tiers**: Games organized by publisher size/tier
- **Most Owned Games**: Top games by ownership count with your library status
- **Peak CCU**: Games with highest concurrent player counts
- **Release Timeline**: Games released by year
- **Feature Overview**: Common game features and tags

### Additional Features
- Real-time stat cards showing total games, hours played, recent activity, and averages
- Guest mode for exploring platform data without authentication
- Profile URL resolution for quick access to any public Steam profile
- Responsive design with glassmorphism UI
- API documentation at `/docs`

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- Python 3.9+
- PostgreSQL 14+ (for local backend development)
- Docker & Docker Compose (for local database)
- Steam API Key (obtain from [Steamworks](https://steamcommunity.com/dev/apikey))

### Environment Configuration

Create a `.env` file in the `backend/` directory:

```env
STEAM_API_KEY=your_steam_api_key_here
DATABASE_URL=postgresql://username:password@localhost:5432/steam_analytics
FLASK_ENV=development
FLASK_DEBUG=1
```

### Local Development Setup

#### 1. Start PostgreSQL Database (Local)

```bash
cd database
docker-compose up -d
```

The database will initialize with the schema from `init.sql`. Default credentials:
- Host: `localhost`
- Port: `5432`
- User: `steam_user`
- Password: `steam_password`
- Database: `steam_analytics`

#### 2. Import Steam Dataset

```bash
cd ..
python import_datasets.py
```

This script:
- Downloads Steam game data from Kaggle (csv files in `datasets/` directory)
- Parses and imports ~70,000 games into PostgreSQL
- Creates necessary indices for performance

#### 3. Start Backend (Flask API)

```bash
cd backend
python -m venv venv

# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
python -m flask run
```

Backend runs at `http://localhost:5000`

API Documentation: `http://localhost:5000/docs`

#### 4. Start Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`

### Docker-Based Setup (Alternative)

For a completely containerized setup, each service can be containerized. See individual service documentation for Docker builds.

## API Reference

### Authentication Endpoints

#### Login with Steam
```
GET /api/auth/login
```
Initiates Steam OpenID login flow.

#### Resolve Profile
```
POST /api/auth/resolve
Content-Type: application/json

{
  "input": "steam_id_or_profile_url"
}
```
Resolves a Steam profile from ID or URL and returns player data.

### Data Endpoints

#### Get Player Profile
```
GET /api/player/<steamid>
```
Returns player profile data, library stats, and owned games.

#### Get Game Library
```
GET /api/library/<steamid>
```
Returns detailed list of games owned by player with playtime data.

#### Get Platform Statistics
```
GET /api/stats/genres
GET /api/stats/reviews
GET /api/stats/price-distribution
GET /api/stats/publisher-tiers
GET /api/stats/top-owned
GET /api/stats/peak-ccu
GET /api/stats/release-timeline
GET /api/stats/features
```

Returns aggregate platform data for visualizations.

### Real-Time Updates (WebSocket)

```javascript
const socket = io('http://localhost:5000');
socket.on('connect', () => {
  console.log('Connected');
});
socket.on('player_data', (data) => {
  console.log('Updated player data:', data);
});
```

## Usage

### Browsing as Guest
1. Navigate to `http://localhost:5173`
2. Click "Continue without an account"
3. Explore platform-wide statistics and charts

### Authenticating with Steam
1. Click "Log in with Steam"
2. Complete Steam OpenID authentication
3. Grant access to Steam profile
4. View personalized library analytics

### Viewing Specific Profile
1. On the login page, paste a Steam profile URL or Steam ID
2. Click "View Profile"
3. See analytics for that profile (if public)

### Interacting with Charts
- **Hover** over data points for detailed tooltips
- **Click** chart elements to filter or drill down (where applicable)
- **Scroll** to zoom or pan on certain visualizations
- Color coding indicates whether you own a game in multi-library views

## Development

### Adding New Visualizations

1. Create a new chart component in `frontend/src/components/charts/`
2. Import D3.js and create your visualization
3. Export the component
4. Add to Dashboard.jsx tab configuration

Example chart template:
```jsx
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

export default function MyChart({ data }) {
  const svgRef = useRef();

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    // D3 visualization code here
  }, [data]);

  return <svg ref={svgRef} style={{ width: '100%', height: '400px' }}></svg>;
}
```

### Backend API Development

Add new endpoints in `backend/app.py`:

```python
@app.route('/api/endpoint', methods=['GET', 'POST'])
def my_endpoint():
    """
    Endpoint description.
    ---
    responses:
      200:
        description: Success response
    """
    # Your logic here
    return jsonify({'data': result}), 200
```

View auto-generated docs at `/docs`

### Database Schema

Key tables:
- `steam_players` - Player profiles and basic info
- `steam_games` - Game metadata (title, genres, price, reviews, etc.)
- `player_libraries` - User-to-game ownership relationships
- `playtime_records` - Playtime history and statistics
- `game_analytics` - Aggregated game statistics

View full schema in `backend/db.py` and `database/init.sql`

## Deployment

### Cloudflare Workers Deployment

The project includes Cloudflare Workers configuration for serverless deployment:

```bash
cd cloudflare-worker
npm install
wrangler deploy
```

This deploys:
- Frontend static assets to Cloudflare (React build)
- Backend API as Cloudflare Workers functions
- D1 SQLite database for data storage

### Environment Variables for Production

Set in Cloudflare dashboard:
- `STEAM_API_KEY`
- `DATABASE_URL` (D1 connection string)
- `FRONTEND_URL` (your production domain)

## Performance Optimization

- Database indices on frequently queried columns (appid, genre, reviews)
- Frontend code splitting with Vite
- D3.js visualizations use efficient data binding
- SQLite query optimization for Cloudflare D1
- Caching strategies for Steam API calls (30-minute TTL default)

## Privacy & Legal

- No passwords stored; authentication via Steam OpenID
- Public Steam profile data used only when explicitly requested
- Personal data stored locally in browser localStorage
- No tracking or third-party analytics
- Not affiliated with Valve or Steam

See [Privacy Policy & Disclaimers](/legal) for complete terms.

## Troubleshooting

### Frontend Build Fails
```bash
# Clear cache and reinstall
rm -rf frontend/node_modules frontend/package-lock.json
npm install
npm run build
```

### Database Connection Error
```bash
# Verify Docker container is running
docker ps | grep postgres

# Check connection string in .env
echo $DATABASE_URL
```

### Steam API Returns 401
- Verify `STEAM_API_KEY` is correct
- Check key has API access enabled on Steamworks
- Rate limits: 100 requests per minute per IP

### Charts Not Rendering
- Check browser console for errors
- Verify data is being passed to component
- Ensure D3 v7+ is installed: `npm list d3`

## Contributing

To contribute to this project:
1. Create a feature branch
2. Make changes and test locally
3. Ensure no emojis in commit messages or code
4. Submit pull request with description

## License

This project is for educational purposes as part of the Database Design and Implementation course (Spring 2026).

## Course Information

- **Course**: Database Design and Implementation (DDI)
- **Semester**: Spring 2026
- **Project Type**: Final Project Option 1
- **Requirements Met**:
  - Backend: Python + Flask
  - Database: PostgreSQL
  - Frontend: React + D3.js
  - Data: Public Steam dataset
  - Visualization: Interactive dashboard

## Resources

- [Steam Web API Documentation](https://steamcommunity.com/dev/apikey)
- [D3.js Documentation](https://d3js.org/)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [React Documentation](https://react.dev/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Cloudflare Workers](https://workers.cloudflare.com/)

## Support

For issues, questions, or suggestions:
1. Check existing GitHub issues
2. Review API documentation at `/docs`
3. Check troubleshooting section above
4. Contact project maintainers

---

**Last Updated**: April 27, 2026
