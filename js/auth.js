/**
 * Telegram Mini App auth: get initData, call backend /auth, store token.
 */
(function () {
  function getTelegramInitData() {
    if (typeof window.Telegram !== 'undefined' && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
      return window.Telegram.WebApp.initData;
    }
    return '';
  }

  function isTelegramWebView() {
    return typeof window.Telegram !== 'undefined' && window.Telegram.WebApp;
  }

  /**
   * Call backend POST /auth with initData. On success, stores token and returns profile data.
   */
  function login() {
    var initData = getTelegramInitData();
    if (!initData) {
      return Promise.reject(new Error('Not opened in Telegram or initData missing'));
    }
    var base = (window.HR_CONFIG && window.HR_CONFIG.API_BASE_URL) || window.location.origin;
    var url = base.replace(/\/$/, '') + '/wp-json/hr/v1/auth';
    var headers = { 'Content-Type': 'application/json' };
    if (base.indexOf('ngrok') !== -1) headers['ngrok-skip-browser-warning'] = 'true';
    return fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ initData: initData }),
    })
      .then(function (res) {
        return res.text().then(function (text) {
          var data;
          try {
            data = text ? JSON.parse(text) : {};
          } catch (e) {
            if (text && text.trim().indexOf('<') === 0) {
              throw new Error('Server returned HTML instead of JSON. Check: 1) API URL in config.js (e.g. ngrok URL), 2) CORS on backend, 3) ngrok — open the URL once in browser and confirm if it shows a warning.');
            }
            throw new Error('Invalid server response: ' + (text ? text.substring(0, 100) : res.status));
          }
          if (!res.ok) {
            var err = new Error(data.message || 'Auth failed');
            err.status = res.status;
            err.data = data;
            throw err;
          }
          return data;
        });
      })
      .then(function (data) {
        if (data.token) {
          window.HR_API.setToken(data.token);
        }
        return window.HR_API.get('/me').then(function (me) { return me; });
      });
  }

  function isDevMode() {
    return typeof window !== 'undefined' && window.location && window.location.search.indexOf('dev=1') !== -1;
  }

  function getDevToken() {
    if (typeof window === 'undefined' || !window.location) return null;
    var params = new URLSearchParams(window.location.search);
    var t = params.get('token');
    if (t) return t;
    try {
      t = window.localStorage.getItem('hr_dev_token');
      if (t) return t;
    } catch (e) {}
    if (window.HR_CONFIG && window.HR_CONFIG.DEV_TOKEN) {
      return window.HR_CONFIG.DEV_TOKEN;
    }
    return null;
  }

  function setDevToken(token) {
    try {
      window.localStorage.setItem('hr_dev_token', token || '');
    } catch (e) {}
  }

  /**
   * Ensure we have a valid session: if token exists, verify with GET /me; else try login() (or dev token).
   */
  function ensureAuth() {
    if (window.HR_API.getToken()) {
      return window.HR_API.get('/me').catch(function () {
        window.HR_API.setToken(null);
        if (isDevMode()) setDevToken(null);
        return loginOrDev();
      });
    }
    return loginOrDev();
  }

  function loginOrDev() {
    var initData = getTelegramInitData();
    if (initData) {
      return login();
    }
    var token = getDevToken();
    if (!token && typeof window !== 'undefined' && window.localStorage) {
      try {
        token = window.localStorage.getItem('hr_token');
      } catch (e) {}
    }
    if (token) {
      window.HR_API.setToken(token);
      return window.HR_API.get('/me').then(function (me) {
        return me;
      }).catch(function () {
        window.HR_API.setToken(null);
        setDevToken(null);
        try { window.localStorage.removeItem('hr_token'); } catch (e) {}
        throw new Error('Invalid or expired token. Get a new one from the administrator.');
      });
    }
    throw new Error('DEV: No token. Get token from the admin (see instructions) and paste below or set DEV_TOKEN in config.js');
  }

  /**
   * If URL has Telegram Login Widget return params (id, auth_date, hash), POST to /auth/widget, save token, redirect to clean URL.
   * Returns a Promise that resolves to true if we handled redirect (caller should not continue init), or false.
   */
  function tryAuthFromWidgetRedirect() {
    if (typeof window === 'undefined' || !window.location || !window.location.search) return Promise.resolve(false);
    var params = new URLSearchParams(window.location.search);
    var id = params.get('id');
    var auth_date = params.get('auth_date');
    var hash = params.get('hash');
    if (!id || !auth_date || !hash) return Promise.resolve(false);
    var base = (window.HR_CONFIG && window.HR_CONFIG.API_BASE_URL) || window.location.origin;
    var url = base.replace(/\/$/, '') + '/wp-json/hr/v1/auth/widget';
    var body = {
      id: parseInt(id, 10),
      auth_date: parseInt(auth_date, 10),
      hash: hash,
      first_name: params.get('first_name') || '',
      last_name: params.get('last_name') || '',
      username: params.get('username') || '',
      photo_url: params.get('photo_url') || '',
    };
    var headers = { 'Content-Type': 'application/json' };
    if (base.indexOf('ngrok') !== -1) headers['ngrok-skip-browser-warning'] = 'true';
    return fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body) })
      .then(function (res) { return res.json().catch(function () { return {}; }); })
      .then(function (data) {
        if (data.token) {
          window.HR_API.setToken(data.token);
          try { window.localStorage.setItem('hr_token', data.token); } catch (e) {}
          var clean = window.location.origin + window.location.pathname + (window.location.pathname.indexOf('?') !== -1 ? '' : '');
          window.location.replace(clean || window.location.origin + '/');
          return true;
        }
        return false;
      })
      .catch(function () { return false; });
  }

  window.HR_AUTH = {
    getTelegramInitData: getTelegramInitData,
    isTelegramWebView: isTelegramWebView,
    login: login,
    ensureAuth: ensureAuth,
    tryAuthFromWidgetRedirect: tryAuthFromWidgetRedirect,
    isDevMode: isDevMode,
    getDevToken: getDevToken,
    setDevToken: setDevToken,
  };
})();
