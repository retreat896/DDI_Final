import os
import urllib.parse
import re
import requests
import psycopg
from psycopg.rows import dict_row
from flask import Flask, redirect, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from dotenv import load_dotenv
from db import get_db_connection
from flasgger import Swagger
import threading

load_dotenv()

app = Flask(__name__)
# Enable CORS for local development
CORS(app, supports_credentials=True, origins=["http://localhost:5173", "http://127.0.0.1:5173"])
socketio = SocketIO(app, cors_allowed_origins=["http://localhost:5173", "http://127.0.0.1:5173"])
swagger = Swagger(app, config={
    "headers": [],
    "specs": [
        {
            "endpoint": 'apispec',
            "route": '/apispec.json',
            "rule_filter": lambda rule: True,
            "model_filter": lambda tag: True,
        }
    ],
    "specs_route": "/docs",
    "swagger_ui": True,
    "swagger_ui_bundle_js": "https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js",
    "swagger_ui_standalone_preset_js": "https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js",
    "swagger_ui_css": "https://unpkg.com/swagger-ui-dist@5/swagger-ui.css",
    "jquery_js": "//unpkg.com/jquery@3/dist/jquery.min.js",
})

STEAM_API_KEY = os.getenv("STEAM_API_KEY", "")
FRONTEND_URL = "http://localhost:5173"
STEAM_OPENID_URL = "https://steamcommunity.com/openid/login"

@app.route('/api/auth/steam')
def login():
    """
    Initiate Steam OpenID login flow.
    ---
    responses:
      302:
        description: Redirect to Steam OpenID login page.
    """
    params = {
        'openid.ns': 'http://specs.openid.net/auth/2.0',
        'openid.mode': 'checkid_setup',
        'openid.return_to': 'http://localhost:5000/api/auth/callback',
        'openid.realm': 'http://localhost:5000',
        'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
        'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
    }
    encoded_params = urllib.parse.urlencode(params)
    url = f"{STEAM_OPENID_URL}?{encoded_params}"
    return redirect(url)

@app.route('/api/auth/callback')
def auth_callback():
    """
    Steam OpenID callback endpoint.
    ---
    responses:
      302:
        description: Redirect back to the frontend with a steamid cookie.
    """
    args = request.args.to_dict()
    args['openid.mode'] = 'check_authentication'
    
    # Verify authentication with Steam
    response = requests.post(STEAM_OPENID_URL, data=args)
    if 'is_valid:true' in response.text:
        # Authentication successful
        claimed_id = args.get('openid.claimed_id', '')
        match = re.search(r'https://steamcommunity.com/openid/id/(\d+)', claimed_id)
        if match:
            steam_id = match.group(1)
            
            # Fetch profile info immediately to send to frontend via cookie
            profile_data = {}
            if STEAM_API_KEY:
                url = f"http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key={STEAM_API_KEY}&steamids={steam_id}"
                r = requests.get(url)
                if r.status_code == 200:
                    players = r.json().get('response', {}).get('players', [])
                    if players:
                        p = players[0]
                        profile_data = {
                            "steamid": steam_id,
                            "persona_name": p.get('personaname'),
                            "profile_url": p.get('profileurl'),
                            "avatar_url": p.get('avatarfull')
                        }

            # Redirect back to frontend and set cookies
            import json
            from flask import make_response
            resp = redirect(f"{FRONTEND_URL}")
            resp.set_cookie('steamid', steam_id, max_age=86400*30, httponly=False, samesite='Lax')
            if profile_data:
                profile_json = json.dumps(profile_data)
                resp.set_cookie('user_profile', urllib.parse.quote(profile_json), max_age=86400*30, httponly=False, samesite='Lax')
            return resp
    return redirect(f"{FRONTEND_URL}?error=authentication_failed")

