/**
 * BTS Progress Tracker - Map Module (Leaflet.js)
 */
const MapManager = {
  map: null,
  markers: {},
  markerLayer: null,
  sectorLayer: null,
  sectorsVisible: true,
  sectorData: [],
  filterDistrict: '',
  userMarker: null,
  userCircle: null,
  currentTileLayer: 'satellite',
  streetLayer: null,
  satelliteLayer: null,
  watchId: null,
  mapBearing: 0,
  measureMode: false,
  measurePoints: [],
  measureLayer: null,
  measureMarkers: [],

  // ============================================================
  // Initialize Map
  // ============================================================
  init() {
    // Restore map state
    const savedState = Storage.getMapState();
    const center = savedState ? savedState.center : AppConfig.MAP_CENTER;
    const zoom = savedState ? savedState.zoom : AppConfig.MAP_ZOOM;

    this.map = L.map('map', {
      rotate: true,
      touchRotate: true,
      bearing: 0,
      center: center,
      zoom: zoom,
      minZoom: AppConfig.MAP_MIN_ZOOM,
      maxZoom: AppConfig.MAP_MAX_ZOOM,
      zoomControl: false,
      attributionControl: false,
    });

    // Add zoom control to bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    // Tile layers - Google Maps
    this.streetLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      attribution: '© Google Maps',
    });

    this.satelliteLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      attribution: '© Google Maps',
    });

    // Default to satellite map
    this.satelliteLayer.addTo(this.map);

    // Marker cluster layer
    this.markerLayer = L.layerGroup().addTo(this.map);

    // Sector layer
    this.sectorLayer = L.layerGroup().addTo(this.map);

    // Save map state on move
    this.map.on('moveend', () => {
      const c = this.map.getCenter();
      Storage.setMapState([c.lat, c.lng], this.map.getZoom());
    });
    this.map.on('rotate', () => {
      this.mapBearing = this.map.getBearing ? this.map.getBearing() : 0;
      const needle = document.getElementById('map-bearing-needle');
      if (needle) needle.style.transform = `rotate(${-this.mapBearing}deg)`;
      const bearingVal = document.getElementById('map-bearing-value');
      if (bearingVal) bearingVal.textContent = Math.round(((this.mapBearing % 360) + 360) % 360) + '°';
    });

    // Add legend
    this.addLegend();

    // Measure layer
    this.measureLayer = L.layerGroup().addTo(this.map);

    // Map click for measure
    this.map.on('click', (e) => {
      if (this.measureMode) {
        this._addMeasurePoint(e.latlng);
      }
    });

    // Two-finger touch rotation (mobile)
    
  },

  // ============================================================
  // Toggle Map Layer
  // ============================================================
  toggleLayer() {
    if (this.currentTileLayer === 'street') {
      this.map.removeLayer(this.streetLayer);
      this.satelliteLayer.addTo(this.map);
      this.currentTileLayer = 'satellite';
    } else {
      this.map.removeLayer(this.satelliteLayer);
      this.streetLayer.addTo(this.map);
      this.currentTileLayer = 'street';
    }
    return this.currentTileLayer;
  },

  // ============================================================
  // Create BTS Marker Icon (SVG)
  // ============================================================
  createBTSIcon(status, color, siteName, isDailyPlan) {
    const scale = isDailyPlan ? 1.5 : 1;
    const dotSize = Math.round(14 * scale);
    const outerR = Math.round(7 * scale);
    const midR = Math.round(5 * scale);
    const innerR = Math.round(2.5 * scale);
    const fontSize = Math.round(7 * scale);
    const iconW = Math.round(20 * scale);
    const iconH = Math.round(28 * scale);
    const dotColor = color;

    const svgHtml = `
      <div class="bts-marker-wrapper" style="position:relative;text-align:center;">
        <svg width="${dotSize}" height="${dotSize}" viewBox="0 0 ${dotSize} ${dotSize}" xmlns="http://www.w3.org/2000/svg">
          <circle cx="${outerR}" cy="${outerR}" r="${outerR}" fill="${dotColor}"/>
          <circle cx="${outerR}" cy="${outerR}" r="${midR}" fill="white"/>
          <circle cx="${outerR}" cy="${outerR}" r="${innerR}" fill="${dotColor}"/>
        </svg>
        <div style="
          position: absolute;
          top: ${dotSize + 1}px;
          left: 50%;
          transform: translateX(-50%);
          color: ${dotColor};
          font-size: ${fontSize}px;
          font-weight: ${isDailyPlan ? 700 : 600};
          text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;
          white-space: nowrap;
          pointer-events: none;
        ">${siteName}</div>
      </div>
    `;

    return L.divIcon({
      html: svgHtml,
      className: 'bts-icon-container',
      iconSize: [iconW, iconH],
      iconAnchor: [iconW / 2, outerR],
      popupAnchor: [0, -outerR],
    });
  },

  // ============================================================
  // Load Sites on Map
  // ============================================================
  allSites: [],

  loadSites(sites) {
    this.markerLayer.clearLayers();
    this.markers = {};
    this.allSites = sites || [];

    if (!sites || sites.length === 0) return;

    this.populateDistrictFilter(sites);

    sites.forEach((site) => {
      const lat = parseFloat(site['Lat']);
      const lng = parseFloat(site['Long']);

      if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

      const siteName = site['Site'] || 'Unknown';
      const status = DataService.getSiteStatus(site);
      const color = DataService.getStatusColor(status, site);
      const isDailyPlan = DataService.isDailyPlan(site);

      const icon = this.createBTSIcon(status, color, siteName, isDailyPlan);
      const marker = L.marker([lat, lng], { icon: icon });

      // Popup content
      marker.on('click', () => {
        App.showSiteDetail(site);
      });

      marker.addTo(this.markerLayer);
      this.markers[siteName] = { marker, site };
    });
  },

  // ============================================================
  // Filter System
  // ============================================================
  populateDistrictFilter(sites) {
    const districts = new Set();
    sites.forEach(s => {
      const d = String(s['Huyện'] || '').trim();
      if (d) districts.add(d);
    });

    const select = document.getElementById('filter-district');
    if (!select) return;

    const currentVal = select.value;
    // Keep first option, remove rest
    while (select.options.length > 1) select.remove(1);

    [...districts].sort((a, b) => a.localeCompare(b, 'vi')).forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      select.appendChild(opt);
    });

    // Restore selection
    if (currentVal) select.value = currentVal;
  },

  toggleFilterBar() {
    const bar = document.getElementById('map-filter-bar');
    if (bar) bar.classList.toggle('active');
  },

  applyFilters() {
    const districtVal = document.getElementById('filter-district')?.value || '';
    const statusVal = document.getElementById('filter-status')?.value || '';
    this.filterDistrict = districtVal;
    this.filterStatus = statusVal;

    Object.values(this.markers).forEach(({ marker, site }) => {
      let show = true;

      // District filter
      if (districtVal) {
        const siteDistrict = String(site['Huyện'] || '').trim();
        if (siteDistrict !== districtVal) show = false;
      }

      // Status filter
      if (statusVal && show) {
        const status = DataService.getSiteStatus(site);
        const isDailyPlan = DataService.isDailyPlan(site);

        if (statusVal === 'daily_plan') {
          if (!isDailyPlan) show = false;
        } else {
          if (status !== statusVal) show = false;
        }
      }

      if (show) {
        if (!this.markerLayer.hasLayer(marker)) {
          marker.addTo(this.markerLayer);
        }
      } else {
        if (this.markerLayer.hasLayer(marker)) {
          this.markerLayer.removeLayer(marker);
        }
      }
    });

    // Re-render sectors with same district filter
    if (this.sectorsVisible) {
      this.renderSectors();
    }
  },

  // ============================================================
  // Fly to Site
  // ============================================================
  flyToSite(siteName) {
    const entry = this.markers[siteName];
    if (entry) {
      this.map.flyTo(entry.marker.getLatLng(), 17, { duration: 1 });
    }
  },

  // ============================================================
  // GPS - Get Current Location
  // ============================================================
  getCurrentLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation không được hỗ trợ'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy;

          this.showUserLocation(lat, lng, accuracy);
          this.map.flyTo([lat, lng], 15, { duration: 1 });

          resolve({ lat, lng, accuracy });
        },
        (error) => {
          let msg = 'Không thể lấy vị trí';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              msg = 'Bạn cần cho phép truy cập vị trí';
              break;
            case error.POSITION_UNAVAILABLE:
              msg = 'Thông tin vị trí không khả dụng';
              break;
            case error.TIMEOUT:
              msg = 'Hết thời gian chờ vị trí';
              break;
          }
          reject(new Error(msg));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );
    });
  },

  showUserLocation(lat, lng, accuracy) {
    if (this.userMarker) {
      this.map.removeLayer(this.userMarker);
    }
    if (this.userCircle) {
      this.map.removeLayer(this.userCircle);
    }

    // User position dot
    this.userMarker = L.circleMarker([lat, lng], {
      radius: 8,
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 1,
      weight: 3,
      className: 'user-location-marker',
    }).addTo(this.map);

    // Accuracy circle
    this.userCircle = L.circle([lat, lng], {
      radius: accuracy,
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.1,
      weight: 1,
    }).addTo(this.map);

    // Pulsing animation via CSS class
    const el = this.userMarker.getElement();
    if (el) el.classList.add('pulse-marker');
  },

  // ============================================================
  // Watch Position (continuous GPS)
  // ============================================================
  startWatchingPosition() {
    if (!navigator.geolocation) return;

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        this.showUserLocation(
          position.coords.latitude,
          position.coords.longitude,
          position.coords.accuracy
        );
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
  },

  stopWatchingPosition() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  },

  // ============================================================
  // Navigate to Site (Open in Google Maps)
  // ============================================================
  navigateToSite(lat, lng) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    window.open(url, '_blank');
  },

  // ============================================================
  // Update single marker
  // ============================================================
  updateMarker(site) {
    const siteName = site['Site'];
    const entry = this.markers[siteName];
    if (!entry) return;

    const status = DataService.getSiteStatus(site);
    const color = DataService.getStatusColor(status, site);
    const isDailyPlan = DataService.isDailyPlan(site);
    const icon = this.createBTSIcon(status, color, siteName, isDailyPlan);

    entry.marker.setIcon(icon);
    entry.site = site;
  },

  // ============================================================
  // Legend
  // ============================================================
  addLegend() {
    const legend = L.control({ position: 'bottomleft' });

    legend.onAdd = function () {
      const div = L.DomUtil.create('div', 'map-legend');
      div.innerHTML = `
        <div class="legend-title">Chú thích</div>
        <div class="legend-item"><span class="legend-dot" style="background:${AppConfig.COLORS.DAILY_PLAN}"></span> Kế hoạch ngày</div>
        <div class="legend-item"><span class="legend-dot" style="background:${AppConfig.COLORS.TYPE_5G_4G}"></span> 5G_4G Z</div>
        <div class="legend-item"><span class="legend-dot" style="background:${AppConfig.COLORS.TYPE_5G}"></span> 5G Z</div>
        <div class="legend-item"><span class="legend-dot" style="background:${AppConfig.COLORS.TYPE_4G}"></span> 4G Z</div>
        <div class="legend-item"><span class="legend-dot" style="background:${AppConfig.COLORS.IN_PROGRESS}"></span> Đang thực hiện</div>
        <div class="legend-item"><span class="legend-dot" style="background:${AppConfig.COLORS.COMPLETED}"></span> Hoàn thành</div>
        <div style="border-top:1px solid rgba(255,255,255,0.15);margin:4px 0;"></div>
        <div class="legend-item"><span class="legend-dot" style="background:#00E5CC"></span> Sector 5G</div>
        <div class="legend-item"><span class="legend-dot" style="background:#FF2D78"></span> Sector 4G700</div>
        <div class="legend-item"><span class="legend-dot" style="background:#FFEE00"></span> Sector khác</div>
      `;
      return div;
    };

    legend.addTo(this.map);
  },

  // ============================================================
  // Sector Rendering
  // ============================================================
  destinationPoint(lat, lng, bearing, distanceMeters) {
    const R = 6371000;
    const d = distanceMeters / R;
    const brng = bearing * Math.PI / 180;
    const lat1 = lat * Math.PI / 180;
    const lng1 = lng * Math.PI / 180;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
    );
    const lng2 = lng1 + Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );
    return [lat2 * 180 / Math.PI, lng2 * 180 / Math.PI];
  },

  getSectorType(sectorName) {
    const name = String(sectorName).toUpperCase();
    if (name.endsWith('5G') || name.includes('_5G_') || name.match(/_\d+_5G$/)) return '5g';
    if (name.includes('4G700')) return '4g700';
    return 'other';
  },

  getMarkerColor(status, site) {
    if (status === 'completed') return '#059669';    // Green
    if (status === 'in_progress') return '#d97706';  // Orange
    if (DataService.isSiteInTodayPlan(site)) return '#dc2626'; // Red for today's plan
    
    switch (status) {
      case 'type_5g_4g': return '#2563eb';   // Blue
      case 'type_5g': return '#9333ea';      // Purple
      case 'type_4g': return '#ca8a04';      // Yellow
      default: return '#64748b';             // Slate
    }
  },

  getSectorColor(type) {
    switch (type) {
      case '5g': return '#00E5CC'; //059669
      case '4g700': return '#FF2D78'; //dc2626
      default: return '#FFEE00'; //1d4ed8
    }
  },

  setSectorData(sectors) {
    const data = sectors || [];
    const getOrder = (type) => {
      if (type === '5g') return 1;
      if (type === '4g700') return 2;
      return 3;
    };
    data.sort((a, b) => {
      const typeA = this.getSectorType(a['Sector'] || '');
      const typeB = this.getSectorType(b['Sector'] || '');
      return getOrder(typeA) - getOrder(typeB);
    });
    this.sectorData = data;
  },

  loadSectors(sectors) {
    this.setSectorData(sectors);
    this.renderSectors();
  },

  renderSectors() {
    this.sectorLayer.clearLayers();
    if (!this.sectorsVisible || !this.sectorData.length) return;

    this.sectorData.forEach(sector => {
      // Apply district filter
      if (this.filterDistrict) {
        const sectorDistrict = String(sector['Huyện'] || '').trim();
        if (sectorDistrict !== this.filterDistrict) return;
      }

      // Apply status filter
      if (this.filterStatus) {
        const siteName = String(sector['Site'] || sector['Mã trạm'] || sector['Mã Trạm'] || '').trim();
        if (siteName) {
          const entry = this.markers[siteName];
          if (entry) {
            const status = DataService.getSiteStatus(entry.site);
            const isDailyPlan = DataService.isDailyPlan(entry.site);
            if (this.filterStatus === 'daily_plan') {
              if (!isDailyPlan) return;
            } else {
              if (status !== this.filterStatus) return;
            }
          } else {
            // If we have a filterStatus but can't find the site, we probably shouldn't show it
            return;
          }
        } else {
          return; // Hide if we can't determine the site
        }
      }

      const lat = parseFloat(sector['Lat']);
      const lng = parseFloat(sector['Long']);
      const azimuth = parseFloat(sector['Azimuth']) || 0;
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

      const sectorName = sector['Sector'] || '';
      const type = this.getSectorType(sectorName);
      const color = this.getSectorColor(type);
      const origin = [lat, lng];

      let shape;
      if (type === '5g') {
        const endPt = this.destinationPoint(lat, lng, azimuth, 235);
        shape = L.polyline([origin, endPt], {
          color: color, weight: 3, opacity: 0.85,
        });
      } else {
        const beamWidth = 30;
        const length = type === '4g700' ? 200 : 130;
        const arcPts = [origin];
        for (let a = azimuth - beamWidth; a <= azimuth + beamWidth; a += 5) {
          arcPts.push(this.destinationPoint(lat, lng, a, length));
        }
        arcPts.push(origin);
        shape = L.polygon(arcPts, {
          color: color, fillColor: color,
          fillOpacity: 0.18, weight: 1.5, opacity: 0.7,
        });
      }

      const val = (v) => (v !== undefined && v !== null && String(v).trim() !== '') ? v : '-';
      shape.bindPopup(`
        <div style="font-family:'Inter',sans-serif;font-size:12px;min-width:180px;">
          <div style="font-weight:700;font-size:13px;margin-bottom:6px;color:${color};">${sectorName}</div>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="color:#94a3b8;padding:2px 8px 2px 0;">Cấu hình mới</td><td style="font-weight:600;">${val(sector['Cấu hình mới'])}</td></tr>
            <tr><td style="color:#94a3b8;padding:2px 8px 2px 0;">Cao/chân cột</td><td style="font-weight:600;">${val(sector['Độ cao so với chân cột'])} m</td></tr>
            <tr><td style="color:#94a3b8;padding:2px 8px 2px 0;">Cao/mặt đất</td><td style="font-weight:600;">${val(sector['Độ cao so với mặt đất'])} m</td></tr>
            <tr><td style="color:#94a3b8;padding:2px 8px 2px 0;">Azimuth</td><td style="font-weight:600;">${val(sector['Azimuth'])}°</td></tr>
            <tr><td style="color:#94a3b8;padding:2px 8px 2px 0;">Tilt cơ</td><td style="font-weight:600;">${val(sector['Tilt cơ'])}°</td></tr>
            <tr><td style="color:#94a3b8;padding:2px 8px 2px 0;">Tilt điện</td><td style="font-weight:600;">${val(sector['Tilt điện'])}°</td></tr>
          </table>
        </div>
      `);
      shape.addTo(this.sectorLayer);
    });
  },

  toggleSectors() {
    this.sectorsVisible = !this.sectorsVisible;
    if (this.sectorsVisible) {
      this.renderSectors();
    } else {
      this.sectorLayer.clearLayers();
    }
    return this.sectorsVisible;
  },

  // ============================================================
  // Load Single Site (for view_limited role)
  // ============================================================
  loadSingleSite(site) {
    this.markerLayer.clearLayers();
    this.markers = {};

    const lat = parseFloat(site['Lat']);
    const lng = parseFloat(site['Long']);
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

    const siteName = site['Site'] || 'Unknown';
    const status = DataService.getSiteStatus(site);
    const color = DataService.getStatusColor(status, site);
    const isDailyPlan = DataService.isDailyPlan(site);

    const icon = this.createBTSIcon(status, color, siteName, isDailyPlan);
    const marker = L.marker([lat, lng], { icon: icon });

    marker.on('click', () => {
      App.showSiteDetail(site);
    });

    marker.addTo(this.markerLayer);
    this.markers[siteName] = { marker, site };

    // Fly to the site
    this.map.flyTo([lat, lng], 17, { duration: 1 });
  },

  // ============================================================
  // Load Sectors for a specific site only (for view_limited role)
  // ============================================================
  loadSectorsForSite(siteName) {
    this.sectorLayer.clearLayers();
    if (!this.sectorData.length) return;

    const upperName = siteName.toUpperCase();
    this.sectorData.forEach(sector => {
      const sectorSiteName = String(sector['Site'] || sector['Mã trạm'] || sector['Mã Trạm'] || '').trim().toUpperCase();
      if (sectorSiteName !== upperName) return;

      const lat = parseFloat(sector['Lat']);
      const lng = parseFloat(sector['Long']);
      const azimuth = parseFloat(sector['Azimuth']) || 0;
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;

      const sectorName = sector['Sector'] || '';
      const type = this.getSectorType(sectorName);
      const color = this.getSectorColor(type);
      const origin = [lat, lng];

      let shape;
      if (type === '5g') {
        const endPt = this.destinationPoint(lat, lng, azimuth, 235);
        shape = L.polyline([origin, endPt], {
          color: color, weight: 3, opacity: 0.85,
        });
      } else {
        const beamWidth = 30;
        const length = type === '4g700' ? 200 : 130;
        const arcPts = [origin];
        for (let a = azimuth - beamWidth; a <= azimuth + beamWidth; a += 5) {
          arcPts.push(this.destinationPoint(lat, lng, a, length));
        }
        arcPts.push(origin);
        shape = L.polygon(arcPts, {
          color: color, fillColor: color,
          fillOpacity: 0.18, weight: 1.5, opacity: 0.7,
        });
      }

      const val = (v) => (v !== undefined && v !== null && String(v).trim() !== '') ? v : '-';
      shape.bindPopup(`
        <div style="font-family:'Inter',sans-serif;font-size:12px;min-width:180px;">
          <div style="font-weight:700;font-size:13px;margin-bottom:6px;color:${color};">${sectorName}</div>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="color:#94a3b8;padding:2px 8px 2px 0;">Cấu hình mới</td><td style="font-weight:600;">${val(sector['Cấu hình mới'])}</td></tr>
            <tr><td style="color:#94a3b8;padding:2px 8px 2px 0;">Cao/chân cột</td><td style="font-weight:600;">${val(sector['Độ cao so với chân cột'])} m</td></tr>
            <tr><td style="color:#94a3b8;padding:2px 8px 2px 0;">Cao/mặt đất</td><td style="font-weight:600;">${val(sector['Độ cao so với mặt đất'])} m</td></tr>
            <tr><td style="color:#94a3b8;padding:2px 8px 2px 0;">Azimuth</td><td style="font-weight:600;">${val(sector['Azimuth'])}°</td></tr>
            <tr><td style="color:#94a3b8;padding:2px 8px 2px 0;">Tilt cơ</td><td style="font-weight:600;">${val(sector['Tilt cơ'])}°</td></tr>
            <tr><td style="color:#94a3b8;padding:2px 8px 2px 0;">Tilt điện</td><td style="font-weight:600;">${val(sector['Tilt điện'])}°</td></tr>
          </table>
        </div>
      `);
      shape.addTo(this.sectorLayer);
    });
  },

  // ============================================================
  // Cleanup
  // ============================================================
  destroy() {
    this.stopWatchingPosition();
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  },

  // ============================================================
  // Map Rotation
  // ============================================================
  

  adjustBearing(delta) {
    if (this.map.setBearing) {
      this.map.setBearing(this.map.getBearing() + delta);
    }
  },

  resetNorth() {
    if (this.map.setBearing) {
      this.map.setBearing(0);
    }
    App.showToast('Hướng Bắc đã được reset về 0°', 'success');
  },

  // ============================================================
  // Two-finger Touch Rotation (Mobile)
  // ============================================================
  

  // ============================================================
  // Distance Measurement
  // ============================================================
  toggleMeasure() {
    this.measureMode = !this.measureMode;
    const btn = document.getElementById('measure-btn');
    if (this.measureMode) {
      this._clearMeasure();
      if (btn) btn.classList.add('active');
      this.map.getContainer().style.cursor = 'crosshair';
      App.showToast('📏 Chế độ đo khoảng cách: Click vào bản đồ để thêm điểm. Double-click để kết thúc.', 'info', 4000);
      // Double-click to finish
      this._measureDblClickHandler = (e) => {
        if (this.measureMode) {
          L.DomEvent.stopPropagation(e);
          this.finishMeasure();
        }
      };
      this.map.on('dblclick', this._measureDblClickHandler);
    } else {
      this.finishMeasure();
    }
    return this.measureMode;
  },

  _addMeasurePoint(latlng) {
    this.measurePoints.push(latlng);
    // Draw marker
    const idx = this.measurePoints.length;
    const marker = L.circleMarker(latlng, {
      radius: 5,
      color: '#00d2ff',
      fillColor: '#00d2ff',
      fillOpacity: 1,
      weight: 2,
    }).addTo(this.measureLayer);
    // Label index
    const label = L.divIcon({
      html: `<div style="background:#00d2ff;color:#000;font-size:10px;font-weight:700;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;margin-left:6px;margin-top:-9px;">${idx}</div>`,
      className: '',
      iconSize: [18, 18],
      iconAnchor: [-3, 9],
    });
    L.marker(latlng, { icon: label, interactive: false }).addTo(this.measureLayer);
    this.measureMarkers.push(marker);

    // Draw line
    if (this.measurePoints.length >= 2) {
      const pts = this.measurePoints;
      const seg = [pts[pts.length - 2], pts[pts.length - 1]];
      L.polyline(seg, { color: '#00d2ff', weight: 2.5, dashArray: '6, 4', opacity: 0.9 }).addTo(this.measureLayer);

      // Show total distance
      let total = 0;
      for (let i = 1; i < pts.length; i++) {
        total += pts[i - 1].distanceTo(pts[i]);
      }
      const distText = total >= 1000 ? (total / 1000).toFixed(3) + ' km' : Math.round(total) + ' m';
      const el = document.getElementById('measure-distance-display');
      if (el) { el.textContent = '📏 ' + distText; el.style.display = 'block'; }
    }
  },

  finishMeasure() {
    this.measureMode = false;
    const btn = document.getElementById('measure-btn');
    if (btn) btn.classList.remove('active');
    this.map.getContainer().style.cursor = '';
    if (this._measureDblClickHandler) {
      this.map.off('dblclick', this._measureDblClickHandler);
      this._measureDblClickHandler = null;
    }
    if (this.measurePoints.length < 2) {
      this._clearMeasure();
    }
  },

  _clearMeasure() {
    this.measurePoints = [];
    this.measureMarkers = [];
    if (this.measureLayer) this.measureLayer.clearLayers();
    const el = document.getElementById('measure-distance-display');
    if (el) { el.textContent = ''; el.style.display = 'none'; }
  },

  clearMeasure() {
    this._clearMeasure();
    this.measureMode = false;
    const btn = document.getElementById('measure-btn');
    if (btn) btn.classList.remove('active');
    this.map.getContainer().style.cursor = '';
  },
};
