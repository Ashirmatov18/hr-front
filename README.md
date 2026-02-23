# HR Ecosystem — Mini App (frontend)

Small frontend for the Telegram Mini App. Connects to the WordPress HR Ecosystem backend.

## Folder structure

```
mini-app/
  index.html       # Entry page (loads Telegram SDK + app)
  css/
    style.css      # Styles (uses Telegram theme vars)
  js/
    config.js      # API_BASE_URL (leave empty = same origin)
    api.js         # API client (Bearer token)
    auth.js        # Telegram initData → POST /auth, store token
    app.js         # Main UI: auth, navigation, screens
  README.md
```

When you move this to a separate project, keep the same structure so the app keeps working. Only change `config.js` if the API is on another domain.

## Setup

1. **Same domain (e.g. WordPress and Mini App on one site)**  
   - Copy the contents of `mini-app/` to a path on your WordPress server, e.g. `https://yoursite.com/mini-app/`.  
   - In `config.js` leave `API_BASE_URL` empty (or set to `window.location.origin`).  
   - In BotFather (or Bot Settings) set the Mini App URL to `https://yoursite.com/mini-app/`.

2. **Different domain (e.g. Mini App on Netlify, backend on WordPress)**  
   - Set `API_BASE_URL` in `config.js` to your WordPress URL, e.g. `https://wp.yoursite.com`.  
   - Backend (plugin) already sends CORS headers for `/wp-json/hr/` so the browser will allow requests.  
   - Set the Mini App URL in Telegram to your frontend URL.

## Flow

1. User opens the Mini App from Telegram (menu or button in the bot).
2. `auth.js` reads `Telegram.WebApp.initData` and sends it to `POST /wp-json/hr/v1/auth`.
3. Backend validates initData, creates or finds the user, returns a **token**.
4. Frontend stores the token and sends `Authorization: Bearer <token>` on every API request.
5. `app.js` loads profile (`GET /me`) and shows home screen with links to Vacancies, My resume, Applications, Matches, etc.

## Local testing (without Telegram)

Open the app with **`?dev=1`** in the URL. Set `API_BASE_URL` in `js/config.js` to your WordPress URL. In WordPress admin console run:
`fetch('/wp-json/hr/v1/dev-token', {credentials:'include', headers:{'X-WP-Nonce':wpApiSettings.nonce}}).then(r=>r.json()).then(d=>alert(d.token))`
Copy the token and paste it in the dev form in the Mini App. You can then use all screens. Next time you can open with `?dev=1&token=YOUR_TOKEN`.

## Testing without Telegram (legacy note)

- From a normal browser you don’t have `initData`, so auth will fail.  
- To test the UI locally, you can temporarily add a “dev login” that calls your backend with a test token or cookie (e.g. only if `?dev=1` and same origin).  
- Real testing: open the Mini App from the Telegram client (mobile or desktop) using the bot’s Mini App link.
