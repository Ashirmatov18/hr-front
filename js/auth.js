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
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: initData }),
    })
      .then(function (res) {
        return res.json().then(function (data) {
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
        return data;
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
    // Not in Telegram: try dev token (from URL, localStorage, or config)
    var token = getDevToken();
    if (token) {
    if (token) {
      window.HR_API.setToken(token);
      return window.HR_API.get('/me').then(function (me) {
        return me;
      }).catch(function () {
        window.HR_API.setToken(null);
        setDevToken(null);
        throw new Error('Invalid or expired token. Get a new one from WordPress admin.');
      });
    }
    throw new Error('DEV: No token. Get token from WordPress (see instructions) and paste below or set DEV_TOKEN in config.js');
  }
    return Promise.reject(new Error('Not opened in Telegram or initData missing'));
  }

  window.HR_AUTH = {
    getTelegramInitData: getTelegramInitData,
    isTelegramWebView: isTelegramWebView,
    login: login,
    ensureAuth: ensureAuth,
    isDevMode: isDevMode,
    getDevToken: getDevToken,
    setDevToken: setDevToken,
  };
})();
