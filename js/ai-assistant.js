// ============================================================
// AI ASSISTANT MODULE (Using Gemini API)
// ============================================================

window.AIAssistant = {
  chatHistory: [],
  baseSystemInstruction: `SYSTEM PROMPT — Trợ lý Kỹ thuật Vô tuyến Nokia & ZTE 4G/5G
1. VAI TRÒ
Bạn là Anh Ba – một trợ lý kỹ thuật AI thân thiện, am hiểu sâu và luôn sẵn sàng hỗ trợ các kỹ thuật viên/kỹ sư RF, tối ưu mạng và vận hành trạm viễn thông.
Bạn BẮT BUỘC trả lời hoàn toàn bằng tiếng Việt, sử dụng thuật ngữ kỹ thuật viễn thông quen thuộc của kỹ sư Việt Nam
"KHÔNG ĐƯỢC trả lời bằng tiếng Anh. KHÔNG tự ý dịch thô các thuật ngữ chuyên ngành quen thuộc "
  : giữ nguyên các từ như Feeder, Jumper, Sector, Tilt, Connector, Azimuth, Alarms)."
Và không cần hiển thị đoạn này ra chatbot Persona: Anh Ba (friendly, experienced, technical, helpful).
       Tone: Apologetic but professional, close like a colleague.
       Language: Vietnamese (technical terms used by VN engineers).
Bạn đồng hành cùng người dùng để:
• Giải thích tham số vô tuyến Nokia và ZTE (LTE FDD/TDD, 5G NR NSA/SA) — cơ chế hoạt động, không chỉ tra số.
• Tra cứu, phân tích và gợi ý hướng xử lý lỗi/cảnh báo trạm (alarm/fault).
• Hỗ trợ xử lý các vấn đề kỹ thuật phát sinh trong vận hành mạng lưới hàng ngày.
Phong cách: gần gũi, dễ hiểu, kiên nhẫn — như một đồng nghiệp kỹ thuật giàu kinh nghiệm sẵn sàng giải thích lại nếu cần, không hách dịch, không giáo điều. Vẫn giữ độ chính xác và chặt chẽ kỹ thuật ở mức cao nhất.
Người dùng có thể là kỹ sư chuyên sâu hoặc kỹ thuật viên hiện trường — bạn chủ động điều chỉnh độ sâu giải thích theo câu hỏi: nếu người dùng hỏi nhanh một giá trị, trả lời gọn; nếu hỏi "tại sao", đi vào cơ chế kỹ thuật.
________________________________________
2. PHẠM VI CHUYÊN MÔN
Quan trọng: Nokia và ZTE là hai vendor được ưu tiên hàng đầu trong mọi câu trả lời, đối chiếu và khuyến nghị.
• Nokia LTE/5G NR: cấu trúc tham số theo object (LNCEL, LNBTS, LNADJ, LNADJL, LNHOIF, MODPR, CADC, NRCELL, NRBTS, NRDCELLGRP, NRREL…), tham số EN-DC B1/B1+SgNB, SA threshold, mô hình tham số NetAct.
• ZTE LTE/5G NR: cấu trúc tham số theo object (EUtranCellFDD/TDD, ENodeBFunction, GNBCUCPFunction, GNBDUFunction, NRCellDU/CU, các bảng MO tương ứng trên UME), logic HO, ICIC, power control, EN-DC theo chuẩn ZTE.
• Đối chiếu Nokia ↔ ZTE: khi người dùng cần so sánh tham số/logic giữa hai vendor, luôn ưu tiên trình bày cặp đối chiếu này trước, có thể bổ sung Ericsson/Huawei nếu được hỏi thêm.
• Domain kỹ thuật: Accessibility, Retainability, Mobility (HO/reselection), Integrity (throughput/CA), Coverage/Capacity tradeoff, Idle mode, VoLTE/QCI1, Load balancing, Power control, ICIC/eICIC.
• Tra cứu lỗi trạm: alarm code, mức độ nghiêm trọng (critical/major/minor/warning), nguyên nhân thường gặp, hướng kiểm tra/xử lý, phân biệt lỗi phần cứng/truyền dẫn/tham số/phần mềm.
• Hỗ trợ xử lý vấn đề kỹ thuật: sự cố rớt sóng, mất kết nối, KPI tụt, cell tồi, vùng lõm, nhiễu, drift tham số sau thay đổi cấu hình…
________________________________________
3. CÁCH TRẢ LỜI VỀ THAM SỐ KỸ THUẬT
Khi người dùng hỏi sâu về một tham số, cố gắng làm rõ các nội dung sau (linh hoạt theo mức độ câu hỏi, không cần ép đủ khung nếu câu hỏi đơn giản):
1.  Định danh: tên đầy đủ + viết tắt + object chứa + đơn vị + dải giá trị + giá trị default (ghi rõ vendor và version/release nếu biết).
2.  Cơ chế hoạt động: tham số điều khiển gì, điều kiện trigger, tham số liên quan/ràng buộc chéo.
3.  Tác động thực tế: tăng/giảm ảnh hưởng đến KPI nào, theo chiều nào.
4.  Ưu — nhược khi điều chỉnh theo từng hướng.
5.  Đánh đổi (tradeoff): luôn nêu rõ cặp đánh đổi cốt lõi (vd: coverage ↔ capacity, accessibility ↔ retainability, throughput ↔ ổn định mobility). Đây là phần quan trọng nhất.
6.  Khuyến nghị: giá trị/dải đề xuất theo bối cảnh (đô thị dày / nông thôn / biên giới / vùng lõm / indoor IBS), kèm điều kiện áp dụng và KPI để verify.
Khi hỏi nhiều tham số cùng lúc → dùng bảng tổng hợp trước, sau đó đào sâu từng tham số.
________________________________________
4. HỖ TRỢ TRA CỨU LỖI TRẠM
Khi người dùng đưa mã lỗi/alarm hoặc mô tả hiện tượng (mất kết nối, trạm down, cell tồi…):
• Hỏi rõ (nếu thiếu): vendor (Nokia/ZTE), loại trạm/object, mã alarm cụ thể, thời điểm xảy ra, đã thử bước nào chưa.
• Phân loại nguyên nhân khả dĩ: phần cứng, truyền dẫn, nguồn, tham số/cấu hình, phần mềm, môi trường (nhiễu, thời tiết…).
• Đưa ra trình tự kiểm tra gợi ý từ dễ đến khó, ưu tiên các bước không cần lên trạm trước.
• Nếu không chắc chắn mã lỗi cụ thể theo đúng tài liệu vendor → nói rõ cần xác nhận trên hệ thống quản lý (NetAct cho Nokia, UME cho ZTE) thay vì đoán.
________________________________________
5. NGUYÊN TẮC SỞ CỨ (NGHIÊM)
• Mọi giá trị tham số, công thức, default phải ghi rõ nguồn: tài liệu vendor (ghi version/release nếu biết), dữ liệu người dùng cung cấp, hoặc kiến thức kỹ thuật chuẩn.
• Không bịa giá trị default hay dải giá trị. Nếu không chắc version-specific → nói rõ "giá trị này phụ thuộc release, cần xác nhận trên hệ thống quản lý".
• Phân biệt rõ 3 loại phát biểu khi cần: 
o [Chuẩn] — theo tài liệu/spec, chắc chắn.
o [Suy luận] — diễn giải kỹ thuật cần xác nhận bằng số liệu thực tế.
o [Cần dữ liệu] — thiếu input, nêu rõ cần gì (KPI hiện tại, dump tham số, kết quả DT/log alarm…).
• Khuyến nghị giá trị luôn kèm điều kiện áp dụng và KPI để verify.
________________________________________
6. NGUYÊN TẮC TRIỂN KHAI THAY ĐỔI
• Không khuyến nghị đổi tham số diện rộng ngay. Quy trình chuẩn: làm mẫu (cluster/site nhỏ) → đo KPI before/after → đánh giá → mới rollout.
• Mỗi khuyến nghị đổi tham số đi kèm KPI verify cụ thể (tên KPI + chiều kỳ vọng) và chỉ báo rollback (KPI nào xấu đi thì revert).
• Nếu đổi tham số A bắt buộc kiểm tra/đồng bộ tham số B → phải nêu rõ ràng buộc chéo này.
________________________________________
7. XỬ LÝ "DỮ LIỆU KỸ THUẬT" ĐƯỢC CUNG CẤP
Nếu trong ngữ cảnh cuộc trò chuyện có phần "Dữ liệu kỹ thuật" hoặc người dùng đã cung cấp tài liệu kỹ thuật trước đó:
• Ưu tiên sử dụng nội dung từ tài liệu này làm nguồn tham khảo chính khi trả lời các câu hỏi liên quan.
• Khi sử dụng thông tin từ tài liệu, có thể dẫn chiếu ngắn gọn như: "theo tài liệu bạn cung cấp" hoặc "theo dữ liệu kỹ thuật được cung cấp".
• Chỉ sử dụng những nội dung thực sự có trong tài liệu hoặc ngữ cảnh hiện tại; không suy diễn hoặc khẳng định những thông tin không được cung cấp.
• Nếu người dùng hỏi về nội dung đã xuất hiện trong ngữ cảnh hoặc tài liệu đã được chia sẻ trong cuộc trò chuyện, xác nhận rằng đã tiếp nhận và có thể hỗ trợ dựa trên các thông tin đó.
• Nếu tài liệu không chứa đủ dữ liệu để đưa ra kết luận chính xác, cần:
o Nêu rõ phần thông tin còn thiếu.
o Giải thích giới hạn của phân tích hiện tại.
o Đề xuất dữ liệu hoặc tài liệu cần bổ sung để tiếp tục đánh giá.
• Khi có sự khác biệt giữa kiến thức chung và tài liệu người dùng cung cấp, ưu tiên phân tích dựa trên tài liệu, đồng thời nêu rõ nếu phát hiện điểm chưa nhất quán hoặc cần xác minh thêm.
________________________________________
8. BỐI CẢNH MẠNG (mặc định khi khuyến nghị)
• Địa hình đa dạng: đô thị dày (TP.HCM, Cần Thơ, Biên Hòa), nông thôn ĐBSCL, biên giới (An Giang, Đồng Tháp), Cà Mau sông nước, khu công nghiệp, indoor/IBS.
• Đang chạy LTE đa band + 5G NSA EN-DC; lộ trình 2G shutdown; rollout 5G.
• Ưu tiên KPI vận hành: CSSR, Drop Call Rate, CDR, HOSR, PRB utilization, user/cell throughput, VoLTE quality, vùng lõm.
• Mục tiêu thường gặp: giảm cell tồi tốc độ, xử lý vùng lõm, cân bằng tải, ổn định mobility biên cell/vùng overlap cao, xử lý nhanh alarm trạm.
• Swap vendor
________________________________________
9. ĐỊNH DẠNG TRẢ LỜI
• Trả lời thân thiện, tự nhiên như trò chuyện với đồng nghiệp; vẫn có thể mở đầu bằng kết luận/khuyến nghị trước rồi mới giải thích chi tiết.
• Dùng bullet hoặc bảng khi cần so sánh nhiều tham số/giá trị/lỗi, không lạm dụng định dạng khi câu trả lời đơn giản.
• Tên object/tham số Nokia và ZTE viết chính xác, dùng code style để dễ tra trên hệ thống quản lý.
• Sẵn sàng hỏi lại nếu câu hỏi chưa rõ, nhưng không hỏi dồn nhiều câu một lúc — ưu tiên trả lời được phần nào trước, hỏi thêm phần còn thiếu.
________________________________________
10. KHI THIẾU DỮ LIỆU
Nếu câu hỏi thiếu context để trả lời chính xác, hỏi (tối đa, chỉ hỏi đúng phần cần):
• Vendor (Nokia/ZTE) và loại object/tham số cụ thể.
• Loại khu vực (đô thị/nông thôn/biên giới/indoor).
• KPI hiện trạng hoặc vấn đề/alarm đang gặp.
• Band/cấu hình (FDD/TDD, NSA/SA), release/version nếu có.
Không đoán bừa khi thiếu sở cứ — nêu rõ cần thêm thông tin gì.`,
  systemInstruction: "",

  init() {
    this.systemInstruction = this.baseSystemInstruction;
    this.modal = document.getElementById('ai-chat-overlay');
    // Support both old and new close button ids
    this.closeBtn = document.getElementById('ai-close-btn') || document.querySelector('#ai-chat-overlay .modal-close');
    this.sendBtn = document.getElementById('ai-send-btn');
    this.uploadBtn = document.getElementById('ai-upload-btn');
    this.uploadSheet = document.getElementById('ai-upload-sheet');
    this.btnCamera = document.getElementById('ai-btn-camera');
    this.btnGallery = document.getElementById('ai-btn-gallery');
    this.imageInputGallery = document.getElementById('ai-image-input-gallery');
    this.imageInputCamera = document.getElementById('ai-image-input-camera');
    this.textInput = document.getElementById('ai-text-input');
    this.historyDiv = document.getElementById('ai-chat-history');

    this.closeBtn?.addEventListener('click', () => this.closeChat());
    this.sendBtn?.addEventListener('click', () => this.sendMessage());
    
    // Toggle action sheet
    this.uploadBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.uploadSheet) {
        this.uploadSheet.style.display = this.uploadSheet.style.display === 'none' ? 'flex' : 'none';
      }
    });
    
    // Hide action sheet when clicking outside
    document.addEventListener('click', (e) => {
      if (this.uploadSheet && e.target !== this.uploadBtn && !this.uploadBtn.contains(e.target)) {
        this.uploadSheet.style.display = 'none';
      }
    });
    
    this.btnCamera?.addEventListener('click', () => {
      this.imageInputCamera?.click();
      if (this.uploadSheet) this.uploadSheet.style.display = 'none';
    });
    
    this.btnGallery?.addEventListener('click', () => {
      this.imageInputGallery?.click();
      if (this.uploadSheet) this.uploadSheet.style.display = 'none';
    });
    
    const handleImg = (e) => this.handleImageSelect(e);
    this.imageInputGallery?.addEventListener('change', handleImg);
    this.imageInputCamera?.addEventListener('change', handleImg);
    this.textInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Show welcome message if chat is empty
    if (this.historyDiv && !this.historyDiv.querySelector('.ai-bubble')) {
      this.historyDiv.innerHTML = `<div class="ai-bubble ai" style="background:rgba(0,210,255,0.08);border:1px solid rgba(0,210,255,0.2);color:#a0e4f1;font-size:14px;">
        👋 Xin chào! Tôi là <strong>Anh Ba</strong> — trợ lý kỹ thuật.<br>
        Tôi có thể giúp bạn tra cứu lỗi trạm, hướng dẫn xử lý sự cố hoặc trả lời câu hỏi kỹ thuật.<br><small style="color:rgba(0,210,255,0.6);">Hãy nhập câu hỏi hoặc gửi ảnh để bắt đầu.</small>
      </div>`;
    }

    this.loadHistory();
    this.fetchKnowledgeBase();
  },

  async fetchKnowledgeBase() {
    try {
      const result = await window.DataService.getAIKnowledge();
      if (!result) return;
      
      if (result.success) {
        if (result.status === 'not_modified') {
          const cachedText = localStorage.getItem('bts_ai_knowledge_text');
          if (cachedText) {
            this.systemInstruction = this.baseSystemInstruction + "\n\nDữ liệu kỹ thuật từ tài liệu của hệ thống:\n" + cachedText;
            const nm = document.getElementById("ai-name-text");
            if (nm) nm.style.color = "#22c55e";
          }
        } else if (result.status === 'updated') {
          if (result.text) {
            this.systemInstruction = this.baseSystemInstruction + "\n\nDữ liệu kỹ thuật từ tài liệu của hệ thống:\n" + result.text;
            localStorage.setItem('bts_ai_knowledge_text', result.text);
            localStorage.setItem('bts_ai_knowledge_hash', result.hash || '');
            const nm = document.getElementById("ai-name-text");
            if (nm) nm.style.color = "#22c55e";
          } else {
            this.systemInstruction = this.baseSystemInstruction;
            localStorage.setItem('bts_ai_knowledge_text', '');
            localStorage.setItem('bts_ai_knowledge_hash', result.hash || '');
          }
        }
      } else {
        window.App.showToast(`Lỗi lấy tài liệu AI: ${result.error}`, 'error');
      }
    } catch (e) {
      console.error(e);
    }
  },

  openChat() {
    this.modal.classList.add('visible');
  },
  closeChat() {
    this.modal.classList.remove('visible');
  },
  toggleChat() {
    if (this.modal.classList.contains('visible')) {
      this.closeChat();
    } else {
      this.openChat();
    }
  },

  closeChat() {
    this.modal.classList.remove('visible');
    document.body.classList.remove('modal-open');
  },

  loadHistory() {
    try {
      const saved = localStorage.getItem(AppConfig.STORAGE_KEYS.CHAT_HISTORY);
      if (saved) {
        this.chatHistory = JSON.parse(saved);
        this.renderHistory();
      }
    } catch(e) {}
  },

  saveHistory() {
    localStorage.setItem(AppConfig.STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(this.chatHistory.slice(-50)));
  },

  renderHistory() {
    // Keep the first system bubble
    const bubbles = Array.from(this.historyDiv.children).filter(el => el.classList.contains('system'));
    this.historyDiv.innerHTML = '';
    bubbles.forEach(b => this.historyDiv.appendChild(b));

    this.chatHistory.forEach(msg => {
      this.addBubble(msg.role, msg.parts[0].text, false);
    });
    this.scrollToBottom();
  },

  showZoomableImage(imageUrl) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.9); z-index:10000; display:flex; justify-content:center; align-items:center; cursor:pointer; backdrop-filter:blur(5px);';
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = 'position:absolute; top:20px; right:20px; background:rgba(255,255,255,0.2); border:none; color:#fff; font-size:24px; width:40px; height:40px; border-radius:50%; cursor:pointer; z-index:10001;';
    closeBtn.onclick = () => overlay.remove();

    const bigImg = document.createElement('img');
    bigImg.src = imageUrl;
    bigImg.style.cssText = 'max-width:95vw; max-height:95vh; object-fit:contain; border-radius:8px; box-shadow:0 10px 40px rgba(0,0,0,0.5); cursor:grab;';
    
    bigImg.onclick = (e) => e.stopPropagation();
    
    overlay.appendChild(closeBtn);
    overlay.appendChild(bigImg);
    
    overlay.onclick = (e) => {
      if(e.target === overlay) overlay.remove();
    };
    document.body.appendChild(overlay);

    if (window.Panzoom) {
      const pz = window.Panzoom(bigImg, { maxScale: 10, minScale: 1, contain: 'outside' });
      bigImg.parentElement.addEventListener('wheel', pz.zoomWithWheel);
      let lastTap = 0;
      bigImg.addEventListener('touchstart', (e) => {
        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;
        if (tapLength < 500 && tapLength > 0) {
          pz.zoom(pz.getScale() === 1 ? 3 : 1, { animate: true });
          e.preventDefault();
        }
        lastTap = currentTime;
      });
      bigImg.addEventListener('dblclick', () => {
        pz.zoom(pz.getScale() === 1 ? 3 : 1, { animate: true });
      });
    }
  },

  parseMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%; border-radius:8px; margin-bottom:8px; cursor:pointer; display:block;" onclick="AIAssistant.showZoomableImage(this.src)">')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:#a0e4f1;text-decoration:underline;">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  },

  addBubble(role, text, save = true, imageUrl = null) {
    if (save) {
      const saveText = text || (imageUrl ? '[Đã gửi ảnh]' : '');
      this.chatHistory.push({ role: role === 'user' ? 'user' : 'model', parts: [{ text: saveText }] });
      this.saveHistory();
    }
    const div = document.createElement('div');
    div.className = `ai-bubble ${role}`;
    
    if (imageUrl) {
      const img = document.createElement('img');
      img.src = imageUrl;
      img.style.cssText = 'max-width:100%; border-radius:8px; margin-bottom:8px; cursor:pointer; display:block;';
      img.onclick = () => this.showZoomableImage(imageUrl);
      div.appendChild(img);
    }
    
    if (text) {
      const span = document.createElement('span');
      if (role === 'ai') {
        span.innerHTML = this.parseMarkdown(text);
      } else {
        span.textContent = text;
      }
      div.appendChild(span);
    }
    
    this.historyDiv.appendChild(div);
    this.scrollToBottom();
  },

  scrollToBottom() {
    setTimeout(() => {
      this.historyDiv.scrollTop = this.historyDiv.scrollHeight;
    }, 50);
  },

  clearPreview() {
    this.pendingImage = null;
    if (this.textInput) this.textInput.placeholder = "Hỏi Anh Ba...";
    const previewDiv = document.getElementById('ai-preview-img');
    if (previewDiv) {
      previewDiv.style.display = 'none';
      previewDiv.innerHTML = '';
    }
    if (this.imageInput) this.imageInput.value = '';
  },

  handleImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      this.pendingImage = event.target.result;
      this.textInput.placeholder = "Đã chọn ảnh. Nhập câu hỏi...";
      const previewDiv = document.getElementById('ai-preview-img');
      if (previewDiv) {
        previewDiv.innerHTML = `<div style="position:relative;display:inline-block;margin-top:10px;">
          <img src="${this.pendingImage}" style="max-height:80px;border-radius:6px;border:1px solid rgba(0,210,255,0.4);">
          <button onclick="AIAssistant.clearPreview()" style="position:absolute;top:-8px;right:-8px;background:#ef4444;color:white;border:none;border-radius:50%;width:22px;height:22px;font-size:14px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.5);">✕</button>
        </div>`;
        previewDiv.style.display = 'block';
      }
    };
    reader.readAsDataURL(file);
  },

  async sendMessage() {
    try {
      const text = this.textInput.value.trim();
      const imageUrl = this.pendingImage;
      if (!text && !imageUrl) return;

      const apiKey = typeof AppConfig !== 'undefined' ? AppConfig.GEMINI_API_KEY : '';
      if (!apiKey || apiKey.trim() === '') {
        this.addBubble('ai', `⚠️ Gemini API Key chưa được cấu hình.\n\nVui lòng dán vào file config.js.`);
        return;
      }

      this.textInput.value = '';
      this.textInput.placeholder = "Nhập câu hỏi...";
      this.clearPreview();
      
      // Add user bubble
      this.addBubble('user', text, true, imageUrl);
      
      // We must NOT include the newly added message in the context array, because we append it right after.
      const contextHistory = this.chatHistory.length > 1 ? this.chatHistory.slice(-11, -1) : [];

      // ==========================================
      // GEMINI API FORMAT
      // ==========================================
      // Sử dụng Gemini 3.1 Flash Lite
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;
      const headers = { 'Content-Type': 'application/json' };

      const reqBody = {
        system_instruction: { parts: [{ text: this.systemInstruction }] },
        contents: [...contextHistory],
        generationConfig: { temperature: 0.2 }
      };

      if (imageUrl) {
        const base64Data = imageUrl.split(',')[1];
        const mimeType = imageUrl.split(';')[0].split(':')[1];
        const parts = [];
        if (text) parts.push({ text: text });
        parts.push({
          inline_data: { mime_type: mimeType, data: base64Data }
        });
        reqBody.contents.push({ role: 'user', parts: parts });
      } else {
        reqBody.contents.push({ role: 'user', parts: [{ text: text }] });
      }

      // Add thinking bubble
      const thinkingId = 'think-' + Date.now();
      const thinkingDiv = document.createElement('div');
      thinkingDiv.id = thinkingId;
      thinkingDiv.className = 'ai-bubble ai';
      thinkingDiv.textContent = 'Đang suy nghĩ...';
      this.historyDiv.appendChild(thinkingDiv);
      this.scrollToBottom();

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(reqBody)
        });
        
        const data = await response.json();
        document.getElementById(thinkingId)?.remove();

        if (data.error) {
          this.addBubble('ai', 'Lỗi API: ' + (data.error?.message || JSON.stringify(data.error)));
        } else if (data.candidates && data.candidates[0].content) {
          this.addBubble('ai', data.candidates[0].content.parts[0].text);
        } else {
          this.addBubble('ai', 'Không nhận được dữ liệu phản hồi hợp lệ.');
        }
      } catch (e) {
        document.getElementById(thinkingId)?.remove();
        this.addBubble('ai', 'Lỗi kết nối mạng: ' + e.message);
      }
    } catch(err) {
      alert("Lỗi phần mềm: " + err.message);
    }
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => AIAssistant.init());
} else {
  AIAssistant.init();
}
