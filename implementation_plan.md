# SteamID Resolver Login & Removal of Price History Module

The goal is to allow users to use the dashboard without needing to use the strict Steam Login OpenID protocol. Instead, they can input their Steam profile URL or their 17-digit Steam64 ID. Additionally, the price history functionality will be completely removed from the dashboard as requested.

## Proposed Changes

### Backend Service API
The backend will introduce a new parsing proxy route.

#### [MODIFY] [app.py](file:///h:/Desktop/Code/School/DDI_Final/backend/app.py)
- **Add `/api/auth/resolve` endpoint**: Will accept a POST request with an overarching string input.
- **Regex Parsing logic**:
	- If input contains `/id/<name>`, extract `<name>` and use Steam's `ResolveVanityURL` API to get the underlying 64-bit Steam ID.
	- If input contains `/profiles/<id>` or is a 17-digit numeric sequence, directly extract and use the 64-bit Steam ID.
- **Save Profile**: Once the 64-bit `steamid` is discovered, call the existing `_fetch_and_store_profile(steamid)` function and return the ID to the frontend to set the cookie/session.
- *The old `/api/auth/login` will remain functional but not strictly required.*

---

### Frontend Dashboard
Modifications to the frontend to accommodate the manual input mode and streamline the interface.

#### [MODIFY] [SteamLogin.jsx](file:///h:/Desktop/Code/School/DDI_Final/frontend/src/components/SteamLogin.jsx)
- **Interactive Form Component**: Add a textual input field and a "Find Profile" submit button below the standard OpenID login choice.
- **Action Flow**: Submitting the form calls `/api/auth/resolve`. If successful, the returned `steamid` is stored to localStorage and navigates to the dashboard bypassing traditional auth.

#### [MODIFY] [Dashboard.jsx](file:///h:/Desktop/Code/School/DDI_Final/frontend/src/components/Dashboard.jsx)
- **Removal**: Delete the `selectedAppId` and `priceHistory` state maps.
- **UI Cleansing**: Delete the nested Modal component charting the pricing history, taking out its sub-components and logic.
- **Interactive Tweak**: Change the action of clicking a bar on the D3 Chart to simply open that game's Steam Store page (`https://store.steampowered.com/app/{appid}`) instead of calling the now-removed price history logic.

## Verification Plan

### Automated Tests
- Test edge case inputs on the frontend component (e.g. `https://steamcommunity.com/id/gaben/`, `76561197960287930`, `gaben`)

### Manual Verification
1. User can successfully access their dashboard by pasting a custom URL into the initial page.
2. The Dashboard displays their Top 15 stats correctly.
3. Checking clicking a Game Bar correctly opens the external store link instead of attempting an API fetch.