@app.route('/api/auth/resolve', methods=['POST'])
def resolve_steam_id():
    """
    Resolve a Steam Vanity URL or ID to a SteamID64 and retrieve profile data.
    ---
    parameters:
      - name: body
        in: body
        required: true
        schema:
          type: object
          properties:
            input:
              type: string
              example: "https://steamcommunity.com/id/customname/"
    responses:
      200:
        description: Returns the SteamID and profile metadata.
      400:
        description: Invalid input or missing data.
      404:
        description: User not found.
    """
    try:
        data = request.json
        input_str = data.get('input', '').strip()
        if not input_str:
            return jsonify({"error": "Input is required"}), 400
        
        steam_id = None
        
        # 1. 17-digit numerical string
        if re.match(r'^\d{17}$', input_str):
            steam_id = input_str
        
        # 2. profile URL
        elif '/profiles/' in input_str:
            match = re.search(r'/profiles/(\d+)', input_str)
            if match:
                steam_id = match.group(1)
                
        # 3. Vanity URL (string or /id/string)
        else:
            vanity = input_str
            if '/id/' in input_str:
                match = re.search(r'/id/([^/]+)', input_str)
                if match:
                    vanity = match.group(1)
            # Remove trailing slashes just in case
            vanity = vanity.rstrip('/')
            
            # Use Steam API to resolve vanity URL
            if STEAM_API_KEY:
                resolve_url = f"http://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key={STEAM_API_KEY}&vanityurl={vanity}"
                r = requests.get(resolve_url)
                if r.status_code == 200:
                    resp = r.json().get('response', {})
                    if resp.get('success') == 1:
                        steam_id = resp.get('steamid')
                    else:
                        return jsonify({"error": "Could not resolve custom URL to a Steam ID. Make sure it is correct and public."}), 404
            else:
                return jsonify({"error": "STEAM_API_KEY not configured on server"}), 500

        if steam_id:
            # Fetch profile data to return to frontend for local storage/cookie
            profile_data = {"steamid": steam_id}
            if STEAM_API_KEY:
                resolve_info_url = f"http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key={STEAM_API_KEY}&steamids={steam_id}"
                r = requests.get(resolve_info_url)
                if r.status_code == 200:
                    players = r.json().get('response', {}).get('players', [])
                    if players:
                        p = players[0]
                        profile_data.update({
                            "persona_name": p.get('personaname'),
                            "profile_url": p.get('profileurl'),
                            "avatar_url": p.get('avatarfull')
                        })
            return jsonify(profile_data)
        
        return jsonify({"error": "Invalid input format"}), 400
    except Exception as e:
        print(f"Error resolving Steam ID: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/games/<steamid>')
def get_games(steamid):
    """
    Retrieve the list of games owned by a specific Steam profile.
    ---
    parameters:
      - name: steamid
        in: path
        type: string
        required: true
        example: "76561197960435530"
    responses:
      200:
        description: A list of owned games fetched from the Steam API.
      500:
        description: Failed to fetch data.
    """
    if not STEAM_API_KEY:
        return jsonify({"error": "Steam API key not configured"}), 500
        
    url = f"http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key={STEAM_API_KEY}&steamid={steamid}&format=json&include_appinfo=1"
    r = requests.get(url)
    if r.status_code == 200:
        return jsonify(r.json())
    return jsonify({"error": "Failed to fetch games"}), 500

@app.route('/api/analytics/genres')
def analytics_genres():
    """
    Top genres by number of games in the database.
    ---
    responses:
      200:
        description: List of {genre, count} objects sorted descending.
      500:
        description: Database error.
    """
    try:
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                SELECT genre_primary AS genre, COUNT(*) AS count
                FROM game_analytics
                WHERE genre_primary IS NOT NULL AND genre_primary <> ''
                GROUP BY genre_primary
                ORDER BY count DESC;
            """)
            rows = cur.fetchall()
        conn.close()
        return jsonify(rows)
    except Exception as e:
        print(f"Error in analytics_genres: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/analytics/review-distribution')
def analytics_review_distribution():
    """
    Distribution of overall review scores (bucketed into 5-point bands).
    ---
    responses:
      200:
        description: List of {bucket, count} objects.
      500:
        description: Database error.
    """
    try:
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                SELECT
                    (FLOOR(CAST(NULLIF(overall_review__, '') AS NUMERIC) / 5) * 5)::INT AS bucket,
                    COUNT(*) AS count
                FROM steam_games
                WHERE overall_review__ IS NOT NULL AND overall_review__ <> ''
                GROUP BY bucket
                ORDER BY bucket;
            """)
            rows = cur.fetchall()
        conn.close()
        return jsonify(rows)
    except Exception as e:
        print(f"Error in analytics_review_distribution: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/analytics/price-distribution')
def analytics_price_distribution():
    """
    Distribution of games by price bracket.
    ---
    responses:
      200:
        description: List of {bucket, count} objects.
      500:
        description: Database error.
    """
    try:
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                SELECT
                    CASE
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) =   0 THEN 'Free'
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) <   1 THEN 'Under $1'
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) <   2 THEN '$1'
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) <   3 THEN '$2'
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) <   4 THEN '$3'
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) <   5 THEN '$4'
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) <   6 THEN '$5'
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) <   7 THEN '$6'
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) <   8 THEN '$7'
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) <   9 THEN '$8'
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) <  10 THEN '$9'
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) <  11 THEN '$10'
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) <  12 THEN '$11'
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) <  13 THEN '$12'
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) <  14 THEN '$13'
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) <  15 THEN '$14'
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) <  16 THEN '$15'
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) <  17 THEN '$16'
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) <  18 THEN '$17'
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) <  19 THEN '$18'
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) <  20 THEN '$19'
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) <  30 THEN '$20-$29'
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) <  40 THEN '$30-$39'
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) <  50 THEN '$40-$49'
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) <  60 THEN '$50-$59'
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) <  70 THEN '$60-$69'
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) <  80 THEN '$70-$79'
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) <  90 THEN '$80-$89'
                        WHEN CAST(NULLIF(price_final,'') AS NUMERIC) < 100 THEN '$90-$99'
                        ELSE '$100+'
                    END AS bucket,
                    COUNT(*) AS count
                FROM game_analytics
                WHERE price_final IS NOT NULL AND price_final <> ''
                GROUP BY bucket
                ORDER BY MIN(CAST(NULLIF(price_final,'') AS NUMERIC));
            """)
            rows = cur.fetchall()
        conn.close()
        return jsonify(rows)
    except Exception as e:
        print(f"Error in analytics_price_distribution: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/analytics/publisher-tiers')
def analytics_publisher_tiers():
    """
    Games grouped by publisher tier with avg review score breakdown.
    ---
    responses:
      200:
        description: List of {tier, game_count, avg_positive_pct, avg_owners} objects.
      500:
        description: Database error.
    """
    try:
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                SELECT
                    publisher_tier AS tier,
                    COUNT(*) AS game_count,
                    ROUND(AVG(
                        CASE
                            WHEN (CAST(NULLIF(positive_reviews,'') AS NUMERIC) + CAST(NULLIF(negative_reviews,'') AS NUMERIC)) > 0
                            THEN CAST(NULLIF(positive_reviews,'') AS NUMERIC) /
                                 (CAST(NULLIF(positive_reviews,'') AS NUMERIC) + CAST(NULLIF(negative_reviews,'') AS NUMERIC)) * 100
                        END
                    ), 1) AS avg_positive_pct,
                    ROUND(AVG(CAST(NULLIF(owners_midpoint,'') AS NUMERIC))) AS avg_owners
                FROM game_analytics
                WHERE publisher_tier IS NOT NULL AND publisher_tier <> ''
                GROUP BY publisher_tier
                ORDER BY
                    CASE publisher_tier
                        WHEN 'Indie' THEN 1
                        WHEN 'AA' THEN 2
                        WHEN 'AAA' THEN 3
                        ELSE 4
                    END;
            """)
            rows = cur.fetchall()
        conn.close()
        return jsonify(rows)
    except Exception as e:
        print(f"Error in analytics_publisher_tiers: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/analytics/top-owned')
def analytics_top_owned():
    """
    Top games in the database by estimated ownership (owners_midpoint).
    ---
    parameters:
      - name: limit
        in: query
        type: integer
        default: 20
    responses:
      200:
        description: List of {appid, name, owners_midpoint, genre_primary, positive_reviews, negative_reviews}.
      500:
        description: Database error.
    """
    try:
        limit = min(int(request.args.get('limit', 20)), 50)
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                SELECT
                    appid,
                    name,
                    CAST(NULLIF(owners_midpoint,'') AS BIGINT) AS owners_midpoint,
                    genre_primary,
                    CAST(NULLIF(positive_reviews,'') AS INT) AS positive_reviews,
                    CAST(NULLIF(negative_reviews,'') AS INT) AS negative_reviews
                FROM game_analytics
                WHERE owners_midpoint IS NOT NULL AND owners_midpoint <> '0' AND owners_midpoint <> ''
                ORDER BY CAST(NULLIF(owners_midpoint,'') AS BIGINT) DESC
                LIMIT %s;
            """, (limit,))
            rows = cur.fetchall()
        conn.close()
        return jsonify(rows)
    except Exception as e:
        print(f"Error in analytics_top_owned: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/analytics/releases-by-year')
def analytics_releases_by_year():
    try:
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                SELECT 
                    SUBSTRING(release_date, 1, 4) AS year, 
                    COUNT(*) AS count 
                FROM game_analytics 
                WHERE release_date IS NOT NULL 
                  AND release_date <> '' 
                  AND CAST(SUBSTRING(release_date, 1, 4) AS INTEGER) BETWEEN 2000 AND 2025
                GROUP BY year 
                ORDER BY year ASC;
            """)
            rows = cur.fetchall()
        conn.close()
        return jsonify(rows)
    except Exception as e:
        print(f"Error in analytics_releases_by_year: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/analytics/peak-ccu')
def analytics_peak_ccu():
    try:
        limit = min(int(request.args.get('limit', 25)), 100)
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                SELECT 
                    appid,
                    name, 
                    CAST(NULLIF(peak_ccu, '') AS BIGINT) AS peak_ccu,
                    genre_primary
                FROM game_analytics 
                WHERE peak_ccu IS NOT NULL AND peak_ccu <> '0' AND peak_ccu <> ''
                ORDER BY CAST(NULLIF(peak_ccu, '') AS BIGINT) DESC 
                LIMIT %s;
            """, (limit,))
            rows = cur.fetchall()
        conn.close()
        return jsonify(rows)
    except Exception as e:
        print(f"Error in analytics_peak_ccu: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/api/analytics/game-features')
def analytics_game_features():
    try:
        conn = get_db_connection()
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute("""
                SELECT 
                    SUM(CASE WHEN LOWER(is_free) = 'true' THEN 1 ELSE 0 END) AS free_games, 
                    SUM(CASE WHEN LOWER(is_early_access) = 'true' THEN 1 ELSE 0 END) AS early_access_games, 
                    SUM(CASE WHEN LOWER(controller_support) = 'true' THEN 1 ELSE 0 END) AS controller_support_games,
                    SUM(CASE WHEN CAST(NULLIF(achievement_count,'') AS INTEGER) > 0 THEN 1 ELSE 0 END) AS has_achievements,
                    SUM(CASE WHEN CAST(NULLIF(dlc_count,'') AS INTEGER) > 0 THEN 1 ELSE 0 END) AS has_dlc,
                    SUM(CASE WHEN CAST(NULLIF(languages_count,'') AS INTEGER) >= 10 THEN 1 ELSE 0 END) AS multilingual,
                    SUM(CASE WHEN CAST(NULLIF(required_age,'') AS INTEGER) > 0 THEN 1 ELSE 0 END) AS age_restricted,
                    COUNT(*) AS total_games 
                FROM game_analytics;
            """)
            rows = cur.fetchall()
        conn.close()
        return jsonify(rows[0] if rows else {})
    except Exception as e:
        print(f"Error in analytics_game_features: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    socketio.run(app, port=5000, debug=True)
