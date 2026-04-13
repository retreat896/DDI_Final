import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def fetch_json(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ctx) as response:
            data = json.loads(response.read().decode())
            print(json.dumps(data, indent=2)[:400])
    except Exception as e:
        print(f"Error fetching {url}: {e}")

print("Package Details 469:")
fetch_json("https://store.steampowered.com/api/packagedetails/?packageids=469")
print("\nApp Details 440:")
fetch_json("https://store.steampowered.com/api/appdetails/?appids=440")
