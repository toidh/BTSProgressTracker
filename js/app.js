/**
 * BTS Progress Tracker - Main Application Controller
 */
const App = {
  sites: [],
  refreshInterval: null,
  isOnline: navigator.onLine,

  // ============================================================
  // Initialize App
  // ============================================================
  async init() {
    // Register service worker
    this.registerSW();

    // Online/offline detection
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());

    // API URL được cấu hình sẵn trong config.js, vào thẳng app
    // Check login status
    if (Auth.isLoggedIn()) {
      await this.enterMainScreen();
    } else {
      this.showScreen('login-screen');
    }

    // Setup event listeners
    this.setupEventListeners();
  },

  // ============================================================
  // Service Worker Registration
  // ============================================================
  registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((reg) => {
        console.log('[App] Service Worker registered');
        
        // Auto check for updates when page becomes visible
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            reg.update();
          }
        });
      }).catch((err) => {
        console.warn('[App] SW registration failed:', err);
      });

      // Reload page when new service worker takes over
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          this.showToast('🔄 Đã phát hiện phiên bản mới, đang tự động xóa cache và tải lại...', 'success');
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      });
    }
  },

  // ============================================================
  // Event Listeners
  // ============================================================
  setupEventListeners() {
    // === Setup Screen ===
    const setupForm = document.getElementById('setup-form');
    if (setupForm) {
      setupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSetup();
      });
    }

    // === Login Form ===
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    }

    // === Search ===
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.handleSearch(e.target.value);
      });
      
      searchInput.addEventListener('focus', () => {
        document.getElementById('search-results').classList.add('visible');
      });
      // Close search on outside click
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#search-container')) {
          document.getElementById('search-results').classList.remove('visible');
        }
      });
    }

    // === GPS Button ===
    const gpsBtn = document.getElementById('gps-btn');
    if (gpsBtn) {
      gpsBtn.addEventListener('click', () => this.handleGPS());
    }

    // === Layer Toggle ===
    const layerBtn = document.getElementById('layer-btn');
    if (layerBtn) {
      layerBtn.addEventListener('click', () => this.handleLayerToggle());
    }

    // === Refresh Button ===
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.handleRefresh());
    }

    // === Dashboard Button ===
    const dashBtn = document.getElementById('dashboard-btn');
    if (dashBtn) {
      dashBtn.addEventListener('click', () => this.openDashboard());
    }

    const dashCloseBtn = document.getElementById('dashboard-close-btn');
    if (dashCloseBtn) {
      dashCloseBtn.addEventListener('click', () => this.closeDashboard());
    }

    // === User Menu ===
    const userMenuBtn = document.getElementById('user-menu-btn');
    if (userMenuBtn) {
      userMenuBtn.addEventListener('click', () => this.toggleUserMenu());
    }

    // === Logout ===
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }

    // === Modal Close ===
    const modalOverlay = document.getElementById('site-modal-overlay');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) this.closeSiteModal();
      });
    }

    // Modals
    document.getElementById('modal-close-btn')?.addEventListener('click', () => this.closeSiteDetail());
    document.getElementById('navigate-btn')?.addEventListener('click', () => this.handleNavigate());
    document.getElementById('update-form')?.addEventListener('submit', (e) => this.handleUpdateProgress(e));

    // New Features
    document.getElementById('checkin-btn')?.addEventListener('click', () => {
      const cameraInput = document.getElementById('checkin-camera');
      if (cameraInput) cameraInput.click();
    });
    
    document.getElementById('checkin-camera')?.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.processCheckinPhoto(e.target.files[0]);
      }
    });

    document.getElementById('compass-btn')?.addEventListener('click', () => {
      if (window.CompassAR && this.currentSiteSectors) {
        window.CompassAR.openCompass(this.currentSiteSectors, this.currentSite);
      } else {
        this.showToast('La bàn chưa sẵn sàng', 'error');
      }
    });

    document.getElementById('comment-submit')?.addEventListener('click', () => this.submitComment());

    document.getElementById('ai-assistant-btn')?.addEventListener('click', () => {
      if (window.AIAssistant) window.AIAssistant.openChat();
    });

    // === Settings ===
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.showSettings());
    }

    // Close user menu on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#user-menu-container')) {
        const menu = document.getElementById('user-dropdown');
        if (menu) menu.classList.remove('visible');
      }
    });
  },

  // ============================================================
  // Screen Management
  // ============================================================
  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    const screen = document.getElementById(screenId);
    if (screen) screen.classList.add('active');
  },

  // ============================================================
  // Setup Handler
  // ============================================================
  async handleSetup() {
    const urlInput = document.getElementById('api-url-input');
    const url = urlInput.value.trim();
    const errorEl = document.getElementById('setup-error');

    if (!url) {
      errorEl.textContent = 'Vui lòng nhập URL';
      errorEl.classList.add('visible');
      return;
    }

    this.showLoading('Đang kiểm tra kết nối...');
    Storage.setApiUrl(url);

    try {
      const connected = await DataService.testConnection();
      if (connected) {
        this.hideLoading();
        this.showScreen('login-screen');
        this.showToast('Kết nối thành công!', 'success');
      } else {
        throw new Error('Server không phản hồi');
      }
    } catch (error) {
      this.hideLoading();
      errorEl.textContent = 'Không thể kết nối: ' + error.message;
      errorEl.classList.add('visible');
      Storage.setApiUrl('');
    }
  },

  // ============================================================
  // Login Handler
  // ============================================================
  async handleLogin() {
    const username = document.getElementById('login-username').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value.trim();
    const errorEl = document.getElementById('login-error');

    if (!username || !password) {
      errorEl.textContent = 'Vui lòng nhập đầy đủ thông tin';
      errorEl.classList.add('visible');
      return;
    }

    this.showLoading('Đang đăng nhập...');
    errorEl.classList.remove('visible');

    try {
      const result = await Auth.login(username, password);
      this.hideLoading();

      if (result.success) {
        if (!result.user || result.user.backendVersion !== 'v31') {
          alert('CẢNH BÁO: Ứng dụng đang gọi đến phiên bản Code.gs cũ! Bạn CẦN Deploy phiên bản Code mới nhất trên Apps Script VÀ đảm bảo bạn không tạo New Deployment mới khiến URL thay đổi.');
        }
        this.showToast(`Xin chào, ${Auth.getDisplayName()}!`, 'success');
        await this.enterMainScreen();
      } else {
        errorEl.textContent = result.message || 'Đăng nhập thất bại';
        errorEl.classList.add('visible');
        this.shakeElement(document.getElementById('login-form'));
      }
    } catch (error) {
      this.hideLoading();
      errorEl.textContent = 'Lỗi kết nối: ' + error.message;
      errorEl.classList.add('visible');
    }
  },

  // ============================================================
  // Enter Main Screen
  // ============================================================
  async enterMainScreen() {
    document.body.dataset.role = Auth.getRole();
    this.showScreen('main-screen');

    // Update user display
    const userNameEl = document.getElementById('user-display-name');
    if (userNameEl) {
      userNameEl.textContent = Auth.getDisplayName();
    }

    // Initialize map
    if (!MapManager.map) {
      MapManager.init();
    }

    // Load data
    this.showLoading('Đang tải dữ liệu...');
    try {
      if (!['view_limited', 'doitac'].includes(Auth.getRole())) {
        this.sites = await DataService.fetchSites();
        MapManager.loadSites(this.sites);
        this.updateStats();
        // Load sectors
        DataService.fetchSectors().then(sectors => MapManager.loadSectors(sectors));
      } else {
        // Online-only view limited
        this.sites = [];
        this.siteDictionary = await DataService.fetchSiteDictionary();
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
          searchInput.placeholder = 'Nhập mã trạm để tìm kiếm...';
        }
      }

      // Sync pending updates
      const pending = Storage.getPendingUpdates();
      if (pending.length > 0 && this.isOnline) {
        const syncResult = await DataService.syncPendingUpdates();
        if (syncResult.synced > 0) {
          this.showToast(`Đã đồng bộ ${syncResult.synced} cập nhật offline`, 'success');
          this.sites = await DataService.fetchSites();
          if (!['view_limited', 'doitac'].includes(Auth.getRole())) {
            MapManager.loadSites(this.sites);
          }
        }
      }

      this.hideLoading();
    } catch (error) {
      this.hideLoading();
      console.error('[App] Failed to load data:', error);
      this.showToast('Lỗi tải dữ liệu: ' + error.message, 'error');
    }

    // Auto refresh
    this.startAutoRefresh();

    // Start GPS watch
    MapManager.startWatchingPosition();
  },

  // ============================================================
  // Search Handlers
  // ============================================================
  async searchOnline(query) {
    query = query.trim();
    if (!query) return;
    this.showLoading('Đang tìm kiếm online...');
    try {
      const result = await DataService.searchSiteOnline(query);
      this.hideLoading();
      if (result.success && result.site) {
        this.sites = [result.site];
        MapManager.loadSingleSite(result.site);
        if (result.sectors) {
          MapManager.setSectorData(result.sectors);
          MapManager.loadSectorsForSite(result.site['Site']);
        }
        document.getElementById('search-results').classList.remove('visible');
        this.showToast('Đã tìm thấy trạm', 'success');
      } else {
        this.showToast(result.error || 'Không tìm thấy trạm', 'error');
      }
    } catch (e) {
      this.hideLoading();
      this.showToast('Lỗi tìm kiếm: ' + e.message, 'error');
    }
  },

  handleSearch(query) {
    const resultsEl = document.getElementById('search-results');
    if (!query || query.length < 1) {
      resultsEl.innerHTML = '';
      resultsEl.classList.remove('visible');
      return;
    }

    const q = query.toLowerCase();
    
    // View Limited Role uses Site Dictionary for fast autocomplete
    if (['view_limited', 'doitac'].includes(Auth.getRole())) {
      const dict = this.siteDictionary || [];
      const matches = dict.filter(name => name.toLowerCase().includes(q)).slice(0, 10);
      
      if (matches.length === 0) {
        resultsEl.innerHTML = '<div class="search-no-result">Không tìm thấy trạm nào</div>';
        resultsEl.classList.add('visible');
        return;
      }
      
      resultsEl.innerHTML = matches.map(siteName => {
        return `
          <div class="search-result-item" onclick="App.selectSearchResult('${siteName}')">
            <div class="search-result-dot" style="background:var(--color-blue)"></div>
            <div class="search-result-info">
              <div class="search-result-name">${siteName}</div>
              <div class="search-result-detail">Nhấn để tải dữ liệu trạm này</div>
            </div>
          </div>
        `;
      }).join('');
      resultsEl.classList.add('visible');
      return;
    }

    // Admin/Manager Role uses local full data
    const matches = this.sites.filter((s) => {
      const siteName = (s['Site'] || '').toLowerCase();
      const huyen = (s['Huyện'] || '').toLowerCase();
      const doiTac = (s['Đối tác'] || '').toLowerCase();
      return siteName.includes(q) || huyen.includes(q) || doiTac.includes(q);
    }).slice(0, 10);

    if (matches.length === 0) {
      resultsEl.innerHTML = '<div class="search-no-result">Không tìm thấy trạm nào</div>';
      resultsEl.classList.add('visible');
      return;
    }

    resultsEl.innerHTML = matches.map((site) => {
      const status = DataService.getSiteStatus(site);
      const color = DataService.getStatusColor(status, site);
      const statusLabel = DataService.getStatusLabel(status);
      return `
        <div class="search-result-item" onclick="App.selectSearchResult('${site['Site']}')">
          <div class="search-result-dot" style="background:${color}"></div>
          <div class="search-result-info">
            <div class="search-result-name">${site['Site']}</div>
            <div class="search-result-detail">${site['Huyện'] || ''} • ${site['Phân loại'] || ''} • ${statusLabel}</div>
          </div>
        </div>
      `;
    }).join('');
    resultsEl.classList.add('visible');
  },

  selectSearchResult(siteName) {
    document.getElementById('search-input').value = siteName;
    document.getElementById('search-results').classList.remove('visible');

    // view_limited: fetch full data online and load it
    if (['view_limited', 'doitac'].includes(Auth.getRole())) {
      this.searchOnline(siteName);
    } else {
      MapManager.flyToSite(siteName);
    }
  },

  // ============================================================
  // GPS Handler
  // ============================================================
  async handleGPS() {
    const btn = document.getElementById('gps-btn');
    btn.classList.add('loading');

    try {
      await MapManager.getCurrentLocation();
      btn.classList.remove('loading');
      btn.classList.add('active');
      this.showToast('Đã xác định vị trí của bạn', 'success');
    } catch (error) {
      btn.classList.remove('loading');
      if (error.message !== 'Hết thời gian chờ vị trí') {
        this.showToast(error.message, 'error');
      }
    }
  },

  // ============================================================
  // Layer Toggle
  // ============================================================
  handleLayerToggle() {
    const layer = MapManager.toggleLayer();
    const btn = document.getElementById('layer-btn');
    const icon = btn.querySelector('.layer-icon');

    if (layer === 'satellite') {
      btn.classList.add('satellite');
      if (icon) icon.textContent = '🗺️';
    } else {
      btn.classList.remove('satellite');
      if (icon) icon.textContent = '🛰️';
    }
  },

  // ============================================================
  // Show Site Detail Modal
  // ============================================================
  showSiteDetail(site) {
    const modal = document.getElementById('site-modal-overlay');
    const status = DataService.getSiteStatus(site);
    const color = DataService.getStatusColor(status, site);
    const statusLabel = DataService.getStatusLabel(status);

    // Populate modal
    document.getElementById('modal-site-name').textContent = site['Site'] || '';
    document.getElementById('modal-site-name').style.color = color;
    document.getElementById('modal-status-badge').textContent = statusLabel;
    document.getElementById('modal-status-badge').style.background = color + '20';
    document.getElementById('modal-status-badge').style.color = color;

    // Info fields
    document.getElementById('modal-phan-loai').textContent = site['Phân loại'] || '-';
    document.getElementById('modal-phuong-an').textContent = site['Phương án Swap'] || '-';
    document.getElementById('modal-huyen').textContent = site['Huyện'] || '-';
    document.getElementById('modal-doi-tac').textContent = site['Đối tác'] || '-';
    document.getElementById('modal-doi-thuc-hien').textContent = site['Đội thực hiện'] || '-';
    document.getElementById('modal-sdt').textContent = site['SĐT'] || '-';
    document.getElementById('modal-ft').textContent = site['FT'] || '-';
    document.getElementById('modal-sdt-ft').textContent = site['SĐT FT'] || '-';
    document.getElementById('modal-tktu').textContent = site['TKTU ONSITE'] || '-';
    document.getElementById('modal-sdt-tktu').textContent = site['SĐT TKTU ONSITE'] || '-';
    document.getElementById('modal-note-tktu').textContent = site['NOTE'] || site['NOTE TKTU'] || '-';

    // Integration Info
    document.getElementById('modal-ip').textContent = site['IP'] || '-';
    document.getElementById('modal-srt').textContent = site['SRT'] || '-';
    document.getElementById('modal-port').textContent = site['Port'] || '-';

    // Last update info
    const lastUser = site['User cập nhật'] || '-';
    const lastDate = site['Ngày cập nhật'] || '-';
    document.getElementById('modal-last-update').textContent = `${lastUser} - ${lastDate}`;

    // Form values
    const p4g = String(site['Tiến độ 4G'] || '').trim();
    const p5g = String(site['Tiến độ 5G'] || '').trim();
    const getProgVal = (v) => {
      if (v === 'Hoàn thành') return 'Hoàn thành';
      if (v === 'Đang thực hiện') return 'Đang thực hiện';
      return 'Chưa thực hiện';
    };
    document.getElementById('update-4g').value = getProgVal(p4g);
    document.getElementById('update-5g').value = getProgVal(p5g);
    document.getElementById('update-note').value = '';

    // Toggle 4G/5G field visibility based on classification
    const classification = String(site['Phân loại'] || '').trim();
    const field4G = document.getElementById('field-4g');
    const field5G = document.getElementById('field-5g');
    if (classification === '4G Z') {
      field4G.style.display = '';
      field5G.style.display = 'none';
    } else if (classification === '5G Z') {
      field4G.style.display = 'none';
      field5G.style.display = '';
    } else {
      field4G.style.display = '';
      field5G.style.display = '';
    }

    // 5. Setup Action Buttons
    const lat = site['Lat'];
    const lng = site['Long'];
    const siteName = site['Site'];
    const navigateBtn = document.getElementById('navigate-btn');
    if (navigateBtn) {
      navigateBtn.onclick = () => MapManager.navigateToSite(lat, lng);
    }
    
    // Check-in and Compass buttons
    const checkinBtn = document.getElementById('checkin-btn');
    const role = Auth.getRole();

    const noteVal = String(site['Ghi chú (TKTU ONSITE)'] || '').trim();
    const historyEl = document.getElementById('update-note-history');
    if (historyEl) {
      historyEl.textContent = noteVal;
      historyEl.style.display = noteVal ? 'block' : 'none';
      setTimeout(() => historyEl.scrollTop = historyEl.scrollHeight, 10);
    }
    if (['admin', 'manager', 'doitac', 'export'].includes(role)) {
      if (checkinBtn) checkinBtn.style.display = 'flex';
    } else {
      if (checkinBtn) checkinBtn.style.display = 'none';
    }

    // Save site to context for checkin/compass
    this.currentSite = site;
    this.currentSiteSectors = MapManager.sectorData.filter(s => 
      String(s['Site'] || '').trim().toUpperCase() === String(site['Site'] || '').trim().toUpperCase()
    );

    // 6. Async Data Loads
    this.loadWeatherForecast(lat, lng);
      this.loadDiagrams(siteName);
      this.loadCheckinImage(site);
    this.loadSiteConfig(siteName);
    this.loadComments(siteName);

    // Store current site for update
    document.getElementById('update-form').dataset.siteName = site['Site'];
    document.getElementById('update-form').dataset.siteLat = site['Lat'];
    document.getElementById('update-form').dataset.siteLng = site['Long'];

    // Call buttons
    this.setupCallButtons(site);

    // Show modal
    this.showOverlay('site-modal-overlay');
  },

  setupCallButtons(site) {
    const callSdt = document.getElementById('call-sdt');
    const callFt = document.getElementById('call-sdt-ft');
    const callTktu = document.getElementById('call-sdt-tktu');

    if (callSdt) {
      const sdt = site['SĐT'] || '';
      callSdt.style.display = sdt ? '' : 'none';
      callSdt.onclick = () => window.open(`tel:${sdt}`);
    }
    if (callFt) {
      const sdt = site['SĐT FT'] || '';
      callFt.style.display = sdt ? '' : 'none';
      callFt.onclick = () => window.open(`tel:${sdt}`);
    }
    if (callTktu) {
      const sdt = site['SĐT TKTU ONSITE'] || '';
      callTktu.style.display = sdt ? '' : 'none';
      callTktu.onclick = () => window.open(`tel:${sdt}`);
    }
  },

  closeSiteModal() {
    document.getElementById('site-modal-overlay').classList.remove('visible');
    document.body.classList.remove('modal-open');
  },

  closeSiteDetail() {
    this.closeSiteModal();
  },

  // ============================================================
  // CHECK-IN & COMMENTS
  // ============================================================
  async processCheckinPhoto(file) {
    if (!this.currentSite) return;
    this.showLoading('Đang lấy tọa độ và xử lý ảnh...');
    
    try {
      // 1. Get GPS
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
      });
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      
      // 2. Draw watermark and compress
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise(r => img.onload = r);
      
      let width = img.width;
      let height = img.height;
      const MAX_SIZE = 1280;
      
      if (width > height && width > MAX_SIZE) {
        height = Math.round(height * MAX_SIZE / width);
        width = MAX_SIZE;
      } else if (height >= width && height > MAX_SIZE) {
        width = Math.round(width * MAX_SIZE / height);
        height = MAX_SIZE;
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      const fontSize = Math.max(16, Math.floor(canvas.width / 30));
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(10, canvas.height - (fontSize * 4.5), canvas.width - 20, fontSize * 4);
      
      ctx.fillStyle = '#FFD700';
      const timeStr = new Date().toLocaleString('vi-VN');
      const userStr = Auth.getDisplayName();
      const siteStr = this.currentSite['Site'];
      
      ctx.fillText(`📍 Trạm: ${siteStr} | GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`, 20, canvas.height - (fontSize * 3));
      ctx.fillText(`🕐 ${timeStr}`, 20, canvas.height - (fontSize * 1.8));
      ctx.fillText(`👤 User: ${userStr}`, 20, canvas.height - (fontSize * 0.6));
      
      // Compress
      const base64 = canvas.toDataURL('image/jpeg', 0.7);
      
      this.showLoading('Đang tải ảnh lên và check-in...');
      const result = await DataService.checkinSite({
        site: siteStr,
        lat: lat,
        lng: lng,
        imageBase64: base64,
        username: Auth.getUsername(),
        timestamp: Date.now()
      });
      
      this.hideLoading();
      if (result.success) {
        // Log checkin for partner dashboard tracking
        if (!window._checkinLog) window._checkinLog = [];
        window._checkinLog.push({
          site: siteStr,
          user: Auth.getUsername(),
          partner: this.currentSite['Đối tác'] || '',
          team: this.currentSite['Đội thực hiện'] || '',
          sdt: this.currentSite['SĐT'] || '',
          timestamp: Date.now()
        });
        
        const siteIndex = this.sites.findIndex(s => String(s['Site']).trim().toUpperCase() === String(siteStr).trim().toUpperCase());
        if (siteIndex >= 0) {
          if (result.updatedProgress) {
            if (result.updatedProgress.p4) this.sites[siteIndex]['Tiến độ 4G'] = result.updatedProgress.p4;
            if (result.updatedProgress.p5) this.sites[siteIndex]['Tiến độ 5G'] = result.updatedProgress.p5;
            
            // Recalculate status locally
            const classification = String(this.sites[siteIndex]['Phân loại'] || '').trim();
            let p4g = String(this.sites[siteIndex]['Tiến độ 4G'] || '').trim();
            let p5g = String(this.sites[siteIndex]['Tiến độ 5G'] || '').trim();
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
            this.sites[siteIndex]['Status'] = trangThai;
            
            const nowStr = new Date().toLocaleString('vi-VN');
            this.sites[siteIndex]['Ngày cập nhật'] = nowStr;
            Storage.setSitesData(this.sites);
            
            if (this.currentDetailSite && this.currentDetailSite['Site'] === siteStr) {
              this.currentDetailSite['Tiến độ 4G'] = result.updatedProgress.p4 || this.currentDetailSite['Tiến độ 4G'];
              this.currentDetailSite['Tiến độ 5G'] = result.updatedProgress.p5 || this.currentDetailSite['Tiến độ 5G'];
              this.currentDetailSite['Status'] = trangThai;
              this.currentDetailSite['Ngày cập nhật'] = nowStr;
              this.showSiteDetail(this.currentDetailSite);
            }
          }
          if (result.imageUrl) {
            let linkKey = Object.keys(this.sites[siteIndex]).find(k => {
              let n = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s\-]/g,'');
              return n.includes('linkanhcheckin') || n.includes('anhcheckin') || n === 'linkanh';
            });
            if (!linkKey) linkKey = 'Link Ảnh Check-in';
            this.sites[siteIndex][linkKey] = result.imageUrl;
            
            if (this.currentDetailSite && this.currentDetailSite['Site'] === siteStr) {
              this.currentDetailSite[linkKey] = result.imageUrl;
              this.loadCheckinImage(this.currentDetailSite);
            }
          }
          
          if (result.updatedProgress || result.imageUrl) {
            MapManager.loadSites(this.sites);
            this.updateStats();
            this.renderDashboard();
          }
        }
        this.showToast(result.message, 'success');
      } else {
        this.showToast('Lỗi Check-in: ' + result.error, 'error');
      }
    } catch (e) {
      this.hideLoading();
      if (e.code === 1) this.showToast('Vui lòng cấp quyền vị trí GPS', 'error');
      else this.showToast('Lỗi xử lý ảnh: ' + e.message, 'error');
    }
  },

  async loadComments(siteName) {
    const list = document.getElementById('comments-list');
    if (!list) return;
    list.innerHTML = '<div class="loading-spinner"></div>';
    
    const comments = await DataService.getComments(siteName);
    list.innerHTML = '';
    
    if (comments.length === 0) {
      list.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">Chưa có bình luận nào</div>';
      return;
    }
    
    comments.forEach(c => {
      list.innerHTML += `
        <div class="comment-bubble">
          <div class="comment-header">
            <span class="comment-user">${c.user}</span>
            <span>${c.timestamp}</span>
          </div>
          <div class="comment-msg">${c.message}</div>
        </div>
      `;
    });
    list.scrollTop = list.scrollHeight;
  },

  async submitComment() {
    const input = document.getElementById('comment-input');
    const msg = input.value.trim();
    if (!msg || !this.currentSite) return;
    
    input.value = '';
    this.showToast('Đang gửi bình luận...', 'info');
    
    const result = await DataService.addComment({
      site: this.currentSite['Site'],
      message: msg,
      username: Auth.getUsername(),
      role: Auth.getRole()
    });
    
    if (result.success) {
      this.loadComments(this.currentSite['Site']);
    } else {
      this.showToast('Lỗi gửi bình luận: ' + result.error, 'error');
    }
  },

  // ============================================================
  // Update Progress Handler
  // ============================================================
  async handleUpdateProgress(e) {
    if (e) e.preventDefault();
    if (!['admin', 'manager'].includes(Auth.getRole())) return App.showToast('Tài khoản của bạn không có quyền cập nhật tiến độ', 'error');
    const form = document.getElementById('update-form');
    const siteName = form.dataset.siteName;
    const progress4G = document.getElementById('update-4g').value;
    const progress5G = document.getElementById('update-5g').value;
    const note = document.getElementById('update-note').value.trim();

    const submitBtn = document.getElementById('update-submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-small"></span> Đang cập nhật...';

    try {
      const result = await DataService.updateProgress({
        site: siteName,
        progress4G: progress4G,
        progress5G: progress5G,
        note: note,
        username: Auth.getUsername(),
      });

      if (result.success) {
        // Update local data
        const siteIndex = this.sites.findIndex((s) => s['Site'] === siteName);
        if (siteIndex >= 0) {
          this.sites[siteIndex]['Tiến độ 4G'] = progress4G;
          this.sites[siteIndex]['Tiến độ 5G'] = progress5G;
          if (result.updatedNote !== undefined) {
            this.sites[siteIndex]['Ghi chú (TKTU ONSITE)'] = result.updatedNote;
            if (this.currentDetailSite && this.currentDetailSite['Site'] === siteName) {
              this.currentDetailSite['Ghi chú (TKTU ONSITE)'] = result.updatedNote;
            }
          } else {
            // fallback for offline
            const oldNote = String(this.sites[siteIndex]['Ghi chú (TKTU ONSITE)'] || '').trim();
            if (note.trim() !== '') {
              const tz = 'Asia/Ho_Chi_Minh';
              const now = new Date();
              const nowStr = `[${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth()+1).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}]`;
              const newNoteText = `${nowStr} ${Auth.getUsername()}: ${note.trim()}`;
              const appended = oldNote ? (oldNote + '\n' + newNoteText) : newNoteText;
              this.sites[siteIndex]['Ghi chú (TKTU ONSITE)'] = appended;
            }
          }
          
          document.getElementById('update-note').value = '';
          const historyEl = document.getElementById('update-note-history');
          if (historyEl && this.sites[siteIndex]['Ghi chú (TKTU ONSITE)']) {
            historyEl.textContent = this.sites[siteIndex]['Ghi chú (TKTU ONSITE)'];
            historyEl.style.display = 'block';
            setTimeout(() => historyEl.scrollTop = historyEl.scrollHeight, 10);
          }
          this.sites[siteIndex]['User cập nhật'] = Auth.getUsername();
          const now = new Date();
          this.sites[siteIndex]['Ngày cập nhật'] = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth()+1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

          // Cập nhật luôn trạng thái cột "Trạng thái"
          const classification = String(this.sites[siteIndex]['Phân loại'] || '').trim();
          let p4g = String(this.sites[siteIndex]['Tiến độ 4G'] || '').trim();
          let p5g = String(this.sites[siteIndex]['Tiến độ 5G'] || '').trim();
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
          this.sites[siteIndex]['Status'] = trangThai;

          // Update marker on map
          MapManager.updateMarker(this.sites[siteIndex]);

          // Update stats
          this.updateStats();
        this.renderDashboard();
        }

        const msg = result.offline
          ? '⚡ Đã lưu offline. Sẽ đồng bộ khi có mạng.'
          : '✅ Cập nhật thành công!';
        this.showToast(msg, result.offline ? 'warning' : 'success');
        this.closeSiteModal();
      } else {
        this.showToast('❌ ' + (result.message || 'Cập nhật thất bại'), 'error');
      }
    } catch (error) {
      this.showToast('❌ Lỗi: ' + error.message, 'error');
    }

    submitBtn.disabled = false;
    submitBtn.innerHTML = '💾 Cập nhật tiến độ';
  },

  // ============================================================
  // Stats Dashboard
  // ============================================================
  updateStats() {
    const total = this.sites.length;
    const completed = this.sites.filter((s) => DataService.getSiteStatus(s) === 'completed').length;
    const inProgress = this.sites.filter((s) => DataService.getSiteStatus(s) === 'in_progress').length;
    const notUpdated = total - completed - inProgress;

    const el = document.getElementById('stats-bar');
    if (el) {
      el.innerHTML = `
        <span class="stat-item" title="Tổng"><span class="stat-icon">📡</span>${total}</span>
        <span class="stat-item stat-completed" title="Hoàn thành"><span class="stat-icon">✅</span>${completed}</span>
        <span class="stat-item stat-progress" title="Đang thực hiện"><span class="stat-icon">🔄</span>${inProgress}</span>
        <span class="stat-item stat-pending" title="Chưa cập nhật"><span class="stat-icon">⏳</span>${notUpdated}</span>
      `;
    }

    // Update pending badge
    const pendingCount = Storage.getPendingUpdates().length;
    const badge = document.getElementById('pending-badge');
    if (badge) {
      badge.textContent = pendingCount;
      badge.style.display = pendingCount > 0 ? '' : 'none';
    }
  },

  // ============================================================
  // Refresh Data
  // ============================================================
  async handleRefresh() {
    const btn = document.getElementById('refresh-btn');
    btn.classList.add('spinning');

    try {
      // Sync pending first
      const pending = Storage.getPendingUpdates();
      if (pending.length > 0 && this.isOnline) {
        await DataService.syncPendingUpdates();
      }

      this.sites = await DataService.fetchSites();
      
      if (!['view_limited', 'doitac'].includes(Auth.getRole())) {
        MapManager.loadSites(this.sites);
        this.updateStats();
        // Reload sectors
        DataService.fetchSectors().then(sectors => MapManager.loadSectors(sectors));
      } else {
        DataService.fetchSectors().then(sectors => MapManager.setSectorData(sectors));
      }

      this.showToast('Đã cập nhật dữ liệu', 'success');
    } catch (error) {
      this.showToast('Lỗi: ' + error.message, 'error');
    }

    btn.classList.remove('spinning');
  },

  // ============================================================
  // Toggle Sectors
  // ============================================================
  toggleSectors() {
    const visible = MapManager.toggleSectors();
    const btn = document.getElementById('sector-toggle-btn');
    if (btn) {
      btn.style.opacity = visible ? '1' : '0.4';
    }
  },

  // ============================================================
  // Auto Refresh
  // ============================================================
  startAutoRefresh() {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.refreshInterval = setInterval(async () => {
      if (this.isOnline) {
        try {
          this.sites = await DataService.fetchSites();
          if (!['view_limited', 'doitac'].includes(Auth.getRole())) {
            MapManager.loadSites(this.sites);
            this.updateStats();
            this.renderDashboard();
          }
        } catch (e) {}
      }
    }, AppConfig.DATA_REFRESH_INTERVAL);
  },

  // ============================================================
  // Online/Offline Handlers
  // ============================================================
  handleOnline() {
    this.isOnline = true;
    document.body.classList.remove('offline');
    this.showToast('🌐 Đã kết nối mạng', 'success');

    // Sync pending updates
    setTimeout(async () => {
      const pending = Storage.getPendingUpdates();
      if (pending.length > 0) {
        const result = await DataService.syncPendingUpdates();
        if (result.synced > 0) {
          this.showToast(`Đã đồng bộ ${result.synced} cập nhật offline`, 'success');
          this.sites = await DataService.fetchSites();
          if (!['view_limited', 'doitac'].includes(Auth.getRole())) {
            MapManager.loadSites(this.sites);
            this.updateStats();
            this.renderDashboard();
          }
        }
      }
    }, 2000);
  },

  handleOffline() {
    this.isOnline = false;
    document.body.classList.add('offline');
    this.showToast('📴 Mất kết nối mạng - Chế độ offline', 'warning');
  },

  // ============================================================
  // User Menu
  // ============================================================
  toggleUserMenu() {
    const dropdown = document.getElementById('user-dropdown');
    dropdown.classList.toggle('visible');
  },

  handleLogout() {
    Auth.logout();
    MapManager.destroy();
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.showScreen('login-screen');
    this.showToast('Đã đăng xuất', 'success');

    // Reset login form
    document.getElementById('login-username').value = '';
    document.getElementById('login-password').value = '';
  },

  showSettings() {
    const currentUrl = Storage.getApiUrl();
    alert('API URL hiện tại:\n' + currentUrl + '\n\nĐể thay đổi, sửa file js/config.js → API_URL');
    document.getElementById('user-dropdown').classList.remove('visible');
  },

  // ============================================================
  // UI Utilities
  // ============================================================
  showLoading(message) {
    const overlay = document.getElementById('loading-overlay');
    const text = document.getElementById('loading-text');
    if (text) text.textContent = message || 'Đang xử lý...';
    overlay.classList.add('visible');
  },

  hideLoading() {
    document.getElementById('loading-overlay').classList.remove('visible');
  },

  showOverlay(id) {
    document.getElementById(id).classList.add('visible');
    document.body.classList.add('modal-open');
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('visible'));

    // Auto remove
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  shakeElement(el) {
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 600);
  },

  // ============================================================
  // DASHBOARD
  // ============================================================
  openDashboard() {
    if (['view_limited', 'doitac'].includes(Auth.getRole())) return this.showToast('Tài khoản của bạn không có quyền xem Dashboard', 'error');
    this.renderDashboard();
    document.getElementById('dashboard-overlay').classList.add('visible');
  },

  closeDashboard() {
    document.getElementById('dashboard-overlay').classList.remove('visible');
  },

  renderDashboard() {
    const sites = this.sites;
    const total = sites.length;
    const completed = sites.filter(s => DataService.getSiteStatus(s) === 'completed').length;
    const inProgress = sites.filter(s => DataService.getSiteStatus(s) === 'in_progress').length;
    const notUpdated = total - completed - inProgress;
    const pct = total > 0 ? ((completed / total) * 100).toFixed(2) : '0.00';

    // === Summary Cards ===
    document.getElementById('dash-summary').innerHTML = `
      <div class="dash-card card-total clickable-card" onclick="App.showSiteList('total', 'Tổng trạm')"><div class="dash-card-value">${total}</div><div class="dash-card-label">Tổng trạm</div></div>
      <div class="dash-card card-completed clickable-card" onclick="App.showSiteList('completed', 'Hoàn thành')"><div class="dash-card-value">${completed}</div><div class="dash-card-label">Hoàn thành</div></div>
      <div class="dash-card card-progress clickable-card" onclick="App.showSiteList('in_progress', 'Đang thực hiện')"><div class="dash-card-value">${inProgress}</div><div class="dash-card-label">Đang thực hiện</div></div>
      <div class="dash-card card-pending clickable-card" onclick="App.showSiteList('pending', 'Chưa thực hiện')"><div class="dash-card-value">${notUpdated}</div><div class="dash-card-label">Chưa thực hiện</div></div>
    `;

    // === Progress Bar ===
    document.getElementById('dash-progress-fill').style.width = pct + '%';
    const exportPdfBtn = document.getElementById('dashboard-export-btn');
    if (exportPdfBtn) exportPdfBtn.style.display = Auth.getRole() === 'admin' ? 'inline-block' : 'none';
    document.getElementById('dash-progress-pct').textContent = pct + '%';

    // === Daily Plan Report ===
    this.renderDailyPlan(sites);

    // === Partner Daily Plan Report ===
    this.renderPartnerDailyPlan(sites);

    // === Cumulative Report ===
    this.renderCumulativeReport(sites);

    // === Plan by Huyện ===
    // this.renderPlanByGroup(sites, "Huyện", "dash-plan-huyen");

    // === Plan by Đối tác ===
    this.renderPlanByGroup(sites, "Đối tác", "dash-plan-doitac");

    // === Recent Updates ===
    this.renderRecentUpdates(sites);
    this.renderCharts(sites);
  },

  renderDailyPlan(sites) {
    const today = new Date();
    const todayDay = today.getDate();
    const todayMonth = today.getMonth(); // 0-indexed
    const todayYear = today.getFullYear();
    const todayStr = today.toLocaleDateString('vi-VN');
    document.getElementById('dash-today-date').textContent = todayStr;

    // Helper: check if a date string matches today
    const isToday = (dateVal) => {
      if (!dateVal) return false;
      const str = String(dateVal).trim();
      if (!str) return false;

      // Try dd/MM/yyyy or dd-MM-yyyy or dd.MM.yyyy
      let m1 = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
      if (m1) {
        return parseInt(m1[1]) === todayDay && parseInt(m1[2]) === (todayMonth + 1) && parseInt(m1[3]) === todayYear;
      }

      // Try yyyy-MM-dd or yyyy/MM/dd
      let m2 = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      if (m2) {
        return parseInt(m2[3]) === todayDay && parseInt(m2[2]) === (todayMonth + 1) && parseInt(m2[1]) === todayYear;
      }

      // Try parsing as Date object string (e.g. "Fri Jun 06 2026...")
      try {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
          return d.getDate() === todayDay && d.getMonth() === todayMonth && d.getFullYear() === todayYear;
        }
      } catch (e) {}

      return false;
    };

    // Filter sites with 'Kế hoạch ngày' matching today
    const planSites = sites.filter(s => isToday(s['Kế hoạch ngày']));

    const el = document.getElementById('dash-today-content');
    if (planSites.length === 0) {
      // Show debug info to help diagnose
      const sampleValues = sites
        .filter(s => s['Kế hoạch ngày'] && String(s['Kế hoạch ngày']).trim())
        .slice(0, 3)
        .map(s => `"${s['Kế hoạch ngày']}"`)
        .join(', ');
      el.innerHTML = `<div class="dash-empty">Không có trạm nào trong kế hoạch hôm nay (${todayStr})${sampleValues ? '<br><small style="color:var(--text-muted)">Dữ liệu mẫu: ' + sampleValues + '</small>' : ''}</div>`;
      return;
    }

    const planCompleted = planSites.filter(s => DataService.getSiteStatus(s) === 'completed').length;
    const planInProgress = planSites.filter(s => DataService.getSiteStatus(s) === 'in_progress').length;
    const planNotStarted = planSites.length - planCompleted - planInProgress;
    const plan4gDone = planSites.filter(s => String(s['Tiến độ 4G'] || '').trim() === 'Hoàn thành').length;
    const plan5gDone = planSites.filter(s => String(s['Tiến độ 5G'] || '').trim() === 'Hoàn thành').length;
      const planTotal4g = planSites.filter(s => String(s['Phân loại'] || '').trim() !== '5G Z').length;
      const planTotal5g = planSites.filter(s => String(s['Phân loại'] || '').trim() !== '4G Z').length;

    // Sort logic
    App.dailyPlanSort = App.dailyPlanSort || 'tktu';
    
    planSites.sort((a, b) => {
      if (App.dailyPlanSort === 'status') {
        const getWeight = (s) => {
          const st = DataService.getSiteStatus(s);
          if (st === 'completed') return 2;
          if (st === 'in_progress') return 1;
          return 0; // pending
        };
        const wA = getWeight(a);
        const wB = getWeight(b);
        if (wA !== wB) return wB - wA; // Hoàn thành -> Đang thực hiện -> Chưa thực hiện
      } else if (App.dailyPlanSort === 'partner') {
        const pA = String(a['Đối tác'] || '').trim().toLowerCase();
        const pB = String(b['Đối tác'] || '').trim().toLowerCase();
        if (pA !== pB) return pA.localeCompare(pB, 'vi');
      }
      
      const nameA = String(a['TKTU ONSITE'] || '').trim().toLowerCase();
      const nameB = String(b['TKTU ONSITE'] || '').trim().toLowerCase();
      return nameA.localeCompare(nameB, 'vi');
    });

    const tLen = planSites.length;
    const calcPct = (v) => tLen > 0 ? ((v / tLen) * 100).toFixed(2) : '0.00';
    
    el.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:10px; gap:10px;">
        <div style="font-size:13px;color:var(--text-secondary);line-height:1.6;flex:1;">
          📋 Kế hoạch: <strong style="color:var(--color-blue)" class="clickable-number" onclick="App.showSiteList('daily_plan_all', 'Tất cả (Kế hoạch ngày)')">${tLen}</strong> trạm |
          Hoàn thành: <strong style="color:var(--color-green)" class="clickable-number" onclick="App.showSiteList('daily_plan_completed', 'Hoàn thành (Kế hoạch ngày)')">${planCompleted} (${calcPct(planCompleted)}%)</strong> |
          Đang thực hiện: <strong style="color:var(--color-red)" class="clickable-number" onclick="App.showSiteList('daily_plan_in_progress', 'Đang thực hiện (Kế hoạch ngày)')">${planInProgress} (${calcPct(planInProgress)}%)</strong> |
          Chưa thực hiện: <strong style="color:var(--text-muted)" class="clickable-number" onclick="App.showSiteList('daily_plan_pending', 'Chưa thực hiện (Kế hoạch ngày)')">${planNotStarted} (${calcPct(planNotStarted)}%)</strong><br>
          4G: <strong style="color:var(--color-blue)">${plan4gDone}/${planTotal4g}</strong> |
          5G: <strong style="color:var(--color-purple)">${plan5gDone}/${planTotal5g}</strong>
        </div>
        <div>
          <select class="form-select" style="padding:4px 8px; font-size:12px; width:auto; background:rgba(0,0,0,0.2)" onchange="App.dailyPlanSort = this.value; App.renderDashboard()">
            <option value="tktu" ${App.dailyPlanSort === 'tktu' ? 'selected' : ''}>Sort: TKTU</option>
            <option value="status" ${App.dailyPlanSort === 'status' ? 'selected' : ''}>Sort: Trạng thái</option>
            <option value="partner" ${App.dailyPlanSort === 'partner' ? 'selected' : ''}>Sort: Đối tác</option>
          </select>
        </div>
      </div>
      <div class="table-responsive">
      <table class="dash-table">
        <thead><tr><th>Mã trạm</th><th>Phân loại</th><th class="num">4G</th><th class="num">5G</th><th>Đối tác</th><th>TKTU</th></tr></thead>
        <tbody>
          ${planSites.map(s => {
            const status = DataService.getSiteStatus(s);
            const color = DataService.getStatusColor(status, s);
            const formatProgress = (p, type, cat) => {
              if (cat === '5G Z' && type === '4G') return '';
              if (cat === '4G Z' && type === '5G') return '';
              const str = String(p || '').trim();
              if (str === 'Hoàn thành') return '✅';
              if (str === 'Đang thực hiện') return '🔄';
              return '-';
            };
            return `<tr>
              <td><span class="status-dot" style="background:${color}"></span><a href="#" class="clickable-site" style="color:${color}" onclick="App.openMapPopup('${s['Site']}'); return false;">${s['Site']}</a></td>
              <td>${s['Phân loại'] || '-'}</td>
              <td class="num">${formatProgress(s['Tiến độ 4G'], '4G', s['Phân loại'])}</td>
              <td class="num">${formatProgress(s['Tiến độ 5G'], '5G', s['Phân loại'])}</td>
              <td>${s['Đối tác'] || '-'}</td>
              <td>${s['TKTU ONSITE'] || '-'}</td>
            </tr>`;
          }).join('')}
          <tr style="font-weight:700;border-top:2px solid var(--border-glass);background:rgba(255,255,255,0.02)">
            <td>TỔNG</td>
            <td style="color:var(--color-blue)">${planSites.length} trạm</td>
            <td class="num" style="color:var(--color-green)">${plan4gDone}/${planTotal4g}</td>
            <td class="num" style="color:var(--color-green)">${plan5gDone}/${planTotal5g}</td>
            <td colspan="2" class="pct">${planCompleted}/${planSites.length} hoàn thành</td>
          </tr>
        </tbody>
      </table>
      </div>
    `;
  },

  renderPartnerDailyPlan(sites) {
    const el = document.getElementById('dash-plan-partner');
    if (!el) return;

    const role = Auth.getRole();
    const canSeeDetail = ['admin', 'manager', 'export'].includes(role);

    // Filter today's plan
    const today = new Date();
    const todayDay = today.getDate(), todayMonth = today.getMonth(), todayYear = today.getFullYear();
    const isToday = (val) => {
      const s = String(val || '');
      const m1 = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (m1) {
        const d = parseInt(m1[1]), mo = parseInt(m1[2]) - 1, y = parseInt(m1[3]);
        return d === todayDay && mo === todayMonth && y === todayYear;
      }
      return false;
    };

    const planSites = sites.filter(s => isToday(s['Kế hoạch ngày']));
    if (planSites.length === 0) {
      el.innerHTML = '<div class="dash-empty">Không có dữ liệu kế hoạch ngày hôm nay</div>';
      return;
    }

    // Group by partner
    const partnerMap = {};
    planSites.forEach(s => {
      const partner = String(s['Đối tác'] || 'Chưa phân').trim();
      if (!partnerMap[partner]) {
        partnerMap[partner] = {
          sites: [],
          teams: new Set()
        };
      }
      partnerMap[partner].sites.push(s);
      // Count unique teams by Đội thực hiện + SĐT combination
      const teamKey = (String(s['Đội thực hiện'] || '') + '|' + String(s['SĐT'] || '')).trim();
      if (teamKey !== '|') partnerMap[partner].teams.add(teamKey);
    });

    // Checkin log
    const checkinLog = window._checkinLog || [];

    const unsortedRows = Object.entries(partnerMap).map(([partner, info]) => {
      const partnerSites = info.sites;
      const total = partnerSites.length;
      const done = partnerSites.filter(s => DataService.getSiteStatus(s) === 'completed').length;
      const inProg = partnerSites.filter(s => DataService.getSiteStatus(s) === 'in_progress').length;
      const notDone = total - done - inProg;
      const pct = total > 0 ? (done / total) * 100 : 0;
      const numTeams = info.teams.size || 1;
      
      let checkinCount = 0;
      partnerSites.forEach(s => {
        let hasCheckin = false;
        // Check if any sheet column resembling 'checkin' has value
        for (const k in s) {
          let n = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s\-]/g,'');
          if ((n.includes('linkanhcheckin') || n.includes('anhcheckin') || n === 'linkanh' || n.includes('checkin')) && s[k] && String(s[k]).trim() !== '') {
            hasCheckin = true;
            break;
          }
        }
        // Fallback to local session checkinLog for immediate feedback
        if (!hasCheckin) {
          hasCheckin = checkinLog.some(c => c.site === s['Site']);
        }
        if (hasCheckin) checkinCount++;
      });

      return {
        partner, total, done, inProg, notDone, pct, numTeams, checkinCount
      };
    });

    // Sort by percentage descending
    unsortedRows.sort((a, b) => b.pct - a.pct);

    let sumTotal = 0, sumDone = 0, sumInProg = 0, sumNotDone = 0, sumTeams = 0, sumCheckins = 0;

    const detailOrHide = (count, filterKey, partnerName, label, color) => {
      const colorStyle = color ? ` style="color:var(--${color})"` : '';
      if (!canSeeDetail) return `<td class="num"${colorStyle}>${count}</td>`;
      return `<td class="num clickable-number"${colorStyle} onclick="App.showSiteList('partner_${partnerName}_${filterKey}','${label} (${partnerName})')">${count}</td>`;
    };

    const rows = unsortedRows.map(r => {
      sumTotal += r.total;
      sumDone += r.done;
      sumInProg += r.inProg;
      sumNotDone += r.notDone;
      sumTeams += r.numTeams;
      sumCheckins += r.checkinCount;

      const pctStr = r.pct.toFixed(1);

      return `<tr>
        <td style="font-weight:600">${r.partner}</td>
        <td class="num" style="color:var(--color-blue)">${r.numTeams}</td>
        ${detailOrHide(r.checkinCount, 'checkin', r.partner, 'Đã Check-in', 'color-amber')}
        ${detailOrHide(r.total, 'all', r.partner, 'Kế hoạch ngày', 'color-blue')}
        ${detailOrHide(r.done, 'completed', r.partner, 'Hoàn thành', 'color-green')}
        ${detailOrHide(r.inProg, 'in_progress', r.partner, 'Đang TH', 'color-red')}
        ${detailOrHide(r.notDone, 'pending', r.partner, 'Chưa TH', 'text-muted')}
        <td class="pct">${pctStr}%<div class="mini-bar"><div class="mini-bar-fill" style="width:${pctStr}%"></div></div></td>
      </tr>`;
    });

    const totalPct = sumTotal > 0 ? ((sumDone / sumTotal) * 100).toFixed(1) : '0.0';
    const totalRow = `
      <tr style="font-weight:700;background:rgba(255,255,255,0.03);border-top:2px solid var(--border-glass)">
        <td>TỔNG CỘNG</td>
        <td class="num" style="color:var(--color-blue)">${sumTeams}</td>
        <td class="num ${canSeeDetail ? 'clickable-number' : ''}" style="color:var(--color-amber)" ${canSeeDetail ? `onclick="App.showSiteList('daily_plan_checkin', 'Đã Check-in (Tổng)')"` : ''}>${sumCheckins}</td>
        <td class="num ${canSeeDetail ? 'clickable-number' : ''}" style="color:var(--color-blue)" ${canSeeDetail ? `onclick="App.showSiteList('daily_plan_all', 'Kế hoạch ngày (Tổng)')"` : ''}>${sumTotal}</td>
        <td class="num ${canSeeDetail ? 'clickable-number' : ''}" style="color:var(--color-green)" ${canSeeDetail ? `onclick="App.showSiteList('daily_plan_completed', 'Hoàn thành (Tổng)')"` : ''}>${sumDone}</td>
        <td class="num ${canSeeDetail ? 'clickable-number' : ''}" style="color:var(--color-red)" ${canSeeDetail ? `onclick="App.showSiteList('daily_plan_in_progress', 'Đang thực hiện (Tổng)')"` : ''}>${sumInProg}</td>
        <td class="num ${canSeeDetail ? 'clickable-number' : ''}" style="color:var(--text-muted)" ${canSeeDetail ? `onclick="App.showSiteList('daily_plan_pending', 'Chưa thực hiện (Tổng)')"` : ''}>${sumNotDone}</td>
        <td class="pct" style="color:var(--color-blue)">${totalPct}%</td>
      </tr>
    `;

    el.innerHTML = `
      <div class="table-responsive">
      <table class="dash-table">
        <thead><tr>
          <th>Đối tác</th>
          <th class="num">Số đội</th>
          <th class="num">Check-in</th>
          <th class="num">KH ngày</th>
          <th class="num">Hoàn thành</th>
          <th class="num">Đang TH</th>
          <th class="num">Chưa TH</th>
          <th class="pct">Tỷ lệ</th>
        </tr></thead>
        <tbody>
          ${rows.join('')}
          ${totalRow}
        </tbody>
      </table>
      </div>
    `;
  },

  renderCumulativeReport(sites) {
    const total = sites.length;
    const completed = sites.filter(s => DataService.getSiteStatus(s) === 'completed').length;
    const inProgress = sites.filter(s => DataService.getSiteStatus(s) === 'in_progress').length;
    const notUpdated = total - completed - inProgress;

    // Count 4G and 5G progress across all sites
    const all4gDone = sites.filter(s => String(s['Tiến độ 4G'] || '').trim() === 'Hoàn thành').length;
    const all5gDone = sites.filter(s => String(s['Tiến độ 5G'] || '').trim() === 'Hoàn thành').length;

    // Group by category
    const cat5g4g = sites.filter(s => String(s['Phân loại']).trim() === '5G_4G Z');
    const cat5g = sites.filter(s => String(s['Phân loại']).trim() === '5G Z');
    const cat4g = sites.filter(s => String(s['Phân loại']).trim() === '4G Z');

    const comp5g4g = cat5g4g.filter(s => DataService.getSiteStatus(s) === 'completed').length;
    const comp5g = cat5g.filter(s => DataService.getSiteStatus(s) === 'completed').length;
    const comp4g = cat4g.filter(s => DataService.getSiteStatus(s) === 'completed').length;
    const ip5g4g = cat5g4g.filter(s => DataService.getSiteStatus(s) === 'in_progress').length;
    const ip5g = cat5g.filter(s => DataService.getSiteStatus(s) === 'in_progress').length;
    const ip4g = cat4g.filter(s => DataService.getSiteStatus(s) === 'in_progress').length;

    const c4g_5g4g = cat5g4g.filter(s => String(s['Tiến độ 4G'] || '').trim() === 'Hoàn thành').length;
    const c5g_5g4g = cat5g4g.filter(s => String(s['Tiến độ 5G'] || '').trim() === 'Hoàn thành').length;
    const c4g_5g = cat5g.filter(s => String(s['Tiến độ 4G'] || '').trim() === 'Hoàn thành').length;
    const c5g_5g = cat5g.filter(s => String(s['Tiến độ 5G'] || '').trim() === 'Hoàn thành').length;
    const c4g_4g = cat4g.filter(s => String(s['Tiến độ 4G'] || '').trim() === 'Hoàn thành').length;
    const c5g_4g = cat4g.filter(s => String(s['Tiến độ 5G'] || '').trim() === 'Hoàn thành').length;

    const pct5g4g = cat5g4g.length > 0 ? ((comp5g4g / cat5g4g.length) * 100).toFixed(2) : '0.00';
    const pct5g = cat5g.length > 0 ? ((comp5g / cat5g.length) * 100).toFixed(2) : '0.00';
    const pct4g = cat4g.length > 0 ? ((comp4g / cat4g.length) * 100).toFixed(2) : '0.00';
    const pctTotal = total > 0 ? ((completed / total) * 100).toFixed(2) : '0.00';

    document.getElementById('dash-cumulative-content').innerHTML = `
      <div class="table-responsive">
      <table class="dash-table">
        <thead><tr><th style="width:20%">Loại</th><th class="num" style="width:10%">Tổng</th><th class="num" style="width:10%">4G</th><th class="num" style="width:10%">5G</th><th class="num" style="width:14%">Hoàn thành</th><th class="num" style="width:12%">Đang TH</th><th class="num" style="width:12%">Chưa TH</th><th class="pct" style="width:12%">Tỷ lệ</th></tr></thead>
        <tbody>
          <tr>
            <td><span class="status-dot" style="background:var(--color-blue)"></span>5G_4G Z</td>
            <td class="num" style="color:var(--color-blue)" class="clickable-number" onclick="App.showSiteList('cat_5g4g_all', 'Tất cả (5G_4G Z)')">${cat5g4g.length}</td>
            <td class="num" style="color:var(--color-blue)">${c4g_5g4g}</td>
            <td class="num" style="color:var(--color-purple)">${c5g_5g4g}</td>
            <td class="num" style="color:var(--color-green)" class="clickable-number" onclick="App.showSiteList('cat_5g4g_completed', 'Hoàn thành (5G_4G Z)')">${comp5g4g}</td>
            <td class="num" style="color:var(--color-red)" class="clickable-number" onclick="App.showSiteList('cat_5g4g_in_progress', 'Đang thực hiện (5G_4G Z)')">${ip5g4g}</td>
            <td class="num" style="color:var(--text-muted)" class="clickable-number" onclick="App.showSiteList('cat_5g4g_pending', 'Chưa thực hiện (5G_4G Z)')">${cat5g4g.length - comp5g4g - ip5g4g}</td>
            <td class="pct">${pct5g4g}%<div class="mini-bar"><div class="mini-bar-fill" style="width:${pct5g4g}%"></div></div></td>
          </tr>
          <tr>
            <td><span class="status-dot" style="background:var(--color-purple)"></span>5G Z</td>
            <td class="num" style="color:var(--color-blue)" class="clickable-number" onclick="App.showSiteList('cat_5g_all', 'Tất cả (5G Z)')">${cat5g.length}</td>
            <td class="num" style="color:var(--color-blue)"></td>
            <td class="num" style="color:var(--color-purple)">${c5g_5g}</td>
            <td class="num" style="color:var(--color-green)" class="clickable-number" onclick="App.showSiteList('cat_5g_completed', 'Hoàn thành (5G Z)')">${comp5g}</td>
            <td class="num" style="color:var(--color-red)" class="clickable-number" onclick="App.showSiteList('cat_5g_in_progress', 'Đang thực hiện (5G Z)')">${ip5g}</td>
            <td class="num" style="color:var(--text-muted)" class="clickable-number" onclick="App.showSiteList('cat_5g_pending', 'Chưa thực hiện (5G Z)')">${cat5g.length - comp5g - ip5g}</td>
            <td class="pct">${pct5g}%<div class="mini-bar"><div class="mini-bar-fill" style="width:${pct5g}%"></div></div></td>
          </tr>
          <tr>
            <td><span class="status-dot" style="background:var(--color-amber)"></span>4G Z</td>
            <td class="num" style="color:var(--color-blue)" class="clickable-number" onclick="App.showSiteList('cat_4g_all', 'Tất cả (4G Z)')">${cat4g.length}</td>
            <td class="num" style="color:var(--color-blue)">${c4g_4g}</td>
            <td class="num" style="color:var(--color-purple)"></td>
            <td class="num" style="color:var(--color-green)" class="clickable-number" onclick="App.showSiteList('cat_4g_completed', 'Hoàn thành (4G Z)')">${comp4g}</td>
            <td class="num" style="color:var(--color-red)" class="clickable-number" onclick="App.showSiteList('cat_4g_in_progress', 'Đang thực hiện (4G Z)')">${ip4g}</td>
            <td class="num" style="color:var(--text-muted)" class="clickable-number" onclick="App.showSiteList('cat_4g_pending', 'Chưa thực hiện (4G Z)')">${cat4g.length - comp4g - ip4g}</td>
            <td class="pct">${pct4g}%<div class="mini-bar"><div class="mini-bar-fill" style="width:${pct4g}%"></div></div></td>
          </tr>
          <tr style="font-weight:700;border-top:1px solid var(--border-glass)">
            <td>Tổng</td>
            <td class="num clickable-number" style="color:var(--color-blue)" onclick="App.showSiteList('total', 'Tổng số trạm')">${total}</td>
            <td class="num" style="color:var(--color-blue)">${all4gDone}</td>
            <td class="num" style="color:var(--color-purple)">${all5gDone}</td>
            <td class="num clickable-number" style="color:var(--color-green)" onclick="App.showSiteList('completed', 'Tổng trạm hoàn thành')">${completed}</td>
            <td class="num clickable-number" style="color:var(--color-red)" onclick="App.showSiteList('in_progress', 'Tổng trạm đang thực hiện')">${inProgress}</td>
            <td class="num clickable-number" style="color:var(--text-muted)" onclick="App.showSiteList('pending', 'Tổng trạm chưa thực hiện')">${notUpdated}</td>
            <td class="pct">${pctTotal}%<div class="mini-bar"><div class="mini-bar-fill" style="width:${pctTotal}%"></div></div></td>
          </tr>
        </tbody>
      </table>
      </div>
    `;
  },

  renderPlanByGroup(sites, groupKey, elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const groups = {};
    sites.forEach(s => {
      const key = String(s[groupKey] || 'Khác').trim();
      if (!groups[key]) groups[key] = { total: 0, completed: 0, inProgress: 0, c4g: 0, c5g: 0 };
      groups[key].total++;
      const status = DataService.getSiteStatus(s);
      if (status === 'completed') groups[key].completed++;
      else if (status === 'in_progress') groups[key].inProgress++;

      if (String(s['Tiến độ 4G'] || '').trim() === 'Hoàn thành') groups[key].c4g++;
      if (String(s['Tiến độ 5G'] || '').trim() === 'Hoàn thành') groups[key].c5g++;
    });

    const sorted = Object.entries(groups).sort((a, b) => {
      const pctA = a[1].total > 0 ? a[1].completed / a[1].total : 0;
      const pctB = b[1].total > 0 ? b[1].completed / b[1].total : 0;
      if (pctB !== pctA) return pctB - pctA;
      return b[1].total - a[1].total;
    });

    el.innerHTML = `
      <div class="table-responsive">
      <table class="dash-table">
        <thead><tr><th style="width:20%">${groupKey}</th><th class="num" style="width:10%">Tổng</th><th class="num" style="width:10%">4G</th><th class="num" style="width:10%">5G</th><th class="num" style="width:14%">Hoàn thành</th><th class="num" style="width:12%">Đang TH</th><th class="num" style="width:12%">Chưa TH</th><th class="pct" style="width:12%">Tỷ lệ</th></tr></thead>
        <tbody>
          ${sorted.map(([name, data]) => {
            const pct = data.total > 0 ? ((data.completed / data.total) * 100).toFixed(2) : '0.00';
            const remaining = data.total - data.completed - data.inProgress;
            return `<tr>
              <td>${name}</td>
              <td class="num" style="color:var(--color-blue)" class="clickable-number" onclick="App.showSiteList('group_${groupKey}_${name}_all', 'Tất cả (${name})')">${data.total}</td>
              <td class="num" style="color:var(--color-blue)">${data.c4g > 0 ? data.c4g : ''}</td>
              <td class="num" style="color:var(--color-purple)">${data.c5g > 0 ? data.c5g : ''}</td>
              <td class="num" style="color:var(--color-green)" class="clickable-number" onclick="App.showSiteList('group_${groupKey}_${name}_completed', 'Hoàn thành (${name})')">${data.completed}</td>
              <td class="num" style="color:var(--color-red)" class="clickable-number" onclick="App.showSiteList('group_${groupKey}_${name}_in_progress', 'Đang thực hiện (${name})')">${data.inProgress}</td>
              <td class="num" style="color:var(--text-muted)" class="clickable-number" onclick="App.showSiteList('group_${groupKey}_${name}_pending', 'Chưa thực hiện (${name})')">${remaining}</td>
              <td class="pct">${pct}%<div class="mini-bar"><div class="mini-bar-fill" style="width:${pct}%"></div></div></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      </div>
    `;
  },

  renderRecentUpdates(sites) {
    // Get sites with update dates, sort by most recent
    const parseDate = (str) => {
      const s = String(str || '');
      // Parse dd/MM/yyyy HH:mm:ss format
      const parts = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?/);
      if (parts) {
        const d = parseInt(parts[1]) || 1;
        const m = (parseInt(parts[2]) || 1) - 1;
        const y = parseInt(parts[3]) || 2024;
        const h = parseInt(parts[4]) || 0;
        const min = parseInt(parts[5]) || 0;
        const sec = parseInt(parts[6]) || 0;
        return new Date(y, m, d, h, min, sec);
      }
      return new Date(0);
    };

    const updated = sites
      .filter(s => s['Ngày cập nhật'] && String(s['Ngày cập nhật']).trim())
      .sort((a, b) => parseDate(b['Ngày cập nhật']) - parseDate(a['Ngày cập nhật']))
      .slice(0, 10);

    const el = document.getElementById('dash-recent-updates');
    if (updated.length === 0) {
      el.innerHTML = '<div class="dash-empty">Chưa có cập nhật nào</div>';
      return;
    }

    // Format display: show dd/MM/yyyy HH:mm
    const formatTime = (str) => {
      const s = String(str || '');
      const parts = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s*(\d{1,2}):(\d{1,2})/);
      if (parts) {
        return `${parts[1]}/${parts[2]}/${parts[3]} ${parts[4]}:${parts[5]}`;
      }
      return s;
    };

    const formatProgress = (p, type, cat) => {
      if (cat === '5G Z' && type === '4G') return '';
      if (cat === '4G Z' && type === '5G') return '';
      const str = String(p || '').trim();
      if (str === 'Hoàn thành') return '✅';
      if (str === 'Đang thực hiện') return '🔄';
      return '-';
    };

    el.innerHTML = `
      <div class="table-responsive">
      <table class="dash-table">
        <thead><tr><th>Trạm</th><th class="num">4G</th><th class="num">5G</th><th>User</th><th>Thời gian</th></tr></thead>
        <tbody>
          ${updated.map(s => {
            const status = DataService.getSiteStatus(s);
            const color = DataService.getStatusColor(status, s);
            return `<tr>
              <td><span class="status-dot" style="background:${color}"></span><a href="#" class="clickable-site" style="color:${color}" onclick="App.openMapPopup('${s['Site']}'); return false;">${s['Site']}</a></td>
              <td class="num">${formatProgress(s['Tiến độ 4G'], '4G', s['Phân loại'])}</td>
              <td class="num">${formatProgress(s['Tiến độ 5G'], '5G', s['Phân loại'])}</td>
              <td>${s['User cập nhật'] || '-'}</td>
              <td style="font-size:11px;color:var(--text-muted)">${formatTime(s['Ngày cập nhật'])}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      </div>
    `;
  },

  // ============================================================
  // Charts Rendering
  // ============================================================
  renderCharts(sites) {
    if (!window.Chart) return;

    const ctxHuyen = document.getElementById('chart-huyen');
    if (ctxHuyen) {
      const groups = {};
      sites.forEach(s => {
        const key = String(s['Huyện'] || 'Khác').trim();
        if (!groups[key]) groups[key] = { total: 0, comp: 0, ip: 0, p: 0 };
        groups[key].total++;
        const status = DataService.getSiteStatus(s);
        if (status === 'completed') groups[key].comp++;
        else if (status === 'in_progress') groups[key].ip++;
        else groups[key].p++;
      });
      const huyenKeys = Object.keys(groups).sort((a,b) => groups[b].total - groups[a].total);
      
      window._huyenData = groups;
      
      const customHuyenPlugin = {
        id: 'customHuyenLabels',
        afterDatasetsDraw(chart, args, options) {
          const { ctx } = chart;
          ctx.save();
          ctx.font = '11px Arial';
          ctx.fillStyle = document.documentElement.getAttribute('data-pdf-export') ? '#000000' : '#cbd5e1';
          ctx.textBaseline = 'middle';
          
          const metaIp = chart.getDatasetMeta(0);
          const metaComp = chart.getDatasetMeta(1);
          const metaPend = chart.getDatasetMeta(2);
          
                    chart.data.labels.forEach((label, index) => {
            const data = groups[label];
            if (!data || data.total === 0) return;
            
            const metaIp = chart.getDatasetMeta(0);
            const metaComp = chart.getDatasetMeta(1);
            const metaPend = chart.getDatasetMeta(2);
            
            const widthRed = metaIp.data[index] ? metaIp.data[index].x - metaIp.data[index].base : 0;
            const widthGreen = metaComp.data[index] ? metaComp.data[index].x - metaComp.data[index].base : 0;
            
            const hasRed = data.ip > 0;
            const hasGreen = data.comp > 0;
            const yPos = metaIp.data[index] ? metaIp.data[index].y : (metaComp.data[index] ? metaComp.data[index].y : 0);
            
            let drawRed = false;
            let redX = 0;
            let redAlign = 'right';
            const redPct = (data.ip / data.total * 100).toFixed(2) + '%';
            
            if (hasRed) {
              if (hasGreen) {
                redX = metaComp.data[index].base + 5;
                redAlign = 'left';
                if (widthGreen > 75) drawRed = true;
              } else {
                if (widthRed > 30) {
                  redX = metaIp.data[index].x - 5;
                  redAlign = 'right';
                  drawRed = true;
                }
              }
            }
            
            let drawGreen = false;
            let greenX = 0;
            let greenAlign = 'right';
            const greenPct = (data.comp / data.total * 100).toFixed(2) + '%';
            
            if (hasGreen && widthGreen > 30) {
              greenX = metaComp.data[index].x - 5;
              greenAlign = 'right';
              drawGreen = true;
            }
            
            if (drawRed) {
              ctx.textAlign = redAlign;
              ctx.fillText(redPct, redX, yPos);
            }
            if (drawGreen) {
              ctx.textAlign = greenAlign;
              ctx.fillText(greenPct, greenX, yPos);
            }
            
            let maxX = Math.max(
              metaIp.data[index] ? metaIp.data[index].x : 0,
              metaComp.data[index] ? metaComp.data[index].x : 0,
              metaPend.data[index] ? metaPend.data[index].x : 0
            );
            if (maxX > 0) {
              const isMobile = window.innerWidth < 768;
              const suffix = isMobile ? '' : ' trạm';
              ctx.textAlign = 'left';
              ctx.fillText(` ${data.total}${suffix}`, maxX + 5, yPos);
            }
          });
          ctx.restore();
        }
      };

      if (window.chartHuyenInstance) window.chartHuyenInstance.destroy();
      window.chartHuyenInstance = new Chart(ctxHuyen, {
        type: 'bar',
        data: {
          labels: huyenKeys,
          datasets: [
            { label: 'Đang thực hiện', data: huyenKeys.map(k=>groups[k].ip), backgroundColor: '#ef4444', maxBarThickness: 24, maxBarThickness: 24 },
            { label: 'Hoàn thành', data: huyenKeys.map(k=>groups[k].comp), backgroundColor: '#10b981', maxBarThickness: 24, maxBarThickness: 24 },
            { label: 'Chưa thực hiện', data: huyenKeys.map(k=>groups[k].p), backgroundColor: '#475569', maxBarThickness: 24, maxBarThickness: 24 }
          ]
        },
        plugins: [customHuyenPlugin],
        options: {
          indexAxis: 'y',
          responsive: true, maintainAspectRatio: false,
          layout: { padding: { right: window.innerWidth < 768 ? 25 : 100 } },
          scales: { 
            x: { stacked: true, ticks:{color:'#cbd5e1'}, display: false }, 
            y: { stacked: true, ticks:{color:'#cbd5e1'} } 
          },
          plugins: { 
            legend: { position: 'bottom', labels:{color:'#cbd5e1', boxWidth: window.innerWidth < 768 ? 6 : 10, usePointStyle: true, padding: window.innerWidth < 768 ? 5 : 15, font: { size: window.innerWidth < 768 ? 9 : 12 }} },
            title: { display: true, text: 'Tiến độ theo Huyện', color: '#f8fafc' },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const pName = context.label;
                  const data = window._huyenData ? window._huyenData[pName] : null;
                  if (data) {
                    const pct = data.total > 0 ? ((data.comp / data.total) * 100).toFixed(2) : 0;
                    return [
                      context.dataset.label + ': ' + context.parsed.x,
                      `Tiến độ: ${pct}%`,
                      `Hoàn thành: ${data.comp} / ${data.total} trạm`
                    ];
                  }
                  return context.dataset.label + ': ' + context.parsed.x;
                }
              }
            }
          }
        }
      });
    }

    
    // 1. Overall Completion Pie Chart
    const total = sites.length;
    let completed = 0;
    let inProgress = 0;
    let pending = 0;
    
    sites.forEach(s => {
      const status = DataService.getSiteStatus(s);
      if (status === 'completed') completed++;
      else if (status === 'in_progress') inProgress++;
      else pending++;
    });

    const pctComp = total > 0 ? ((completed/total)*100).toFixed(2) : "0.00";
    const pctIp = total > 0 ? ((inProgress/total)*100).toFixed(2) : "0.00";
    const pctPend = total > 0 ? ((pending/total)*100).toFixed(2) : "0.00";

    const ctxOverall = document.getElementById('chart-overall');
    if (ctxOverall) {
      if (window.chartOverallInstance) window.chartOverallInstance.destroy();
      window.chartOverallInstance = new Chart(ctxOverall, {
        type: 'doughnut',
        data: {
          labels: [`Hoàn thành (${pctComp}%)`, `Đang thực hiện (${pctIp}%)`, `Chưa thực hiện (${pctPend}%)`],
          datasets: [{
            data: [completed, inProgress, pending],
            backgroundColor: ['#10b981', '#ef4444', '#475569'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#cbd5e1', boxWidth: window.innerWidth < 768 ? 6 : 10, usePointStyle: true, padding: window.innerWidth < 768 ? 5 : 15, font: { size: window.innerWidth < 768 ? 9 : 12 } } },
            title: { display: true, text: 'Tổng quan tiến độ', color: '#f8fafc' }
          }
        }
      });
    }

    // 2. Categories Bar Chart (Horizontal)
    const categories = {};
    sites.forEach(s => {
      const c = String(s['Phân loại'] || 'Khác').trim();
      if (!categories[c]) categories[c] = { total: 0, comp: 0, ip: 0, p: 0 };
      categories[c].total++;
      const status = DataService.getSiteStatus(s);
      if (status === 'completed') categories[c].comp++;
      else if (status === 'in_progress') categories[c].ip++;
      else categories[c].p++;
    });

    const cLabels = Object.keys(categories).sort((a,b) => categories[b].total - categories[a].total);
    const cComp = cLabels.map(k => categories[k].comp);
    const cIp = cLabels.map(k => categories[k].ip);
    const cPend = cLabels.map(k => categories[k].p);

    window._catData = categories;

    const customCatPlugin = {
      id: 'customCatLabels',
      afterDatasetsDraw(chart, args, options) {
        const { ctx } = chart;
        ctx.save();
        ctx.font = '11px Arial';
        ctx.fillStyle = document.documentElement.getAttribute('data-pdf-export') ? '#000000' : '#cbd5e1';
        ctx.textBaseline = 'middle';
        
        const metaIp = chart.getDatasetMeta(0);
        const metaComp = chart.getDatasetMeta(1);
        const metaPend = chart.getDatasetMeta(2);
        
        chart.data.labels.forEach((label, index) => {
          const data = categories[label];
          if (!data || data.total === 0) return;
          
          const widthRed = metaIp.data[index] ? metaIp.data[index].x - metaIp.data[index].base : 0;
          const widthGreen = metaComp.data[index] ? metaComp.data[index].x - metaComp.data[index].base : 0;
          
          const hasRed = data.ip > 0;
          const hasGreen = data.comp > 0;
          const yPos = metaIp.data[index] ? metaIp.data[index].y : (metaComp.data[index] ? metaComp.data[index].y : 0);
          
          let drawRed = false;
          let redX = 0;
          let redAlign = 'right';
          const redPct = (data.ip / data.total * 100).toFixed(2) + '%';
          
          if (hasRed) {
            if (hasGreen) {
              redX = metaComp.data[index].base + 5;
              redAlign = 'left';
              if (widthGreen > 75) drawRed = true;
            } else {
              if (widthRed > 30) {
                redX = metaIp.data[index].x - 5;
                redAlign = 'right';
                drawRed = true;
              }
            }
          }
          
          let drawGreen = false;
          let greenX = 0;
          let greenAlign = 'right';
          const greenPct = (data.comp / data.total * 100).toFixed(2) + '%';
          
          if (hasGreen && widthGreen > 30) {
            greenX = metaComp.data[index].x - 5;
            greenAlign = 'right';
            drawGreen = true;
          }
          
          if (drawRed) {
            ctx.textAlign = redAlign;
            ctx.fillText(redPct, redX, yPos);
          }
          if (drawGreen) {
            ctx.textAlign = greenAlign;
            ctx.fillText(greenPct, greenX, yPos);
          }
          
          let maxX = Math.max(
            metaIp.data[index] ? metaIp.data[index].x : 0,
            metaComp.data[index] ? metaComp.data[index].x : 0,
            metaPend.data[index] ? metaPend.data[index].x : 0
          );
          if (maxX > 0) {
            ctx.textAlign = 'left';
            ctx.fillText(` ${data.total} trạm`, maxX + 5, yPos);
          }
        });
        ctx.restore();
      }
    };

    const ctxCat = document.getElementById('chart-categories');
    if (ctxCat) {
      if (window.chartCatInstance) window.chartCatInstance.destroy();
      window.chartCatInstance = new Chart(ctxCat, {
        type: 'bar',
        data: {
          labels: cLabels,
          datasets: [
            { label: 'Đang thực hiện', data: cIp, backgroundColor: '#ef4444', maxBarThickness: 24 },
            { label: 'Hoàn thành', data: cComp, backgroundColor: '#10b981', maxBarThickness: 24 },
            { label: 'Chưa thực hiện', data: cPend, backgroundColor: '#475569', maxBarThickness: 24 }
          ]
        },
        plugins: [customCatPlugin],
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { right: window.innerWidth < 768 ? 25 : 100 } },
          scales: {
            x: { stacked: true, ticks: { color: '#cbd5e1' }, display: false },
            y: { stacked: true, ticks: { color: '#cbd5e1' } }
          },
          plugins: {
            legend: { position: 'bottom', labels: { color: '#cbd5e1', boxWidth: window.innerWidth < 768 ? 6 : 10, usePointStyle: true, padding: window.innerWidth < 768 ? 5 : 15, font: { size: window.innerWidth < 768 ? 9 : 12 } } },
            title: { display: true, text: 'Tiến độ theo Phân loại', color: '#f8fafc' },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const pName = context.label;
                  const data = window._catData ? window._catData[pName] : null;
                  if (data) {
                    const pct = data.total > 0 ? ((data.comp / data.total) * 100).toFixed(2) : 0;
                    return [
                      context.dataset.label + ': ' + context.parsed.x,
                      `Hoàn thành: ${pct}%`,
                      `Tiến độ: ${data.comp} / ${data.total} trạm`
                    ];
                  }
                  return context.dataset.label + ': ' + context.parsed.x;
                }
              }
            }
          }
        }
      });
    }
    
    // 3. Partners % Completion Chart (Horizontal)
    const partners = {};
    sites.forEach(s => {
      const p = String(s['Đối tác'] || 'Khác').trim();
      if (!partners[p]) partners[p] = { total: 0, comp: 0, ip: 0, p: 0 };
      partners[p].total++;
      const status = DataService.getSiteStatus(s);
      if (status === 'completed') partners[p].comp++;
      else if (status === 'in_progress') partners[p].ip++;
      else partners[p].p++;
    });

    const pKeys = Object.keys(partners).sort((a,b) => partners[b].total - partners[a].total);
    const pLabels = pKeys;
    const pComp = pKeys.map(k => partners[k].comp);
    const pIp = pKeys.map(k => partners[k].ip);
    const pPend = pKeys.map(k => partners[k].p);
    
    window._partnersData = partners;

    const customPartPlugin = {
      id: 'customPartLabels',
      afterDatasetsDraw(chart, args, options) {
        const { ctx } = chart;
        ctx.save();
        ctx.font = '11px Arial';
        ctx.fillStyle = document.documentElement.getAttribute('data-pdf-export') ? '#000000' : '#cbd5e1';
        ctx.textBaseline = 'middle';
        
        const metaIp = chart.getDatasetMeta(0);
        const metaComp = chart.getDatasetMeta(1);
        const metaPend = chart.getDatasetMeta(2);
        
        chart.data.labels.forEach((label, index) => {
          const data = window._partnersData ? window._partnersData[label] : null;
          if (!data || data.total === 0) return;
          
          const widthRed = metaIp.data[index] ? metaIp.data[index].x - metaIp.data[index].base : 0;
          const widthGreen = metaComp.data[index] ? metaComp.data[index].x - metaComp.data[index].base : 0;
          
          const hasRed = data.ip > 0;
          const hasGreen = data.comp > 0;
          const yPos = metaIp.data[index] ? metaIp.data[index].y : (metaComp.data[index] ? metaComp.data[index].y : 0);
          
          let drawRed = false;
          let redX = 0;
          let redAlign = 'right';
          const redPct = (data.ip / data.total * 100).toFixed(2) + '%';
          
          if (hasRed) {
            if (hasGreen) {
              redX = metaComp.data[index].base + 5;
              redAlign = 'left';
              if (widthGreen > 75) drawRed = true;
            } else {
              if (widthRed > 30) {
                redX = metaIp.data[index].x - 5;
                redAlign = 'right';
                drawRed = true;
              }
            }
          }
          
          let drawGreen = false;
          let greenX = 0;
          let greenAlign = 'right';
          const greenPct = (data.comp / data.total * 100).toFixed(2) + '%';
          
          if (hasGreen && widthGreen > 30) {
            greenX = metaComp.data[index].x - 5;
            greenAlign = 'right';
            drawGreen = true;
          }
          
          if (drawRed) {
            ctx.textAlign = redAlign;
            ctx.fillText(redPct, redX, yPos);
          }
          if (drawGreen) {
            ctx.textAlign = greenAlign;
            ctx.fillText(greenPct, greenX, yPos);
          }
          
          let maxX = Math.max(
            metaIp.data[index] ? metaIp.data[index].x : 0,
            metaComp.data[index] ? metaComp.data[index].x : 0,
            metaPend.data[index] ? metaPend.data[index].x : 0
          );
          if (maxX > 0) {
            const isMobile = window.innerWidth < 768;
            const suffix = isMobile ? '' : ' trạm';
            ctx.textAlign = 'left';
            ctx.fillText(` ${data.total}${suffix}`, maxX + 5, yPos);
          }
        });
        ctx.restore();
      }
    };

    const ctxPart = document.getElementById('chart-partners');
    if (ctxPart) {
      if (window.chartPartInstance) window.chartPartInstance.destroy();
      window.chartPartInstance = new Chart(ctxPart, {
        type: 'bar',
        data: {
          labels: pLabels,
          datasets: [
            { label: 'Đang thực hiện', data: pIp, backgroundColor: '#ef4444', maxBarThickness: 24 },
            { label: 'Hoàn thành', data: pComp, backgroundColor: '#10b981', maxBarThickness: 24 },
            { label: 'Chưa thực hiện', data: pPend, backgroundColor: '#475569', maxBarThickness: 24 }
          ]
        },
        plugins: [customPartPlugin],
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { right: window.innerWidth < 768 ? 25 : 100 } },
          scales: {
            x: { stacked: true, ticks: { color: '#cbd5e1' }, display: false },
            y: { stacked: true, ticks: { color: '#cbd5e1' } }
          },
          plugins: {
            legend: { position: 'bottom', labels: { color: '#cbd5e1', boxWidth: window.innerWidth < 768 ? 6 : 10, usePointStyle: true, padding: window.innerWidth < 768 ? 5 : 15, font: { size: window.innerWidth < 768 ? 9 : 12 } } },
            title: { display: true, text: 'Tiến độ theo Đối tác', color: '#f8fafc' },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const pName = context.label;
                  const data = window._partnersData ? window._partnersData[pName] : null;
                  if (data) {
                    const pct = data.total > 0 ? ((data.comp / data.total) * 100).toFixed(2) : 0;
                    return [
                      context.dataset.label + ': ' + context.parsed.x,
                      `Hoàn thành: ${pct}%`,
                      `Tiến độ: ${data.comp} / ${data.total} trạm`
                    ];
                  }
                  return context.dataset.label + ': ' + context.parsed.x;
                }
              }
            }
          }
        }
      });
    }
    
    // Add mobile custom views
    if (window.innerWidth < 768) {
      if (window._catData) this.renderMobileChartView(window._catData, 'mobile-chart-categories', 'Tiến độ chi tiết theo Phân loại');
    }
  },

  renderMobileChartView(dataObj, containerId, title) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const keys = Object.keys(dataObj).sort((a,b) => dataObj[b].total - dataObj[a].total);
    
    let html = `
      <div class="section-title" style="font-size:14px;font-weight:600;margin-bottom:12px;border-left:3px solid var(--color-blue);padding-left:8px;color:#fff;">
        ${title}
      </div>
      <div class="chart-legend">
        <div class="chart-legend-item"><div class="chart-legend-dot" style="background:var(--color-red)"></div> Đang làm (Đỏ)</div>
        <div class="chart-legend-item"><div class="chart-legend-dot" style="background:var(--color-green)"></div> Đã xong (Xanh)</div>
        <div class="chart-legend-item"><div class="chart-legend-dot" style="background:var(--color-pending)"></div> Chưa làm</div>
      </div>
      <div class="partner-list">
    `;
    
    keys.forEach((key, index) => {
      const data = dataObj[key];
      const pct = data.total > 0 ? (data.comp / data.total * 100).toFixed(2) : 0;
      const pctIp = data.total > 0 ? (data.ip / data.total * 100).toFixed(2) : 0;
      
      html += `
        <div class="partner-item">
          <div class="partner-info">
            <span class="partner-name">${index + 1}. ${key} (Tỷ lệ: ${pct}%)</span>
            <span class="partner-stats">Tổng: <b>${data.total}</b> trạm</span>
          </div>
          <div class="stacked-bar">
            <div class="segment seg-prog" style="width: ${pctIp}%;" title="Đang làm">${data.ip > 0 ? Math.round(pctIp) + '%' : ''}</div>
            <div class="segment seg-comp" style="width: ${pct}%;" title="Hoàn thành">${data.comp > 0 ? Math.round(pct) + '%' : ''}</div>
          </div>
        </div>
      `;
    });
    html += '</div>';
    
    container.innerHTML = html;
  },

  // ============================================================
  // Site List & Details Modals
  // ============================================================
  showSiteList(filterId, title) {
    this.currentListFilter = filterId;
    this.currentListTitle = title;
    
    let filtered = [];
    if (filterId === 'total') filtered = this.sites;
    else if (filterId === 'total_4g') filtered = this.sites.filter(s => DataService.getSiteStatus(s) === 'completed' && s['Tiến độ 4G'] == 100);
    else if (filterId === 'total_5g') filtered = this.sites.filter(s => DataService.getSiteStatus(s) === 'completed' && s['Tiến độ 5G'] == 100);
    else if (filterId === 'completed') filtered = this.sites.filter(s => DataService.getSiteStatus(s) === 'completed');
    else if (filterId === 'in_progress') filtered = this.sites.filter(s => DataService.getSiteStatus(s) === 'in_progress');
    else if (filterId === 'pending') filtered = this.sites.filter(s => { const st = DataService.getSiteStatus(s); return st !== 'completed' && st !== 'in_progress'; });
    else if (filterId.startsWith('daily_plan_')) {
      const planSites = this.sites.filter(s => DataService.isDailyPlan(s));
      if (filterId === 'daily_plan_all') filtered = planSites;
      if (filterId === 'daily_plan_completed') filtered = planSites.filter(s => DataService.getSiteStatus(s) === 'completed');
      if (filterId === 'daily_plan_in_progress') filtered = planSites.filter(s => DataService.getSiteStatus(s) === 'in_progress');
      if (filterId === 'daily_plan_pending') filtered = planSites.filter(s => { const st = DataService.getSiteStatus(s); return st !== 'completed' && st !== 'in_progress'; });
      if (filterId === 'daily_plan_checkin') {
        const checkinLog = window._checkinLog || [];
        filtered = planSites.filter(s => {
          for (const k in s) {
            let n = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s\-]/g,'');
            if ((n.includes('linkanhcheckin') || n.includes('anhcheckin') || n === 'linkanh' || n.includes('checkin')) && s[k] && String(s[k]).trim() !== '') return true;
          }
          return checkinLog.some(c => c.site === s['Site']);
        });
      }
    } else if (filterId.startsWith('cat_')) {
      const parts = filterId.split('_');
      let cat = 'Khác';
      if (parts[1] === '5g4g') cat = '5G_4G Z';
      if (parts[1] === '5g') cat = '5G Z';
      if (parts[1] === '4g') cat = '4G Z';
      
      const catSites = this.sites.filter(s => String(s['Phân loại']).trim() === cat);
      if (parts[2] === 'all') filtered = catSites;
      if (parts[2] === 'completed') filtered = catSites.filter(s => DataService.getSiteStatus(s) === 'completed');
      if (parts[2] === 'in') filtered = catSites.filter(s => DataService.getSiteStatus(s) === 'in_progress');
      if (parts[2] === 'pending') filtered = catSites.filter(s => { const st = DataService.getSiteStatus(s); return st !== 'completed' && st !== 'in_progress'; });
    } else if (filterId.startsWith('group_')) {
      const regex = /^group_([^_]+)_(.+)_(all|completed|in_progress|pending)$/;
      const m = filterId.match(regex);
      if (m) {
        const groupKey = m[1];
        const groupName = m[2];
        const status = m[3];
        const groupSites = this.sites.filter(s => String(s[groupKey] || 'Khác').trim() === groupName);
        if (status === 'all') filtered = groupSites;
        if (status === 'completed') filtered = groupSites.filter(s => DataService.getSiteStatus(s) === 'completed');
        if (status === 'in_progress') filtered = groupSites.filter(s => DataService.getSiteStatus(s) === 'in_progress');
        if (status === 'pending') filtered = groupSites.filter(s => { const st = DataService.getSiteStatus(s); return st !== 'completed' && st !== 'in_progress'; });
      }
    } else if (filterId.startsWith('partner_')) {
      // partner_{partnerName}_{status}
      const prefixLen = 'partner_'.length;
      const rest = filterId.slice(prefixLen); // e.g. "Viettel_completed"
      const lastUs = rest.lastIndexOf('_');
      const partnerName = rest.slice(0, lastUs);
      const status = rest.slice(lastUs + 1);
      // Only plan sites for today
      const today = new Date();
      const isToday = (val) => {
        const s = String(val || '');
        const m1 = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (m1) { const d=parseInt(m1[1]), mo=parseInt(m1[2])-1, y=parseInt(m1[3]); return d===today.getDate()&&mo===today.getMonth()&&y===today.getFullYear(); }
        return false;
      };
      const partnerSites = this.sites.filter(s => String(s['Đối tác'] || '').trim() === partnerName && isToday(s['Kế hoạch ngày']));
      if (status === 'all') filtered = partnerSites;
      else if (status === 'completed') filtered = partnerSites.filter(s => DataService.getSiteStatus(s) === 'completed');
      else if (status === 'in_progress') filtered = partnerSites.filter(s => DataService.getSiteStatus(s) === 'in_progress');
      else if (status === 'pending') filtered = partnerSites.filter(s => { const st = DataService.getSiteStatus(s); return st !== 'completed' && st !== 'in_progress'; });
      else if (status === 'checkin') {
        const checkinLog = window._checkinLog || [];
        filtered = partnerSites.filter(s => {
          for (const k in s) {
            let n = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s\-]/g,'');
            if ((n.includes('linkanhcheckin') || n.includes('anhcheckin') || n === 'linkanh' || n.includes('checkin')) && s[k] && String(s[k]).trim() !== '') return true;
          }
          return checkinLog.some(c => c.site === s['Site']);
        });
      }
      else filtered = partnerSites;
    }

    this.currentListData = filtered;

    document.getElementById('list-modal-title').textContent = title + " (" + filtered.length + " trạm)";
    const tbody = document.querySelector('#list-modal-table tbody');
    const thead = document.querySelector('#list-modal-table thead');
    
    
    const isCheckinMode = filterId && filterId.includes('checkin');
    if (isCheckinMode) {
      thead.innerHTML = '<tr><th>Mã trạm</th><th>Phân loại</th><th>4G</th><th>5G</th><th>Đối tác</th><th>Checkin</th></tr>';
    } else {
      thead.innerHTML = '<tr><th>Mã trạm</th><th>Phân loại</th><th>4G</th><th>5G</th><th>Đối tác</th><th>TKTU</th></tr>';
    }

    
    const formatProgress = (p, type, cat) => {
      if (cat === '5G Z' && type === '4G') return '';
      if (cat === '4G Z' && type === '5G') return '';
      const str = String(p || '').trim();
      if (str === 'Hoàn thành') return '✅';
      if (str === 'Đang thực hiện') return '🔄';
      return '—';
    };

    tbody.innerHTML = filtered.map(s => {
      const status = DataService.getSiteStatus(s);
      const color = DataService.getStatusColor(status, s);
      return `<tr>
        <td><span class="status-dot" style="background:${color}"></span><a href="#" class="clickable-site" style="color:${color}" onclick="App.openMapPopup('${s['Site']}'); return false;">${s['Site']}</a></td>
        <td>${s['Phân loại'] || '-'}</td>
        <td class="num">${formatProgress(s['Tiến độ 4G'], '4G', s['Phân loại'])}</td>
        <td class="num">${formatProgress(s['Tiến độ 5G'], '5G', s['Phân loại'])}</td>
        <td>${s['Đối tác'] || '-'}</td>
                <td>${(() => {
          if (isCheckinMode) {
            for (const k in s) {
              if (k.replace(/[- ]/g, '').toLowerCase() === 'checkin' && s[k]) return s[k];
            }
            return '-';
          }
          return s['TKTU ONSITE'] || '-';
        })()}</td>
      </tr>`;
    }).join('');

    document.getElementById('list-modal').classList.add('visible');
  },
  closeListModal() {
    document.getElementById('list-modal').classList.remove('visible');
  },

  openMapPopup(siteName) {
    try {
      const site = App.sites.find(s => s['Site'] === siteName);
      if (!site) {
        alert('Không tìm thấy trạm: ' + siteName);
        return;
      }
      this.showSiteDetail(site);
    } catch(e) {
      alert('Lỗi khi mở popup: ' + e.message);
    }
  },

    showSiteDetails(siteName) {
    const site = App.sites.find(s => s['Site'] === siteName);
    if (!site) return;

    this.currentDetailSite = site;
    document.getElementById('detail-modal-title').textContent = "Chi tiết: " + siteName;
    
    const tbody = document.getElementById('detail-modal-content');
    
    let html = '';
    Object.keys(site).forEach(key => {
      if (key === 'Site' || key === 'rowIdx') return;
      let val = site[key];
      const cat = String(site['Phân loại'] || '').trim();
      if (cat === '4G Z' && key === 'Tiến độ 5G') val = '';
      if (cat === '5G Z' && key === 'Tiến độ 4G') val = '';

      if (val === undefined || val === null) val = '';
      if (key.includes('Ngày') || key.includes('Thời gian')) val = String(val);
      
      html += `<tr>
        <th>${key}</th>
        <td>${val}</td>
      </tr>`;
    });

    tbody.innerHTML = `<tbody>${html}</tbody>`;
    document.getElementById('detail-modal').classList.add('visible');
  },

  closeDetailModal() {
    document.getElementById('detail-modal').classList.remove('visible');
  },

  // ============================================================
  // Exports
  // ============================================================
    cleanSiteForExport(site, isCheckinMode = false) {
    const ordered = {};
    ordered['Site'] = site['Site'] || '';
    ordered['Phân loại'] = site['Phân loại'] || '';
    ordered['Huyện'] = site['Huyện'] || '';
    ordered['Phương án Swap'] = site['Phương án Swap'] || '';
    
    let p4g = site['Tiến độ 4G'] || '';
    let p5g = site['Tiến độ 5G'] || '';
    const cat = String(site['Phân loại'] || '').trim();
    if (cat === '4G Z') p5g = '';
    if (cat === '5G Z') p4g = '';
    
    ordered['Tiến độ 4G'] = p4g;
    ordered['Tiến độ 5G'] = p5g;
    ordered['Status'] = DataService.getStatusLabel(DataService.getSiteStatus(site)) || '';
    ordered['User cập nhật'] = site['User cập nhật'] || '';
    ordered['Ngày cập nhật'] = site['Ngày cập nhật'] || '';

    if (isCheckinMode) {
      let checkinVal = '';
      let linkVal = '';
      for (const k in site) {
        let n = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s\-]/g,'');
        if (n === 'checkin' && site[k]) {
          checkinVal = site[k];
        }
        if ((n.includes('linkanhcheckin') || n.includes('anhcheckin') || n === 'linkanh') && site[k]) {
          linkVal = site[k];
        }
      }
      if (checkinVal) ordered['Thời gian Check-in'] = checkinVal;
    }
    
    return ordered;
  },

  exportDashboardPDF() {
    const role = Auth.getRole();
    if (role !== 'admin') return App.showToast('Chỉ Admin mới được xuất báo cáo PDF', 'error');
    if (!window.html2pdf) return App.showToast('Lỗi: Thư viện PDF chưa tải', 'error');
    
    App.showLoading('Đang xuất Báo cáo PDF...');
    
    setTimeout(() => {
      const element = document.querySelector('.dashboard-container');
      
      // Save original states
      const headerBtns = document.querySelector('.dashboard-header div');
      const headerTitle = document.querySelector('.dashboard-header h2');
      const exportBtn = document.getElementById('dashboard-export-btn');
      const closeBtn = document.getElementById('dashboard-close-btn');
      const recentUpdates = document.getElementById('dash-recent-updates');
      const recentUpdatesParent = recentUpdates ? recentUpdates.parentNode : null;
      
      const originalTitleText = headerTitle.innerHTML;
      headerTitle.innerHTML = '📊 BÁO CÁO TIẾN ĐỘ'; // Change title
      
      const originalStyles = [];
      
      if (headerBtns) {
        originalStyles.push({ el: headerBtns, display: headerBtns.style.display });
        headerBtns.style.display = 'none';
      } else {
        if (exportBtn) {
          originalStyles.push({ el: exportBtn, display: exportBtn.style.display });
          exportBtn.style.display = 'none';
        }
        if (closeBtn) {
          originalStyles.push({ el: closeBtn, display: closeBtn.style.display });
          closeBtn.style.display = 'none';
        }
      }
      
      if (recentUpdatesParent) {
        originalStyles.push({ el: recentUpdatesParent, display: recentUpdatesParent.style.display });
        recentUpdatesParent.style.display = 'none';
      }
      
      document.documentElement.setAttribute('data-pdf-export', 'true');
      
      // Inject gorgeous Light Theme for PDF
      const printStyle = document.createElement('style');
      printStyle.id = 'pdf-print-style';
      printStyle.innerHTML = `
        * { font-weight: 600 !important; }
        .dashboard-container {
           background-color: #ffffff !important;
           color: #000000 !important;
           padding: 30px !important;
           border: none !important;
           box-shadow: none !important;
        }
        .dashboard-header {
           background: #ffffff !important;
           border-bottom: 4px solid #1d4ed8 !important;
           padding-bottom: 15px !important;
           margin-bottom: 30px !important;
        }
        .dashboard-header h2 {
           color: #1e3a8a !important;
           font-size: 36px !important;
           font-weight: 800 !important;
           text-align: center !important;
           justify-content: center !important;
           width: 100% !important;
           margin-bottom: 0 !important;
           text-transform: uppercase !important;
           text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
        }
        .dash-card {
           background: #ffffff !important;
           border: 2px solid #e2e8f0 !important;
           box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05) !important;
        }
        .dash-section {
           background: #ffffff !important;
           border: 2px solid #e2e8f0 !important;
           box-shadow: 0 6px 12px rgba(0, 0, 0, 0.05) !important;
        }
        .dash-card-label {
           color: #475569 !important;
           font-weight: 800 !important;
           font-size: 15px !important;
        }
        .dash-card-value {
           font-weight: 800 !important;
        }
        .dash-table th {
           background: #f1f5f9 !important;
           color: #0f172a !important;
           font-weight: 800 !important;
           border-bottom: 2px solid #cbd5e1 !important;
        }
        .dash-table td {
           border-bottom: 1px solid #e2e8f0 !important;
           color: #000000 !important;
           font-weight: 700 !important;
        }
        .dash-table tr:nth-child(even) {
           background: #f8fafc !important;
        }
        .dash-section-title {
           color: #1e3a8a !important;
           border-left: 6px solid #2563eb !important;
           background: linear-gradient(90deg, #eff6ff, #ffffff) !important;
           padding: 12px 20px !important;
           border-radius: 6px !important;
           font-size: 19px !important;
           font-weight: 800 !important;
        }
        .card-total .dash-card-value { color: #1d4ed8 !important; }
        .card-completed .dash-card-value { color: #15803d !important; }
        .card-progress .dash-card-value { color: #b91c1c !important; }
        .card-pending .dash-card-value { color: #475569 !important; }
      `;
      document.head.appendChild(printStyle);

      // Update Chart.js colors to bold dark text
      const updateChartColor = (chart, color) => {
         if (!chart) return;
         if (chart.options.scales && chart.options.scales.x && chart.options.scales.x.ticks) {
             chart.options.scales.x.ticks.color = color;
             chart.options.scales.x.ticks.font = { weight: 'bold', size: 14 };
         }
         if (chart.options.scales && chart.options.scales.y && chart.options.scales.y.ticks) {
             chart.options.scales.y.ticks.color = color;
             chart.options.scales.y.ticks.font = { weight: 'bold', size: 14 };
         }
         if (chart.options.plugins && chart.options.plugins.legend && chart.options.plugins.legend.labels) {
             chart.options.plugins.legend.labels.color = color;
             chart.options.plugins.legend.labels.font = { weight: 'bold', size: 14 };
         }
         if (chart.options.plugins && chart.options.plugins.title) {
             chart.options.plugins.title.color = color;
             chart.options.plugins.title.font = { weight: 'bold', size: 16 };
         }
         chart.update('none'); // Update without animation
      }
      
      updateChartColor(window.chartOverallInstance, '#000000');
      updateChartColor(window.chartCatInstance, '#000000');
      updateChartColor(window.chartPartInstance, '#000000');
      updateChartColor(window.chartHuyenInstance, '#000000');

      // Small delay for charts to re-render
      setTimeout(() => {
        const width = element.scrollWidth;
        const height = element.scrollHeight + 40;
        
        const opt = {
          margin:       [10, 0],
          filename:     'Bao_Cao_Tien_Do.pdf',
          image:        { type: 'jpeg', quality: 1 },
          html2canvas:  { scale: 2, useCORS: true, windowWidth: width, windowHeight: height, scrollY: 0, backgroundColor: '#ffffff' },
          jsPDF:        { unit: 'px', format: [width, height + 20], orientation: width > height ? 'landscape' : 'portrait' }
        };
        
        const restoreAll = () => {
          App.hideLoading();
          originalStyles.forEach(item => {
            if (item.el) item.el.style.display = item.display;
          });
          headerTitle.innerHTML = originalTitleText; // Restore title
          document.documentElement.removeAttribute('data-pdf-export');
          printStyle.remove();
          
          updateChartColor(window.chartOverallInstance, '#cbd5e1');
          updateChartColor(window.chartCatInstance, '#cbd5e1');
          updateChartColor(window.chartPartInstance, '#cbd5e1');
          updateChartColor(window.chartHuyenInstance, '#cbd5e1');
        };

        html2pdf().set(opt).from(element).save().then(() => {
          restoreAll();
        }).catch(err => {
          console.error(err);
          App.showToast('Lỗi khi xuất PDF', 'error');
          restoreAll();
        });
      }, 500); // 500ms allows canvas to flush its render queue
    }, 500);
  },
  exportDashboardExcel() {
    const role = Auth.getRole();
    if (!['admin', 'manager', 'export'].includes(role)) return App.showToast('Tài khoản của bạn không được xuất dữ liệu', 'error');
    if (!window.XLSX) return App.showToast('Lỗi: Thư viện Excel chưa tải', 'error');
    
    const wb = XLSX.utils.book_new();
    
    // Only completed and in_progress sites
    const activeSites = App.sites.filter(s => {
      const st = DataService.getSiteStatus(s);
      return st === 'completed' || st === 'in_progress';
    });

    const pendingSites = App.sites.filter(s => {
      const st = DataService.getSiteStatus(s);
      return st !== 'completed' && st !== 'in_progress';
    });

    const allActive = activeSites.map(s => this.cleanSiteForExport(s, false));
    const wsAll = XLSX.utils.json_to_sheet(allActive);
    XLSX.utils.book_append_sheet(wb, wsAll, "Hoàn thành - Đang TH");

    if (pendingSites.length > 0) {
      const allPending = pendingSites.map(s => this.cleanSiteForExport(s, false));
      const wsPending = XLSX.utils.json_to_sheet(allPending);
      XLSX.utils.book_append_sheet(wb, wsPending, "Chưa thực hiện");
    }

    XLSX.writeFile(wb, "Bao_Cao_Tien_Do_SWAP.xlsx");
  },

  exportListExcel() {
    const role = Auth.getRole();
    if (!['admin', 'manager', 'export', 'doitac', 'partner_view_limited'].includes(role)) return App.showToast('Tài khoản của bạn không được xuất dữ liệu', 'error');
    if (!window.XLSX) return App.showToast('Lỗi: Thư viện Excel chưa tải', 'error');
    if (!this.currentListData || this.currentListData.length === 0) return App.showToast('Không có dữ liệu', 'error');
    
    const exportData = this.currentListData;

    const isCheckinMode = this.currentListFilter && this.currentListFilter.includes('checkin');
    const cleanData = exportData.map(s => this.cleanSiteForExport(s, isCheckinMode));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(cleanData);
    XLSX.utils.book_append_sheet(wb, ws, "Danh sách");
    
    let safeName = (this.currentListTitle || 'Danh_sach').replace(/[\\/:*?"<>|]/g, '_');
    XLSX.writeFile(wb, safeName + ".xlsx");
  },

  exportDetailExcel() {
    const role = Auth.getRole();
    if (!['admin', 'manager', 'export'].includes(role)) return App.showToast('Tài khoản của bạn không được xuất dữ liệu', 'error');
    if (!window.XLSX) return App.showToast('Lỗi: Thư viện Excel chưa tải', 'error');
    if (!this.currentDetailSite) return;

    const data = Object.keys(this.currentDetailSite)
      .filter(k => k !== 'rowIdx' && k !== 'Long' && k !== 'Lat' && k !== 'Ghi chú (TKTU ONSITE)' && k !== 'NOTE TKTU' && k !== 'SĐT TKTU ONSITE')
      .map(k => {
        let val = this.currentDetailSite[k];
        const cat = String(this.currentDetailSite['Phân loại'] || '').trim();
        if (cat === '4G Z' && k === 'Tiến độ 5G') val = '';
        if (cat === '5G Z' && k === 'Tiến độ 4G') val = '';
        return { "Trường thông tin": k, "Giá trị": val };
      });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Chi tiết trạm");
    XLSX.writeFile(wb, `Chi_tiet_${this.currentDetailSite['Site']}.xlsx`);
  },

  exportDetailPDF() {
    const role = Auth.getRole();
    if (!['admin', 'manager', 'export'].includes(role)) return App.showToast('Tài khoản của bạn không được xuất dữ liệu', 'error');
    if (!window.html2pdf) return App.showToast('Lỗi: Thư viện PDF chưa tải', 'error');
    const element = document.querySelector('#detail-modal .modal-body');
    const opt = {
      margin:       10,
      filename:     `Chi_tiet_${this.currentDetailSite['Site']}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  },

  // ============================================================
  // Weather Forecast (Open-Meteo API)
  // ============================================================
  async loadWeatherForecast(lat, lng) {
    const container = document.getElementById('weather-content');
    const section = document.getElementById('weather-section');
    if (!container || !section) return;

    // Reset
    container.innerHTML = '<div class="weather-loading"><div class="spinner-small"></div><span>Đang tải thời tiết...</span></div>';
    const labelEl = document.getElementById('weather-active-label');
    if (labelEl) labelEl.textContent = '';

    if (!navigator.onLine) {
      container.innerHTML = '<div class="weather-offline">📴 Không thể tải thời tiết (offline)</div>';
      return;
    }

    if (!lat || !lng || isNaN(parseFloat(lat)) || isNaN(parseFloat(lng))) {
      container.innerHTML = '<div class="weather-offline">Không có tọa độ trạm</div>';
      return;
    }

    try {
      const url = `${AppConfig.WEATHER_API}?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,precipitation,weather_code,wind_speed_10m&forecast_hours=24&timezone=Asia/Ho_Chi_Minh`;
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error('API error');
      const data = await response.json();

      if (!data.hourly || !data.hourly.time) {
        container.innerHTML = '<div class="weather-offline">Không có dữ liệu thời tiết</div>';
        return;
      }

      const times = data.hourly.time;
      const temps = data.hourly.temperature_2m;
      const precips = data.hourly.precipitation;
      const codes = data.hourly.weather_code;
      const winds = data.hourly.wind_speed_10m;

      let html = '<div class="weather-scroll"><div class="weather-grid">';
      for (let i = 0; i < times.length; i++) {
        const time = new Date(times[i]);
        const hour = String(time.getHours()).padStart(2, '0') + ':00';
        let rainClass = '';
        if (precips[i] > 0) {
          if (codes[i] >= 51 && codes[i] <= 57) {
            rainClass = 'weather-drizzle';
          } else {
            rainClass = 'weather-rain';
          }
        }
        const icon = this.getWeatherIcon(codes[i]);
        const label = this.getWeatherLabel(codes[i]);

        html += `
          <div class="weather-hour ${rainClass}" title="${label}" onclick="document.getElementById('weather-active-label').textContent = '${hour} - ${label}'">
            <div class="weather-time">${hour}</div>
            <div class="weather-icon">${icon}</div>
            <div class="weather-temp">${Math.round(temps[i])}°</div>
            <div class="weather-precip">${precips[i] > 0 ? precips[i].toFixed(1) + 'mm' : '-'}</div>
            <div class="weather-wind">${Math.round(winds[i])}km/h</div>
          </div>
        `;
      }
      html += '</div></div>';
      container.innerHTML = html;
    } catch (error) {
      console.error('[Weather] Error:', error);
      container.innerHTML = '<div class="weather-offline">⚠️ Không thể tải thời tiết</div>';
    }
  },

  getWeatherIcon(code) {
    // WMO Weather interpretation codes
    if (code === 0) return '☀️';
    if (code === 1) return '🌤️';
    if (code === 2) return '⛅';
    if (code === 3) return '☁️';
    if (code >= 45 && code <= 48) return '🌫️';
    if (code >= 51 && code <= 55) return '🌦️';
    if (code >= 56 && code <= 57) return '🌧️';
    if (code >= 61 && code <= 65) return '🌧️';
    if (code >= 66 && code <= 67) return '🌨️';
    if (code >= 71 && code <= 77) return '❄️';
    if (code >= 80 && code <= 82) return '🌧️';
    if (code >= 85 && code <= 86) return '🌨️';
    if (code >= 95) return '⛈️';
    return '🌡️';
  },

  getWeatherLabel(code) {
    if (code === 0) return 'Trời quang';
    if (code === 1) return 'Ít mây';
    if (code === 2) return 'Mây rải rác';
    if (code === 3) return 'Nhiều mây';
    if (code >= 45 && code <= 48) return 'Sương mù';
    if (code >= 51 && code <= 55) return 'Mưa phùn';
    if (code >= 56 && code <= 57) return 'Mưa phùn đóng băng';
    if (code >= 61 && code <= 63) return 'Mưa nhỏ';
    if (code >= 64 && code <= 65) return 'Mưa lớn';
    if (code >= 66 && code <= 67) return 'Mưa đóng băng';
    if (code >= 71 && code <= 77) return 'Tuyết';
    if (code >= 80 && code <= 82) return 'Mưa rào';
    if (code >= 85 && code <= 86) return 'Mưa tuyết';
    if (code >= 95) return 'Giông bão';
    return 'Không rõ';
  },

  // ============================================================
  // Diagrams (Google Drive auto-lookup)
  // ============================================================
    loadCheckinImage(site) {
    const container = document.getElementById('checkin-media-content');
    if (!container) return;

    let linkKey = Object.keys(site).find(k => {
      let n = k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s\-]/g,'');
      return n.includes('linkanhcheckin') || n.includes('anhcheckin') || n === 'linkanh';
    });

    const imageUrl = linkKey ? String(site[linkKey] || '').trim() : '';

    if (!imageUrl || (!imageUrl.includes('drive.google.com') && !imageUrl.includes('http'))) {
      container.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:13px;text-align:center;">Chưa có ảnh check-in.</div>';
      return;
    }

    // Extract file ID
    let fileId = '';
    const match = imageUrl.match(/d\/([a-zA-Z0-9_-]+)/);
    if (match) fileId = match[1];
    else if (imageUrl.includes('id=')) fileId = imageUrl.split('id=')[1].split('&')[0];

    if (fileId) {
      const thumbUrl = `https://lh3.googleusercontent.com/d/${fileId}=w400`;
      container.innerHTML = `<div class="diagram-grid">
        <div class="diagram-item" onclick="App.openDiagramViewer('${fileId}', 'image')">
          <img src="${thumbUrl}" alt="Ảnh Check-in" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\'diagram-error\'>Không tải được ảnh</div>'">
          <div class="diagram-name">Ảnh Check-in</div>
        </div>
      </div>`;
    } else {
      container.innerHTML = `<div style="padding:12px;text-align:center;"><a href="${imageUrl}" target="_blank" style="color:var(--color-blue);text-decoration:none;">Xem ảnh Check-in</a></div>`;
    }
  },

  async loadDiagrams(siteName) {
    const section = document.getElementById('diagram-section');
    const container = document.getElementById('diagram-content');
    if (!section || !container) return;

    // Always show the section now
    section.style.display = '';
    container.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:13px;">Đang tải sơ đồ...</div>';

    if (!navigator.onLine) {
      container.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:13px;">📴 Offline</div>';
      return;
    }

    try {
      const result = await DataService.apiCall({ action: 'getDiagrams', site: siteName });
      
      if (!result.success) {
        console.error('[Diagrams API Error]:', result.error || result.message);
        container.innerHTML = `<div style="padding:12px;color:var(--color-danger);font-size:13px;">Lỗi: ${result.error || result.message || 'Lý do không xác định (Vui lòng cấp quyền DriveApp trong Apps Script)'}</div>`;
        return;
      }

      if (!result.diagrams || result.diagrams.length === 0) {
        container.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:13px;">Chưa có sơ đồ đấu nối cho trạm này.</div>';
        return;
      }

      let html = '<div class="diagram-grid">';

      result.diagrams.forEach((diag, idx) => {
        const isImage = diag.mimeType && diag.mimeType.startsWith('image/');
        const isPDF = diag.mimeType && diag.mimeType === 'application/pdf';
        const previewUrl = `https://drive.google.com/file/d/${diag.id}/preview`;
        const thumbUrl = `https://lh3.googleusercontent.com/d/${diag.id}=w400`;

        if (isImage) {
          html += `
            <div class="diagram-item" onclick="App.openDiagramViewer('${diag.id}', 'image')">
              <img src="${thumbUrl}" alt="${diag.name}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'diagram-error\\'>Không tải được ảnh</div>'">
              <div class="diagram-name">${diag.name}</div>
            </div>
          `;
        } else {
          html += `
            <div class="diagram-item" onclick="App.openDiagramViewer('${diag.id}', '${isPDF ? 'pdf' : 'other'}')">
              <div class="diagram-file-icon">${isPDF ? '📄' : '📎'}</div>
              <div class="diagram-name">${diag.name}</div>
            </div>
          `;
        }
      });

      html += '</div>';
      container.innerHTML = html;
    } catch (error) {
      console.error('[Diagrams] Error:', error);
    }
  },

  openDiagramViewer(fileId, type) {
    const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
    const directUrl = `https://lh3.googleusercontent.com/d/${fileId}`;

    // Create fullscreen overlay
    const overlay = document.createElement('div');
    overlay.className = 'diagram-viewer-overlay';
    overlay.innerHTML = `
      <div class="diagram-viewer-header">
        <button class="diagram-viewer-close" onclick="App.closeDiagramViewer()">✕</button>
        <a href="https://drive.google.com/file/d/${fileId}/view" target="_blank" class="diagram-viewer-open">↗ Mở trong Drive</a>
      </div>
      <div class="diagram-viewer-content" id="diagram-viewer-content" style="overflow: hidden; display: flex; align-items: center; justify-content: center; height: 90vh;">
        ${type === 'image'
          ? `<img id="diagram-zoom-img" src="${directUrl}" alt="Sơ đồ đấu nối" style="max-width:100%;max-height:100%;object-fit:contain;">`
          : `<iframe src="${previewUrl}" style="width:100%;height:100%;border:none;border-radius:8px;"></iframe>`
        }
      </div>
    `;

    overlay.addEventListener('click', (e) => {
      // Only close if clicking outside the image/iframe
      if (e.target === overlay || e.target.className === 'diagram-viewer-content') App.closeDiagramViewer();
    });

    document.body.appendChild(overlay);
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
      
      // Initialize Panzoom for images after it loads
      if (type === 'image' && window.Panzoom) {
        const img = document.getElementById('diagram-zoom-img');
        const content = document.getElementById('diagram-viewer-content');
        if (img && content) {
          img.onload = () => {
            const panzoom = Panzoom(img, {
              maxScale: 10,
              minScale: 1,
              startScale: 1,
              step: 0.3
            });
            content.addEventListener('wheel', panzoom.zoomWithWheel);
            
            let lastTap = 0;
            img.addEventListener('click', (e) => {
              const currentTime = new Date().getTime();
              const tapLength = currentTime - lastTap;
              if (tapLength < 500 && tapLength > 0) {
                const scale = panzoom.getScale();
                if (scale > 1) {
                  panzoom.zoom(1, { animate: true });
                } else {
                  panzoom.zoomToPoint(3, e, { animate: true });
                }
                e.preventDefault();
              }
              lastTap = currentTime;
            });
          };
          // Fallback if image is already cached
          if (img.complete) {
            img.onload();
          }
        }
      }
    });
  },

  closeDiagramViewer() {
    const overlay = document.querySelector('.diagram-viewer-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 300);
    }
  },

  // ============================================================
  // Configuration File (Google Drive)
  // ============================================================
  async loadSiteConfig(siteName) {
    const btnContainer = document.getElementById('config-btn-container');
    const btn = document.getElementById('modal-config-btn');
    if (!btnContainer || !btn) return;

    btnContainer.style.display = 'none';
    if (!navigator.onLine) return;

    try {
      const result = await DataService.apiCall({ action: 'getConfig', site: siteName });
      if (result.success && result.url) {
        btn.href = result.url;
        btnContainer.style.display = 'block';
      }
    } catch (error) {
      console.error('[Config] Error:', error);
    }
  }
};

// ============================================================
// Start App
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
