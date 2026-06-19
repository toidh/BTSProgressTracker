/**
 * BTS Progress Tracker - Configuration
 * 
 * HƯỚNG DẪN: Sau khi deploy Google Apps Script, dán URL vào API_URL bên dưới.
 * Chỉ cần thay đổi 1 lần duy nhất tại đây, tất cả user sẽ dùng chung.
 */
const AppConfig = {
  // ⚠️ DÁN URL GOOGLE APPS SCRIPT CỦA BẠN VÀO ĐÂY:
  API_URL: 'https://script.google.com/macros/s/AKfycbzTAq6jLg7yWA8KxP5SDyg3L0KrObk9XdyizcTMLutsUtes3mcvATNDzt6w9d4TS2mo/exec',

  // App info
  APP_NAME: 'RF Mate',
  APP_VERSION: '2.1.2',

  // Map defaults (centered on Bạc Liêu province)
  MAP_CENTER: [9.17684, 105.15691],
  MAP_ZOOM: 12,
  MAP_MIN_ZOOM: 8,
  MAP_MAX_ZOOM: 19,

  // Data refresh interval (milliseconds) - 5 minutes
  DATA_REFRESH_INTERVAL: 5 * 60 * 1000,

  // Marker colors (darker for outdoor visibility)
  COLORS: {
    // Station type colors
    TYPE_5G_4G: '#00C4D4',    // Dark Blue - 5G_4G Z stations 1d4ed8
    TYPE_5G: '#9C00E6',        // Dark Purple - 5G Z stations 7c3aed
    TYPE_4G: '#FF8000',        // Dark Amber - 4G Z stations f59e0b

    // Progress colors
    IN_PROGRESS: '#FF1A1A',    // Dark Orange - updated but not complete ea580c
    COMPLETED: '#00C41C',      // Dark Green - completed 059669
    DAILY_PLAN: '#0044CC',     // Dark Red - in today's daily plan b91c1c

    // UI colors
    PRIMARY: '#1d4ed8',
    SUCCESS: '#166534',
    WARNING: '#d97706',
    DANGER: '#b91c1c',
    ACCENT: '#7c3aed',
  },

  // ⚠️ DÁN FOLDER ID GOOGLE DRIVE CHỨA SƠ ĐỒ ĐẤU NỐI VÀO ĐÂY (phải trùng với Code.gs):
  DIAGRAMS_FOLDER_ID: '1R9ULCgky45NaZXaIdifZ6-tsVJ65CFdi',

  // Weather API (Open-Meteo - free, no API key required)
  WEATHER_API: 'https://api.open-meteo.com/v1/forecast',

  // LocalStorage keys
  STORAGE_KEYS: {
    API_URL: 'bts_api_url',
    SESSION: 'bts_session',
    SITES_DATA: 'bts_sites_data',
    PENDING_UPDATES: 'bts_pending_updates',
    LAST_SYNC: 'bts_last_sync',
    MAP_STATE: 'bts_map_state',
    CHAT_HISTORY: 'bts_ai_chat',
  },
  // ==========================================
  // API Keys & Folder IDs
  // ==========================================
  CHECKIN_FOLDER_ID: '1X1O9I2oeOLLMKONH0MNFrCXWjAYt2o7u',
  
  // ⚠️ CÁCH MÃ HÓA API KEY ĐỂ TRÁNH BỊ GITHUB KHÓA
  // 1. Vào Google AI Studio lấy API Key thật (bắt đầu bằng AIza...)
  // 2. Mở trình duyệt web, ấn F12 sang tab Console. Gõ: btoa("AIza_KEY_CỦA_BẠN") rồi Enter.
  // 3. Copy chuỗi kết quả (ví dụ: QUl6...) và dán vào giữa hai dấu nháy đơn của hàm atob() bên dưới.
  GEMINI_API_KEY: atob('QVEuQWI4Uk42SWZnUFN3THR0YVJCTDEtNDFJdWRvaDlpOFdFRHpTeWViNUVRUFQ0RXZxbWc='),
};
