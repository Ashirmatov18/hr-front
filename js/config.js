/**
 * Mini App config. When you move the front to a separate host, change API_BASE_URL.
 */
(function () {
  window.HR_CONFIG = {
    // Base URL of your WordPress site — only the site root, e.g. http://hr-ecosystem.local (no /wp-admin/...)
    API_BASE_URL: 'https://diarch-validatory-maira.ngrok-free.dev',
    // Optional: paste dev token here for local testing (get it from WP admin console). Leave empty to use the form.
    DEV_TOKEN: '',
  };

  // If empty, use current origin (Mini App and WP on same domain)
  if (!window.HR_CONFIG.API_BASE_URL && typeof window !== 'undefined' && window.location && window.location.origin) {
    window.HR_CONFIG.API_BASE_URL = window.location.origin;
  }
})();
