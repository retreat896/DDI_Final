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


def _fetch_steam_app(conn, appid, fallback_name=None):
    try:
        appdetails_url = f"https://store.steampowered.com/api/appdetails/?appids={appid}&cc=us"
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
        
        # 0. Fetch stored historical points (past synced prices)
        cur.execute('''
            SELECT price_initial, price_final, discount_percent, recorded_at 
            FROM game_price_history 
            WHERE appid = %s 
            ORDER BY recorded_at DESC
        ''', (appid,))
        history = cur.fetchall()
        
        # 1. Fetch live price dynamically from Steam API
        try:
            r = requests.get(f"https://store.steampowered.com/api/appdetails/?appids={appid}&cc=us")
            if r.status_code == 200:
                data = r.json().get(str(appid), {})
                if data.get('success') and 'data' in data:
                    app_data = data['data']
                    price_overview = app_data.get('price_overview')
                    is_free = app_data.get('is_free')
                    
                    from datetime import datetime
                    if price_overview:
                        history.append({
                            "price_initial": price_overview.get('initial'),
                            "price_final": price_overview.get('final'),
                            "discount_percent": price_overview.get('discount_percent'),
                            "recorded_at": datetime.utcnow().isoformat() + "Z"
                        })
                    elif is_free:
                        history.append({
                            "price_initial": 0,
                            "price_final": 0,
                            "discount_percent": 0,
                            "recorded_at": datetime.utcnow().isoformat() + "Z"
                        })
        except Exception as e:
            print(f"Error fetching live pricing from Steam: {e}")
        
        # 2. Fetch Kaggle dataset's historical price and append it
        cur.execute('''
            SELECT ga.price_initial, ga.price_final, ga.discount_percent, rgd.fetched_at 
            FROM game_analytics ga
            LEFT JOIN raw_game_data rgd ON rgd.appid = ga.appid
            WHERE ga.appid = %s::TEXT
        ''', (appid,))
        dataset_hist = cur.fetchone()
        
        if dataset_hist:
            try:
                def parse_price(val):
                    if not val: return 0
                    try: return int(float(val) * 100)
                    except: return 0
                
                def parse_discount(val):
                    if not val: return 0
                    try: return int(float(val))
                    except: return 0

                p_init = parse_price(dataset_hist.get('price_initial'))
                p_final = parse_price(dataset_hist.get('price_final'))
                discount = parse_discount(dataset_hist.get('discount_percent'))
                fetched_at = dataset_hist.get('fetched_at') or "2024-01-01T00:00:00"
                
                # Append dataset point with its actual fetched timestamp
                history.append({
                    "price_initial": p_init,
                    "price_final": p_final,
                    "discount_percent": discount,
                    "recorded_at": fetched_at
                })
            except Exception as e:
                print(f"Error parsing dataset history for {appid}: {e}")

        # 3. Fetch Game Data
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
        
        # Sort history by recorded_at descending just in case
        history.sort(key=lambda x: str(x['recorded_at']), reverse=True)
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
