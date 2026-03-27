/**
 * Mini App config. When you move the front to a separate host, change API_BASE_URL.
 */
(function () {
  window.HR_CONFIG = {
    // App branding (UI labels)
    APP_TITLE: 'M&A CFO Club | HR',
    INSTRUCTION_TITLE: 'Инструкция',
    // Text for "Instruction" screen (can be edited without code changes)
    INSTRUCTION_TEXT: '',
    // Optional links to club services (can be Telegram deep links or website URLs)
    PUBLIC_CHAT_URL: '',
    CLUB_MEMBER_URL: '',
    // Base URL of the API (site root, no trailing slash)
    API_BASE_URL: 'https://macfo.club',
    // Web version URL — same app in browser (e.g. Vercel). Used by "Web version" button in Mini App.
    WEB_APP_URL: '',
    // Bot username for "Log in with Telegram" on web (e.g. "MyBot_bot"). Set in BotFather /setdomain for that domain.
    TELEGRAM_BOT_USERNAME: '',
    // Optional: paste dev token here for local testing (get it from WP admin console). Leave empty to use the form.
    DEV_TOKEN: '',
  };

  // If empty, use current origin (Mini App and WP on same domain)
  if (!window.HR_CONFIG.API_BASE_URL && typeof window !== 'undefined' && window.location && window.location.origin) {
        window.HR_CONFIG.API_BASE_URL = 'https://macfo.club';
  }
})();



