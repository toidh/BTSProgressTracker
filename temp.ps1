$jsCode = @'

  // ============================================================
  // Charts Rendering
  // ============================================================
  renderCharts(sites) {
    if (!window.Chart) return;
    
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

    const ctxOverall = document.getElementById('chart-overall');
    if (ctxOverall) {
      if (window.chartOverallInstance) window.chartOverallInstance.destroy();
      window.chartOverallInstance = new Chart(ctxOverall, {
        type: 'doughnut',
        data: {
          labels: ['Hoàn thành', 'Ðang th?c hi?n', 'Chua th?c hi?n'],
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
            legend: { position: 'bottom', labels: { color: '#cbd5e1' } },
            title: { display: true, text: 'T?ng quan ti?n d?', color: '#f8fafc' }
          }
        }
      });
    }

    // 2. Categories Bar Chart
    const cats = {};
    sites.forEach(s => {
      const c = String(s['Phân lo?i'] || 'Khác').trim();
      if (!cats[c]) cats[c] = { comp: 0, ip: 0, p: 0 };
      const status = DataService.getSiteStatus(s);
      if (status === 'completed') cats[c].comp++;
      else if (status === 'in_progress') cats[c].ip++;
      else cats[c].p++;
    });

    const catLabels = Object.keys(cats);
    const catComp = catLabels.map(c => cats[c].comp);
    const catIp = catLabels.map(c => cats[c].ip);
    const catP = catLabels.map(c => cats[c].p);

    const ctxCat = document.getElementById('chart-categories');
    if (ctxCat) {
      if (window.chartCatInstance) window.chartCatInstance.destroy();
      window.chartCatInstance = new Chart(ctxCat, {
        type: 'bar',
        data: {
          labels: catLabels,
          datasets: [
            { label: 'Hoàn thành', data: catComp, backgroundColor: '#10b981' },
            { label: 'Ðang th?c hi?n', data: catIp, backgroundColor: '#ef4444' },
            { label: 'Chua th?c hi?n', data: catP, backgroundColor: '#475569' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { stacked: true, ticks: { color: '#cbd5e1' } },
            y: { stacked: true, ticks: { color: '#cbd5e1' } }
          },
          plugins: {
            legend: { position: 'bottom', labels: { color: '#cbd5e1' } },
            title: { display: true, text: 'Theo Phân lo?i', color: '#f8fafc' }
          }
        }
      });
    }
  },

  // ============================================================
  // Site List & Details Modals
  // ============================================================
  showSiteList(filterId, title) {
    this.currentListFilter = filterId;
    this.currentListTitle = title;
    
    let filtered = [];
    const sites = DataService.sites;
    const planSites = sites.filter(s => DataService.isDailyPlan(s));

    // Determine filtering logic based on ID
    if (filterId.startsWith('daily_plan')) {
      if (filterId === 'daily_plan_all') filtered = planSites;
      if (filterId === 'daily_plan_completed') filtered = planSites.filter(s => DataService.getSiteStatus(s) === 'completed');
      if (filterId === 'daily_plan_in_progress') filtered = planSites.filter(s => DataService.getSiteStatus(s) === 'in_progress');
      if (filterId === 'daily_plan_pending') filtered = planSites.filter(s => { const st = DataService.getSiteStatus(s); return st !== 'completed' && st !== 'in_progress'; });
    } else if (filterId.startsWith('cat_')) {
      const parts = filterId.split('_');
      let cat = 'Khác';
      if (parts[1] === '5g4g') cat = '5G_4G Z';
      if (parts[1] === '5g') cat = '5G Z';
      if (parts[1] === '4g') cat = '4G Z';
      
      const catSites = sites.filter(s => String(s['Phân lo?i']).trim() === cat);
      if (parts[2] === 'all') filtered = catSites;
      if (parts[2] === 'completed') filtered = catSites.filter(s => DataService.getSiteStatus(s) === 'completed');
      if (parts[2] === 'in') filtered = catSites.filter(s => DataService.getSiteStatus(s) === 'in_progress'); // handles 'in_progress'
      if (parts[2] === 'pending') filtered = catSites.filter(s => { const st = DataService.getSiteStatus(s); return st !== 'completed' && st !== 'in_progress'; });
    } else if (filterId.startsWith('group_')) {
      // group_KEY_NAME_STATUS
      const regex = /^group_([^_]+)_(.+)_(all|completed|in_progress|pending)$/;
      const m = filterId.match(regex);
      if (m) {
        const groupKey = m[1];
        const groupName = m[2];
        const status = m[3];
        const groupSites = sites.filter(s => String(s[groupKey] || 'Khác').trim() === groupName);
        if (status === 'all') filtered = groupSites;
        if (status === 'completed') filtered = groupSites.filter(s => DataService.getSiteStatus(s) === 'completed');
        if (status === 'in_progress') filtered = groupSites.filter(s => DataService.getSiteStatus(s) === 'in_progress');
        if (status === 'pending') filtered = groupSites.filter(s => { const st = DataService.getSiteStatus(s); return st !== 'completed' && st !== 'in_progress'; });
      }
    }

    this.currentListData = filtered;

    document.getElementById('list-modal-title').textContent = title + " (" + filtered.length + " tr?m)";
    const tbody = document.querySelector('#list-modal-table tbody');
    const thead = document.querySelector('#list-modal-table thead');
    
    thead.innerHTML = '<tr><th>Mã tr?m</th><th>Phân lo?i</th><th>4G</th><th>5G</th><th>Ð?i tác</th><th>TKTU</th></tr>';
    
    tbody.innerHTML = filtered.map(s => {
      const status = DataService.getSiteStatus(s);
      const color = DataService.getStatusColor(status, s);
      const formatProgress = (p) => {
        const str = String(p || '').trim();
        if (str === 'Hoàn thành') return '?';
        if (str === 'Ðang th?c hi?n') return '??';
        return '—';
      };
      return <tr>
        <td><span class="status-dot" style="background:"></span><a href="#" class="clickable-site" onclick="App.showSiteDetails(''); return false;"></a></td>
        <td></td>
        <td class="num"></td>
        <td class="num"></td>
        <td></td>
        <td></td>
      </tr>;
    }).join('');

    document.getElementById('list-modal').classList.add('visible');
  },

  closeListModal() {
    document.getElementById('list-modal').classList.remove('visible');
  },

  showSiteDetails(siteName) {
    const site = DataService.sites.find(s => s['Site'] === siteName);
    if (!site) return;

    this.currentDetailSite = site;
    document.getElementById('detail-modal-title').textContent = "Chi ti?t: " + siteName;
    
    const tbody = document.getElementById('detail-modal-content');
    
    let html = '';
    // Display all keys
    Object.keys(site).forEach(key => {
      if (key === 'Site' || key === 'rowIdx') return; // Skip internal/title
      let val = site[key];
      if (val === undefined || val === null) val = '';
      if (key.includes('Ngày') || key.includes('Th?i gian')) {
        // Simple string check
        val = String(val);
      }
      
      html += <tr>
        <th></th>
        <td></td>
      </tr>;
    });

    tbody.innerHTML = <tbody></tbody>;
    document.getElementById('detail-modal').classList.add('visible');
  },

  closeDetailModal() {
    document.getElementById('detail-modal').classList.remove('visible');
  },

  // ============================================================
  // Exports
  // ============================================================
  exportDashboardPDF() {
    if (!window.html2pdf) return App.showToast('L?i: Thu vi?n PDF chua t?i', 'error');
    const element = document.querySelector('.dashboard-container');
    const opt = {
      margin:       10,
      filename:     'Bao_Cao_Tien_Do_SWAP.pdf',
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  },

  exportDashboardExcel() {
    if (!window.XLSX) return App.showToast('L?i: Thu vi?n Excel chua t?i', 'error');
    // Export daily plan and all sites
    const wb = XLSX.utils.book_new();
    const planSites = DataService.sites.filter(s => DataService.isDailyPlan(s));
    
    const wsPlan = XLSX.utils.json_to_sheet(planSites);
    XLSX.utils.book_append_sheet(wb, wsPlan, "K? ho?ch ngày");

    const wsAll = XLSX.utils.json_to_sheet(DataService.sites);
    XLSX.utils.book_append_sheet(wb, wsAll, "T?t c? tr?m");

    XLSX.writeFile(wb, "Bao_Cao_Tien_Do_SWAP.xlsx");
  },

  exportListExcel() {
    if (!window.XLSX) return App.showToast('L?i: Thu vi?n Excel chua t?i', 'error');
    if (!this.currentListData || this.currentListData.length === 0) return App.showToast('Không có d? li?u', 'error');
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(this.currentListData);
    XLSX.utils.book_append_sheet(wb, ws, "Danh sách");
    
    let safeName = (this.currentListTitle || 'Danh_sach').replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.writeFile(wb, safeName + ".xlsx");
  },

  exportDetailExcel() {
    if (!window.XLSX) return App.showToast('L?i: Thu vi?n Excel chua t?i', 'error');
    if (!this.currentDetailSite) return;

    // Convert object to vertical array
    const data = Object.keys(this.currentDetailSite)
      .filter(k => k !== 'rowIdx')
      .map(k => ({ "Tru?ng thông tin": k, "Giá tr?": this.currentDetailSite[k] }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Chi ti?t tr?m");
    XLSX.writeFile(wb, Chi_tiet_.xlsx);
  },

  exportDetailPDF() {
    if (!window.html2pdf) return App.showToast('L?i: Thu vi?n PDF chua t?i', 'error');
    const element = document.querySelector('#detail-modal .modal-body');
    const opt = {
      margin:       10,
      filename:     Chi_tiet_.pdf,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  }

'@

 = Get-Content -Path "d:\Tools\Site Compliance Management_V3.3\pwa-bts-progress\js\app.js" -Raw
# Replace the very end closing brace of the App object
 =  -replace '};[\r\n]*// ===+[\r\n]*// Start App[\r\n]*// ===+[\r\n]*document\.addEventListener\(''DOMContentLoaded'', \(\) => {[\r\n]*  App\.init\(\);[\r\n]*}\);[\r\n]*$', "
};

// ============================================================
// Start App
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
"
Set-Content -Path "d:\Tools\Site Compliance Management_V3.3\pwa-bts-progress\js\app.js" -Value 
"Done!"
