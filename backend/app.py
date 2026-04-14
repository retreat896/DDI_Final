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
import threading

load_dotenv()

app = Flask(__name__)
# Enable CORS for local development
CORS(app, supports_credentials=True, origins=["http://localhost:5173", "http://127.0.0.1:5173"])
socketio = SocketIO(app, cors_allowed_origins=["http://localhost:5173", "http://127.0.0.1:5173"])

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
            # Redirect back to frontend and set cookie
            from flask import make_response
            resp = redirect(f"{FRONTEND_URL}")
            resp.set_cookie('steamid', steam_id, max_age=86400*30, httponly=False, samesite='Lax')
            return resp
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

def _fetch_steam_app(conn, appid, fallback_name=None):
    try:
        appdetails_url = f"https://store.steampowered.com/api/appdetails/?appids={appid}"
        print(f"[STEAM API] Fetching data for App ID: {appid}...")
        r = requests.get(appdetails_url)
        if r.status_code == 200:
            print(f"[STEAM API] Successfully fetched data for App ID: {appid}")
            data = r.json().get(str(appid), {})
            if data.get('success') and 'data' in data:
                app_data = data['data']
                name = app_data.get('name', fallback_name)
                platforms = app_data.get('platforms', {})
                plat_win = platforms.get('windows', False)
                plat_mac = platforms.get('mac', False)
                plat_linux = platforms.get('linux', False)
                release_date = app_data.get('release_date', {}).get('date', '')
                
                price_overview = app_data.get('price_overview', {})
                price_initial = price_overview.get('initial')
                price_final = price_overview.get('final')
                discount_percent = price_overview.get('discount_percent')
                
                cur = conn.cursor()
                cur.execute('''
                    INSERT INTO games (appid, name, platform_windows, platform_mac, platform_linux, release_date)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (appid) DO UPDATE SET
                        name = EXCLUDED.name,
                        platform_windows = EXCLUDED.platform_windows,
                        platform_mac = EXCLUDED.platform_mac,
                        platform_linux = EXCLUDED.platform_linux,
                        release_date = EXCLUDED.release_date
                ''', (appid, name, plat_win, plat_mac, plat_linux, release_date))
                
                if price_final is not None:
                    cur.execute('''
                        INSERT INTO game_price_history (appid, price_initial, price_final, discount_percent)
                        VALUES (%s, %s, %s, %s)
                    ''', (appid, price_initial, price_final, discount_percent))
                conn.commit()
                socketio.emit('game_synced', {'appid': appid, 'name': name})
                cur.close()
    except Exception as e:
        print(f"Error fetching steam app: {e}")
        try:
            conn.rollback()
        except:
            pass

def _sync_top_games(steamid, games):
    try:
        top_games = sorted(games, key=lambda x: x.get('playtime_forever', 0), reverse=True)[:15]
        conn = get_db_connection()
        for game in top_games:
            _fetch_steam_app(conn, game.get('appid'), game.get('name'))
        conn.close()
    except Exception as e:
        print(f"Error syncing top games: {e}")

@app.route('/api/games/sync_single/<int:appid>', methods=['POST'])
def sync_single_game(appid):
    try:
        conn = get_db_connection()
        _fetch_steam_app(conn, appid)
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/games/price_history/<int:appid>')
def get_price_history(appid):
    try:
        conn = get_db_connection()
        cur = conn.cursor(row_factory=dict_row)
        cur.execute('''
            SELECT price_initial, price_final, discount_percent, recorded_at 
            FROM game_price_history 
            WHERE appid = %s 
            ORDER BY recorded_at DESC
        ''', (appid,))
        history = cur.fetchall()
        
        cur.execute('''
            SELECT 
                d.app as appid,
                COALESCE(g.name, ga.name, sg.title) as name,
                g.platform_windows, g.platform_mac, g.platform_linux, g.release_date,
                ga.genre_primary, ga.developer as analytics_developer, ga.publisher as analytics_publisher, 
                ga.positive_reviews, ga.negative_reviews, ga.ccu,
                sg.overall_review, sg.awards
            FROM (SELECT %s::INT as app) d
            LEFT JOIN games g ON g.appid = d.app
            LEFT JOIN game_analytics ga ON ga.appid = d.app::TEXT
            LEFT JOIN steam_games sg ON sg.app_id = d.app::TEXT
            LIMIT 1
        ''', (appid,))
        game = cur.fetchone()
        
        cur.close()
        conn.close()
        return jsonify({"game": game, "history": history})
    except Exception as e:
        print(f"Error fetching history: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/games/<steamid>')
def get_games(steamid):
    if not STEAM_API_KEY:
        return jsonify({"error": "Steam API key not configured"}), 500
        
    url = f"http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key={STEAM_API_KEY}&steamid={steamid}&format=json&include_appinfo=1"
    r = requests.get(url)
    if r.status_code == 200:
        data = r.json()
        games = data.get('response', {}).get('games', [])
        
        if games:
            threading.Thread(target=_sync_top_games, args=(steamid, games)).start()
            
        return jsonify(data)
    return jsonify({"error": "Failed to fetch games"}), 500

if __name__ == '__main__':
    socketio.run(app, port=5000, debug=True)
