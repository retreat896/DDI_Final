import os
import urllib.parse
import re
import requests
import psycopg
from psycopg.rows import dict_row
from flask import Flask, redirect, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from db import get_db_connection

load_dotenv()

app = Flask(__name__)
# Enable CORS for local development
CORS(app, supports_credentials=True, origins=["http://localhost:5173", "http://127.0.0.1:5173"])

STEAM_API_KEY = os.getenv("STEAM_API_KEY", "")
FRONTEND_URL = "http://localhost:5173"
STEAM_OPENID_URL = "https://steamcommunity.com/openid/login"

@app.route('/api/auth/login')
def login():
    # Construct Steam OpenID URL
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
            # Fetch profile info immediately to populate DB and cache it
            _fetch_and_store_profile(steam_id)
            # Redirect back to frontend
            return redirect(f"{FRONTEND_URL}?steamid={steam_id}")
    return redirect(f"{FRONTEND_URL}?error=authentication_failed")

def _fetch_and_store_profile(steam_id):
    if not STEAM_API_KEY:
        return
        
    url = f"http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key={STEAM_API_KEY}&steamids={steam_id}"
    r = requests.get(url)
    if r.status_code == 200:
        data = r.json()
        players = data.get('response', {}).get('players', [])
        if players:
            p = players[0]
            try:
                conn = get_db_connection()
                cur = conn.cursor()
                cur.execute('''
                    INSERT INTO users (steam_id, persona_name, profile_url, avatar_url, last_login)
                    VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
                    ON CONFLICT (steam_id) DO UPDATE SET
                        persona_name = EXCLUDED.persona_name,
                        profile_url = EXCLUDED.profile_url,
                        avatar_url = EXCLUDED.avatar_url,
                        last_login = CURRENT_TIMESTAMP
                ''', (steam_id, p.get('personaname'), p.get('profileurl'), p.get('avatarfull')))
                conn.commit()
                cur.close()
                conn.close()
            except Exception as e:
                print(f"Error storing profile: {e}")

@app.route('/api/player/<steamid>')
def get_player(steamid):
    try:
        conn = get_db_connection()
        cur = conn.cursor(row_factory=dict_row)
        cur.execute("SELECT * FROM users WHERE steam_id = %s", (steamid,))
        player = cur.fetchone()
        cur.close()
        conn.close()
        
        if player:
            return jsonify(player)
    except Exception as e:
        print(f"Error reading profile: {e}")
    
    return jsonify({"error": "Player not found"}), 404

@app.route('/api/games/<steamid>')
def get_games(steamid):
    if not STEAM_API_KEY:
        return jsonify({"error": "Steam API key not configured"}), 500
        
    url = f"http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key={STEAM_API_KEY}&steamid={steamid}&format=json&include_appinfo=1"
    r = requests.get(url)
    if r.status_code == 200:
        return jsonify(r.json())
    return jsonify({"error": "Failed to fetch games"}), 500

if __name__ == '__main__':
    app.run(port=5000, debug=True)
