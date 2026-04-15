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

@app.route('/api/auth/login')
def login():
    """
    Initiate Steam OpenID login flow.
    ---
    responses:
      302:
        description: Redirect to Steam OpenID login page.
    """
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

if __name__ == '__main__':
    socketio.run(app, port=5000, debug=True)
