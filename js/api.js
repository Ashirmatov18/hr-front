/**
 * API client for HR backend. Uses Bearer token from auth.
 */
(function () {
  function getToken() {
    if (window.HR_TOKEN) return window.HR_TOKEN;
    try {
      return window.localStorage.getItem('hr_token');
    } catch (e) { return null; }
  }

  function getBase() {
    var base = (window.HR_CONFIG && window.HR_CONFIG.API_BASE_URL) || '';
    return base.replace(/\/$/, '') + '/wp-json/hr/v1';
  }

  function request(method, path, body) {
    var url = getBase() + path;
    if (method === 'GET') {
      url += (url.indexOf('?') === -1 ? '?' : '&') + '_hrts=' + Date.now();
    }
    var base = (window.HR_CONFIG && window.HR_CONFIG.API_BASE_URL) || '';
    var isNgrok = base.indexOf('ngrok') !== -1;
    var opts = {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    if (isNgrok) {
      opts.headers['ngrok-skip-browser-warning'] = 'true';
    }
    var token = getToken();
    if (token) {
      opts.headers['Authorization'] = 'Bearer ' + token;
      opts.headers['X-HR-Token'] = token;
    }
    if (body !== undefined && body !== null) {
      opts.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    return fetch(url, opts).then(function (res) {
      var contentType = res.headers.get('content-type') || '';
      return res.text().then(function (text) {
        var data;
        var isJson = contentType.indexOf('application/json') !== -1;
        if (isJson && text) {
          try {
            data = JSON.parse(text);
          } catch (e) {
            if (text.trim().indexOf('<') === 0) {
              var err = new Error('Server returned HTML instead of JSON. Check API URL (config.js), CORS and ngrok.');
              err.status = res.status;
              err.data = text.substring(0, 200);
              throw err;
            }
            throw new Error('Invalid JSON from server: ' + text.substring(0, 80));
          }
        } else {
          data = text;
        }
        if (!res.ok) {
          var err = new Error((data && data.message) || (data && data.code) || 'Request failed');
          err.status = res.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  function getWpBase() {
    var base = (window.HR_CONFIG && window.HR_CONFIG.API_BASE_URL) || '';
    return base.replace(/\/$/, '') + '/wp-json/wp/v2';
  }

  function uploadMedia(file) {
    var url = getWpBase() + '/media';
    var form = new FormData();
    form.append('file', file);
    var opts = {
      method: 'POST',
      body: form,
      headers: {},
    };
    if ((window.HR_CONFIG && window.HR_CONFIG.API_BASE_URL || '').indexOf('ngrok') !== -1) {
      opts.headers['ngrok-skip-browser-warning'] = 'true';
    }
    var token = getToken();
    if (token) {
      opts.headers['Authorization'] = 'Bearer ' + token;
    }
    return fetch(url, opts).then(function (res) {
      return res.text().then(function (text) {
        var data;
        try {
          data = text ? JSON.parse(text) : {};
        } catch (e) {
          if (text && text.trim().indexOf('<') === 0) {
            var err = new Error('Server returned HTML instead of JSON. Check API URL and CORS.');
            err.status = res.status;
            throw err;
          }
          throw new Error('Invalid server response');
        }
        if (!res.ok) {
          var err = new Error(data.message || data.code || 'Upload failed');
          err.status = res.status;
          err.data = data;
          throw err;
        }
        return data;
      });
    });
  }

  window.HR_API = {
    get: function (path) {
      return request('GET', path);
    },
    getBase: getBase,
    getToken: getToken,
    post: function (path, body) {
      return request('POST', path, body);
    },
    patch: function (path, body) {
      return request('PATCH', path, body);
    },
    delete: function (path) {
      return request('DELETE', path);
    },
    setToken: function (token) {
      window.HR_TOKEN = token || null;
      try {
        if (token) window.localStorage.setItem('hr_token', token);
        else window.localStorage.removeItem('hr_token');
      } catch (e) {}
    },
    getToken: getToken,
    uploadMedia: uploadMedia,
    /** AI: generate resume title + content from prompt. Backend: POST /ai/generate-resume { prompt } => { title, content } */
    generateResume: function (prompt) {
      return request('POST', '/ai/generate-resume', { prompt: prompt || '' });
    },
    /** AI: parse raw vacancy text into title, content, skills, tags. Backend: POST /ai/parse-vacancy { raw_text } => { title, content, skills_required, tags } */
    parseVacancyWithAi: function (rawText) {
      return request('POST', '/ai/parse-vacancy', { raw_text: rawText || '' });
    },
  };
})();
