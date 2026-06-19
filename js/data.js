/**
 * BTS Progress Tracker - Data & API Module
 */
const DataService = {
  // ============================================================
  // API Communication
  // ============================================================
  async apiCall(params, method = 'GET', body = null) {
    const apiUrl = Storage.getApiUrl();
    if (!apiUrl) {
      throw new Error('API URL chưa được cấu hình');
    }

    try {
      let response;
      if (method === 'GET') {
        const queryString = new URLSearchParams(params).toString();
        response = await fetch(`${apiUrl}?${queryString}`, {
          method: 'GET',
          redirect: 'follow',
        });
      } else {
        response = await fetch(apiUrl, {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(body),
        });
      }

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[DataService] API call failed:', error);
      throw error;
    }
  },

  // ============================================================
  // Authentication
  // ============================================================
  async login(username, password) {
    const result = await this.apiCall({
      action: 'login',
      username: username,
      password: password,
    });
    return result;
  },

  // ============================================================
  // Fetch Sites
  // ============================================================
  async fetchSites() {
    try {
      const result = await this.apiCall({ action: 'getSites' });
      if (result.success) {
        Storage.setSitesData(result.sites);
        Storage.setLastSync();
        return result.sites;
      }
      throw new Error(result.error || 'Failed to fetch sites');
    } catch (error) {
      // Fallback to cached data
      console.warn('[DataService] Fetch failed, using cache:', error.message);
      const cached = Storage.getSitesData();
      if (cached && cached.sites) {
        return cached.sites;
      }
      throw error;
    }
  },

  // ============================================================
  // Fetch Sectors
  // ============================================================
  async fetchSectors() {
    try {
      const result = await this.apiCall({ action: 'getSectors' });
      if (result.success) {
        return result.sectors || [];
      }
      return [];
    } catch (error) {
      console.warn('[DataService] Fetch sectors failed:', error.message);
      return [];
    }
  },

  // ============================================================
  // Update Progress
  // ============================================================
  async updateProgress(siteData) {
    try {
      const result = await this.apiCall(null, 'POST', {
        action: 'updateProgress',
        site: siteData.site,
        progress4G: siteData.progress4G,
        progress5G: siteData.progress5G,
        note: siteData.note,
        username: siteData.username,
      });

      if (result.success) {
        // Remove from pending if exists
        Storage.removePendingUpdate(siteData.site);

        // Update local cache
        this.updateLocalCache(siteData);
      }

      return result;
    } catch (error) {
      console.warn('[DataService] Update failed, saving offline:', error.message);
      // Save for offline sync
      Storage.addPendingUpdate({
        ...siteData,
        savedAt: new Date().toISOString(),
      });

      // Still update local cache
      this.updateLocalCache(siteData);

      return {
        success: true,
        offline: true,
        message: 'Đã lưu offline. Sẽ đồng bộ khi có mạng.',
      };
    }
  },

  // ============================================================
  // Sync Pending Updates
  // ============================================================
  async syncPendingUpdates() {
    const pending = Storage.getPendingUpdates();
    if (pending.length === 0) return { synced: 0 };

    try {
      const result = await this.apiCall(null, 'POST', {
        action: 'batchUpdate',
        updates: pending,
      });

      if (result.success) {
        Storage.clearPendingUpdates();
        return { synced: pending.length, ...result };
      }
      return { synced: 0, error: result.message };
    } catch (error) {
      return { synced: 0, error: error.message };
    }
  },

  // ============================================================
  // Local Cache Management
  // ============================================================
  updateLocalCache(siteData) {
    const cached = Storage.getSitesData();
    if (!cached || !cached.sites) return;

    const sites = cached.sites;
    const index = sites.findIndex(s => s['Site'] === siteData.site);
    if (index >= 0) {
      sites[index]['Tiến độ 4G'] = siteData.progress4G;
      sites[index]['Tiến độ 5G'] = siteData.progress5G;
      sites[index]['Ghi chú (TKTU ONSITE)'] = siteData.note || '';
      sites[index]['User cập nhật'] = siteData.username || '';
      sites[index]['Ngày cập nhật'] = new Date().toLocaleString('vi-VN');

      // Calculate completion
      const classification = String(sites[index]['Phân loại'] || '').trim();
      let p4g = String(siteData.progress4G || '').trim();
      let p5g = String(siteData.progress5G || '').trim();
      if (p4g === '') p4g = 'Chưa thực hiện';
      if (p5g === '') p5g = 'Chưa thực hiện';

      let trangThai = 'Chưa thực hiện';
      if (classification === '5G_4G Z') {
        if (p4g === 'Hoàn thành' && p5g === 'Hoàn thành') trangThai = 'Hoàn thành';
        else if (p4g === 'Đang thực hiện' || p5g === 'Đang thực hiện' || p4g === 'Hoàn thành' || p5g === 'Hoàn thành') trangThai = 'Đang thực hiện';
      } else if (classification === '5G Z') {
        if (p5g === 'Hoàn thành') trangThai = 'Hoàn thành';
        else if (p5g === 'Đang thực hiện') trangThai = 'Đang thực hiện';
      } else if (classification === '4G Z') {
        if (p4g === 'Hoàn thành') trangThai = 'Hoàn thành';
        else if (p4g === 'Đang thực hiện') trangThai = 'Đang thực hiện';
      }

      sites[index]['Status'] = trangThai;
      Storage.setSitesData(sites);
    }
  },

  // ============================================================
  // Helper: Get site status for coloring
  // ============================================================
  getSiteStatus(site) {
    if (!site) return 'pending';
    const trangThai = String(site['Status'] || '').trim();

    if (trangThai === 'Hoàn thành') return 'completed';
    if (trangThai === 'Đang thực hiện') return 'in_progress';
    
    // Not updated - color by type
    const classification = String(site['Phân loại'] || '').trim();
    if (classification === '5G_4G Z') {
      return 'type_5g_4g';
    }
    if (classification === '5G Z') {
      return 'type_5g';
    }

    return 'type_4g'; // Default: 4G Z or unknown
  },

  // ============================================================
  // Helper: Check if site is in today's daily plan
  // ============================================================
  isDailyPlan(site) {
    const dateVal = site['Kế hoạch ngày'];
    if (!dateVal) return false;
    const str = String(dateVal).trim();
    if (!str) return false;

    const today = new Date();
    const todayDay = today.getDate();
    const todayMonth = today.getMonth();
    const todayYear = today.getFullYear();

    // Try dd/MM/yyyy
    let m1 = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    if (m1) {
      return parseInt(m1[1]) === todayDay && parseInt(m1[2]) === (todayMonth + 1) && parseInt(m1[3]) === todayYear;
    }

    // Try yyyy-MM-dd
    let m2 = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (m2) {
      return parseInt(m2[3]) === todayDay && parseInt(m2[2]) === (todayMonth + 1) && parseInt(m2[1]) === todayYear;
    }

    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return d.getDate() === todayDay && d.getMonth() === todayMonth && d.getFullYear() === todayYear;
      }
    } catch (e) {}

    return false;
  },

  getStatusColor(status, site) {
    // Daily plan sites that are NOT completed or in_progress get red color
    if (site && status !== 'completed' && status !== 'in_progress' && this.isDailyPlan(site)) {
      return AppConfig.COLORS.DAILY_PLAN;
    }
    switch (status) {
      case 'completed': return AppConfig.COLORS.COMPLETED;
      case 'in_progress': return AppConfig.COLORS.IN_PROGRESS;
      case 'type_5g_4g': return AppConfig.COLORS.TYPE_5G_4G;
      case 'type_5g': return AppConfig.COLORS.TYPE_5G;
      case 'type_4g': return AppConfig.COLORS.TYPE_4G;
      default: return AppConfig.COLORS.TYPE_4G;
    }
  },

  getStatusLabel(status) {
    switch (status) {
      case 'completed': return 'Hoàn thành';
      case 'in_progress': return 'Đang thực hiện';
      case 'type_5g_4g': return '5G_4G Z - Chưa cập nhật';
      case 'type_5g': return '5G Z - Chưa cập nhật';
      case 'type_4g': return '4G Z - Chưa cập nhật';
      default: return 'Chưa phân loại';
    }
  },

  // ============================================================
  // Test API connection
  // ============================================================
  async testConnection() {
    try {
      const result = await this.apiCall({ action: 'ping' });
      return result.success === true;
    } catch (error) {
      return false;
    }
  },

  // ============================================================
  // SEARCH SITE ONLINE & DICTIONARY
  // ============================================================
  async searchSiteOnline(siteName) {
    try {
      const result = await this.apiCall({ action: 'searchSiteOnline', site: siteName });
      return result;
    } catch (e) {
      console.error('Lỗi khi tìm kiếm trạm online:', e);
      return { success: false, error: e.message };
    }
  },

  async fetchSiteDictionary() {
    try {
      const result = await this.apiCall({ action: 'getSiteDictionary' });
      if (result.success && result.dictionary) {
        return result.dictionary;
      } else {
        console.error('API Error in getSiteDictionary:', result.error);
        alert('Lỗi lấy từ điển trạm từ máy chủ: ' + (result.error || result.message || 'Lỗi không xác định. Vui lòng kiểm tra lại tên Sheet "Map_data" và cột "Site".'));
        return [];
      }
    } catch (e) {
      console.error('Network Error in getSiteDictionary:', e);
      alert('Lỗi mạng khi lấy từ điển: ' + e.message);
      return [];
    }
  },

  // ============================================================
  // CHECK-IN, COMMENTS, AND AI
  // ============================================================
  async checkinSite(data) {
    try {
      const result = await this.apiCall(null, 'POST', { action: 'checkinSite', ...data });
      return result;
    } catch (error) {
      console.error('[DataService] checkinSite failed:', error);
      return { success: false, error: error.message };
    }
  },

  async getComments(siteName) {
    try {
      const result = await this.apiCall({ action: 'getComments', site: siteName });
      return result.success ? result.comments : [];
    } catch (error) {
      console.error('[DataService] getComments failed:', error);
      return [];
    }
  },

  async addComment(data) {
    try {
      const result = await this.apiCall(null, 'POST', { action: 'addComment', ...data });
      return result;
    } catch (error) {
      console.error('[DataService] addComment failed:', error);
      return { success: false, error: error.message };
    }
  },

  async uploadPhoto(data) {
    try {
      const result = await this.apiCall(null, 'POST', { action: 'uploadPhoto', ...data });
      return result;
    } catch (error) {
      console.error('[DataService] uploadPhoto failed:', error);
      return { success: false, error: error.message };
    }
  },

  async getAIKnowledge() {
    try {
      const cachedText = localStorage.getItem('bts_ai_knowledge_text');
      const cachedHash = cachedText ? (localStorage.getItem('bts_ai_knowledge_hash') || '') : '';
      const result = await Promise.race([
        this.apiCall({ action: 'getAIKnowledge', cachedHash: cachedHash }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout: Server xử lý quá lâu (có thể do đang đọc file PDF lớn)")), 15000))
      ]);
      return result;
    } catch (error) {
      console.error('[DataService] getAIKnowledge failed:', error);
      return { success: false, error: error.message };
    }
  }
};

window.DataService = DataService;
