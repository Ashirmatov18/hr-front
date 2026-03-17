/**
 * Mini App config. When you move the front to a separate host, change API_BASE_URL.
 */
(function () {
  window.HR_CONFIG = {
    // Base URL of the API (site root, no trailing slash)
    API_BASE_URL: 'https://macfo.club',
    // Optional: paste dev token here for local testing (get it from WP admin console). Leave empty to use the form.
    DEV_TOKEN: '',
  };

  // If empty, use current origin (Mini App and WP on same domain)
  if (!window.HR_CONFIG.API_BASE_URL && typeof window !== 'undefined' && window.location && window.location.origin) {
        window.HR_CONFIG.API_BASE_URL = 'https://macfo.club';
  }
})();



