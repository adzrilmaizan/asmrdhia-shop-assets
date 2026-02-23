const APP = {
    config: { worker: "https://shopapi.asmrdhia.com", currency: "RM" },
    data: { items: [], coupons: [], settings: {} },
    state: { 
        isEditing: false, 
        editId: null, 
        isProcessing: false, 
        currentVariations: [],
        intervals: { global: null, preview: null } // 4. TAMBAH INTERVAL CLEANUP
    },

    // ==========================================
    // 0. CORE REQUEST & AUTH
    // ==========================================
    async request(method, bodyData = null, customAction = null) {
        const options = { method: method, headers: { 'Content-Type': 'application/json' } };
        
        // SELITKAN ADMIN TOKEN UNTUK SEMUA POST REQUEST
        if (bodyData) {
            bodyData.admin_token = localStorage.getItem("admin_secret_token") || "";
            options.body = JSON.stringify(bodyData);
        }
        
        let url = this.config.worker;
        if (method === 'GET' && customAction) url += `?action=${customAction}&_t=${Date.now()}`;
        else if (method === 'GET') url += `?action=get_menu_data&_t=${Date.now()}`;
        
        const res = await fetch(url, options);
        return await res.json();
    },

    // ==========================================
    // 1. INIT & LOAD DATA
    // ==========================================
    init: async function() {
        this.cacheDOM();
        this.bindEvents();
        await this.loadData();
        this.startGlobalCountdowns();
    },

    cacheDOM: function() {
        this.dom = {
            list: document.getElementById('produk-list'),
            form: document.getElementById('produk-form'),
            modal: document.getElementById('produk-modal'),
            btnSave: document.getElementById('btn-save'),
            search: document.getElementById('search-input'),
            statTotal: document.getElementById('stat-total'),
            statActive: document.getElementById('stat-active'),
            statDraft: document.getElementById('stat-draft')
        };
    },

    bindEvents: function() {
        if(this.dom.search) this.dom.search.addEventListener('input', (e) => this.renderList(e.target.value));
        
        const btnAddVar = document.getElementById('btn-add-var');
        if(btnAddVar) btnAddVar.addEventListener('click', () => {
            this.state.currentVariations.push({ label: '', price_add: 0, stock: -1, image: '' });
            this.renderVariationForm();
        });
        
        const isDigitalCheck = document.getElementById('p-is-digital');
        if(isDigitalCheck) isDigitalCheck.addEventListener('change', (e) => {
            const box = document.getElementById('digital-access-box');
            if(e.target.checked) box.classList.remove('hidden');
            else { box.classList.add('hidden'); document.getElementById('p-access-link').value = ''; }
        });

        // 5. EVENT LISTENER UNTUK TOGGLE COUNTDOWN
        const isCountdownCheck = document.getElementById('p-is-countdown');
        if(isCountdownCheck) isCountdownCheck.addEventListener('change', (e) => {
            this.toggleCountdown(e.target.checked);
        });
    },

    loadData: async function() {
        try {
            this.dom.list.innerHTML = `<div class="col-span-full py-12 text-center text-slate-400"><i class="ri-loader-4-line text-4xl animate-spin text-blue-500 mb-2"></i><p>Memuatkan katalog & data...</p></div>`;
            
            const [resItems, resCoupons, resSettings] = await Promise.all([
                this.request('GET'),
                this.request('GET', null, 'get_coupons'),
                this.request('GET', null, 'get_shop_settings')
            ]);
            
            if (resItems.status === 'success') this.data.items = resItems.menus || [];
            if (resCoupons.status === 'success') this.data.coupons = resCoupons.coupons || [];
            
            if (resSettings.status === 'success') {
                this.data.settings = resSettings.data || {};
                this.populatePointSettings(); // 3. PANGGIL FUNCTION POPULATE POINT
            }
            
            this.updateStats();
            this.renderList();
            this.renderCoupons();
        } catch (e) {
            this.dom.list.innerHTML = `<div class="col-span-full py-12 text-center text-rose-500"><i class="ri-error-warning-line text-4xl mb-2"></i><p>${e.message}</p></div>`;
        }
    },

    // ==========================================
    // 2. DATA PARSING & UTILS
    // ==========================================
    safeJSONParse: function(str, fallback) {
        if (!str) return fallback;
        try { return JSON.parse(str); } catch(e) { return fallback; }
    },

    parseData: function(desc) {
        let cleanDesc = desc || '';
        let config = { s: -1, type: 'MANUAL', media: [] };
        const m = cleanDesc.match(/\[CONFIG:([\s\S]*?)\]\[\/CONFIG\]/);
        if (m && m[1]) {
            const parsed = this.safeJSONParse(m[1], {});
            config = { ...config, ...parsed };
            cleanDesc = cleanDesc.replace(m[0], '').trim();
        }
        return { cleanDesc, config };
    },

    calcTotalStock: function(item) {
        const { config } = this.parseData(item.description);
        const vars = this.safeJSONParse(item.variations, []);
        
        if (!vars || vars.length === 0 || config.type === 'MANUAL') {
            return parseInt(config.s) || -1;
        }
        
        let total = 0; let unli = false;
        vars.forEach(v => {
            if(parseInt(v.stock) === -1) unli = true;
            else total += parseInt(v.stock || 0);
        });
        return unli ? -1 : total;
    },

    // ==========================================
    // 3. MEDIA HANDLING (YOUTUBE & IMAGES)
    // ==========================================
    isYouTube: function(url) { 
        return url && (url.includes('youtube.com') || url.includes('youtu.be')); 
    },
    
    getYouTubeId: function(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    },

    // ==========================================
    // 4. COUNTDOWN / LOCK FEATURE
    // ==========================================
    isProductLocked: function(liveDateStr) {
        if(!liveDateStr) return false;
        const liveDate = new Date(liveDateStr).getTime();
        return liveDate > new Date().getTime();
    },

    // 5. FUNCTION TOGGLE COUNTDOWN DATE BOX
    toggleCountdown: function(show) {
        const box = document.getElementById('countdown-date-box'); // Pastikan UI ada div ID ni
        const dateInput = document.getElementById('p-live-date');
        if(box) {
            if(show) box.classList.remove('hidden');
            else { 
                box.classList.add('hidden'); 
                if(dateInput) dateInput.value = ''; 
            }
        }
    },

    startGlobalCountdowns: function() {
        // 4. CHECK & CLEAR INTERVAL SEBELUM SET
        if (this.state.intervals.global) clearInterval(this.state.intervals.global);
        
        this.state.intervals.global = setInterval(() => { this.updateCountdownDisplay(); }, 1000);
    },

    updateCountdownDisplay: function() {
        document.querySelectorAll('.countdown-timer').forEach(el => {
            const target = parseInt(el.getAttribute('data-target'));
            const now = new Date().getTime();
            const diff = target - now;
            
            if(diff <= 0) {
                el.innerHTML = "LIVE NOW";
                el.classList.remove('countdown-timer', 'text-rose-500');
                el.classList.add('text-emerald-500');
                const lockOverlay = el.closest('.product-card')?.querySelector('.lock-overlay');
                if(lockOverlay) lockOverlay.style.display = 'none';
            } else {
                const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((diff % (1000 * 60)) / 1000);
                
                // 1. UPDATE COUNTDOWN FORMAT
                el.innerHTML = `<i class="ri-timer-flash-line mr-1"></i> Buka: ${d}h ${h}j ${m}m ${s}s`;
            }
        });
    },

    // ==========================================
    // 5. RENDER LIST & STATS
    // ==========================================
    updateStats: function() {
        if(!this.dom.statTotal) return;
        const total = this.data.items.length;
        const active = this.data.items.filter(i => i.status === 'ACTIVE').length;
        this.dom.statTotal.innerText = total;
        this.dom.statActive.innerText = active;
        this.dom.statDraft.innerText = total - active;
    },

    renderList: function(searchQuery = '') {
        let filtered = this.data.items;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(i => (i.name||'').toLowerCase().includes(q) || (i.category||'').toLowerCase().includes(q));
        }

        if (filtered.length === 0) {
            this.dom.list.innerHTML = `<div class="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200"><i class="ri-inbox-2-line text-5xl text-slate-300 mb-3"></i><p class="text-slate-500 font-medium">Tiada produk dijumpai</p></div>`;
            return;
        }

        this.dom.list.innerHTML = filtered.map(item => {
            const isDigital = item.is_digital == 1;
            const stockVal = this.calcTotalStock(item);
            const hasStock = stockVal > 0 || stockVal === -1;
            const isLocked = this.isProductLocked(item.live_date);
            const lockTime = item.live_date ? new Date(item.live_date).getTime() : 0;
            
            let thumbHtml = '';
            if (this.isYouTube(item.image)) {
                const ytId = this.getYouTubeId(item.image);
                thumbHtml = `<img src="https://img.youtube.com/vi/${ytId}/hqdefault.jpg" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" /><div class="absolute inset-0 flex items-center justify-center"><i class="ri-play-circle-fill text-4xl text-white drop-shadow-md"></i></div>`;
            } else if (item.image) {
                thumbHtml = `<img src="${item.image}" alt="${item.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />`;
            } else {
                thumbHtml = `<div class="w-full h-full flex items-center justify-center text-slate-400"><i class="ri-image-line text-4xl"></i></div>`;
            }
            
            return `
            <div class="product-card bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow group flex flex-col h-full relative">
                ${isLocked ? `<div class="lock-overlay absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-20 flex flex-col items-center justify-center text-white"><i class="ri-lock-2-fill text-4xl mb-2"></i><span class="countdown-timer font-bold text-sm bg-rose-500 px-3 py-1 rounded-full" data-target="${lockTime}">Loading...</span></div>` : ''}
                
                <div class="h-48 overflow-hidden relative bg-slate-100 shrink-0">
                    ${thumbHtml}
                    <div class="absolute top-3 left-3 flex flex-col gap-1.5 items-start z-10">
                        <span class="bg-white/90 backdrop-blur text-slate-700 text-[10px] font-black uppercase px-2 py-1 rounded shadow-sm border border-slate-200">${item.category || 'Uncategorized'}</span>
                        ${isDigital ? `<span class="bg-purple-500 text-white text-[10px] font-black uppercase px-2 py-1 rounded shadow-sm flex items-center gap-1"><i class="ri-code-s-slash-line"></i> DIGITAL</span>` : ''}
                        ${!hasStock ? `<span class="bg-rose-500 text-white text-[10px] font-black uppercase px-2 py-1 rounded shadow-sm">HABIS STOK</span>` : ''}
                    </div>
                </div>
                <div class="p-5 flex-1 flex flex-col">
                    <h3 class="font-bold text-slate-800 text-lg mb-1 leading-tight line-clamp-2">${item.name}</h3>
                    <div class="text-2xl font-black text-blue-600 mb-4 mt-auto flex items-end gap-2">
                        <span><span class="text-sm text-blue-400 font-bold">${this.config.currency}</span>${parseFloat(item.price).toFixed(2)}</span>
                        ${item.discount_price > 0 ? `<span class="text-sm line-through text-slate-400 mb-1">RM${parseFloat(item.discount_price).toFixed(2)}</span>` : ''}
                    </div>
                    <div class="flex items-center gap-2 mt-auto relative z-30">
                        <button onclick="APP.editItem('${item.id}')" class="flex-1 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 font-bold py-2.5 rounded-xl transition-colors text-sm border border-slate-200 hover:border-blue-200"><i class="ri-pencil-line mr-1"></i> Edit</button>
                        <button onclick="APP.openPreview('${item.id}')" class="w-11 h-11 flex items-center justify-center bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-xl transition-colors border border-slate-200 hover:border-indigo-200"><i class="ri-eye-line text-lg"></i></button>
                        <button onclick="APP.deleteItem('${item.id}')" class="w-11 h-11 flex items-center justify-center bg-rose-50 hover:bg-rose-500 text-rose-500 hover:text-white rounded-xl transition-colors border border-rose-100 hover:border-rose-500"><i class="ri-delete-bin-line text-lg"></i></button>
                    </div>
                </div>
            </div>`;
        }).join('');
    },

    // ==========================================
    // 6. FORM & VARIATION HANDLING
    // ==========================================
    renderVariationForm: function() {
        const container = document.getElementById('var-list-container');
        if (!container) return;

        if (this.state.currentVariations.length === 0) {
            container.innerHTML = `<div class="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl text-slate-400"><i class="ri-price-tag-3-line text-2xl mb-1"></i><p class="text-xs font-medium">Tiada variasi. Menggunakan harga & stok utama.</p></div>`;
            return;
        }

        container.innerHTML = this.state.currentVariations.map((v, index) => `
            <div class="bg-slate-50 border border-slate-200 p-4 rounded-xl relative group">
                <button type="button" onclick="APP.removeVariation(${index})" class="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"><i class="ri-close-line text-xs"></i></button>
                <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Label</label>
                        <input type="text" class="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500" value="${v.label}" onchange="APP.updateVar(${index}, 'label', this.value)" placeholder="Cth: Merah" />
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">+ Harga (RM)</label>
                        <input type="number" step="0.01" class="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500" value="${v.price_add}" onchange="APP.updateVar(${index}, 'price_add', this.value)" placeholder="0.00" />
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Stok (-1 Unli)</label>
                        <input type="number" class="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500" value="${v.stock}" onchange="APP.updateVar(${index}, 'stock', this.value)" placeholder="-1" />
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">URL Gambar (Pilihan)</label>
                        <input type="text" class="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500" value="${v.image || ''}" onchange="APP.updateVar(${index}, 'image', this.value)" placeholder="https://..." />
                    </div>
                </div>
            </div>
        `).join('');
    },

    updateVar: function(index, field, value) {
        if(field === 'price_add') this.state.currentVariations[index][field] = parseFloat(value) || 0;
        else if(field === 'stock') this.state.currentVariations[index][field] = parseInt(value) || -1;
        else this.state.currentVariations[index][field] = value;
    },

    removeVariation: function(index) {
        this.state.currentVariations.splice(index, 1);
        this.renderVariationForm();
    },

    openModal: function(isEdit = false) {
        this.state.isEditing = isEdit;
        document.getElementById('modal-title').innerText = isEdit ? 'Kemaskini Produk' : 'Tambah Produk Baru';
        this.dom.modal.classList.remove('hidden');
        this.dom.modal.classList.add('flex');
    },

    closeModal: function() {
        this.dom.modal.classList.add('hidden');
        this.dom.modal.classList.remove('flex');
        this.resetForm();
    },

    resetForm: function() {
        this.dom.form.reset();
        this.state.isEditing = false;
        this.state.editId = null;
        this.state.currentVariations = [];
        this.toggleCountdown(false); // Reset countdown view
        const digiBox = document.getElementById('digital-access-box');
        if(digiBox) digiBox.classList.add('hidden');
        this.renderVariationForm();
    },

    addNew: function() {
        this.resetForm();
        this.openModal(false);
    },

    editItem: function(id) {
        const item = this.data.items.find(i => i.id === id);
        if (!item) return;

        this.resetForm();
        this.state.editId = id;
        
        document.getElementById('p-name').value = item.name;
        document.getElementById('p-price').value = item.price;
        document.getElementById('p-cat').value = item.category;
        document.getElementById('p-img').value = item.image || '';
        document.getElementById('p-disc').value = item.discount_price || 0;
        document.getElementById('p-weight').value = item.weight_kg || 0.5;
        
        const isCountdown = item.is_countdown == 1;
        document.getElementById('p-is-countdown').checked = isCountdown;
        this.toggleCountdown(isCountdown); // Toggle UI accordingly
        
        document.getElementById('p-live-date').value = item.live_date || '';
        document.getElementById('p-is-free-shipping').checked = item.is_free_shipping == 1;
        
        if(item.is_digital == 1) {
            document.getElementById('p-is-digital').checked = true;
            document.getElementById('digital-access-box').classList.remove('hidden');
            let meta = {}; try { meta = typeof item.meta_data === 'string' ? JSON.parse(item.meta_data) : item.meta_data; } catch(e){}
            document.getElementById('p-access-link').value = meta.access_link || '';
        }

        const { cleanDesc, config } = this.parseData(item.description);
        document.getElementById('p-desc').value = cleanDesc;
        document.getElementById('p-stock').value = config.s;
        
        const extraMediaStr = (config.media && config.media.length > 0) ? config.media.join(', ') : '';
        if(document.getElementById('p-extra-media')) document.getElementById('p-extra-media').value = extraMediaStr;

        this.state.currentVariations = item.variations ? JSON.parse(JSON.stringify(item.variations)) : [];
        this.renderVariationForm();
        
        this.openModal(true);
    },

    saveProduct: async function() {
        if(this.state.isProcessing) return;
        
        const name = document.getElementById('p-name').value.trim();
        const price = document.getElementById('p-price').value;
        const cat = document.getElementById('p-cat').value.trim();
        
        if(!name || !price || !cat) {
            Swal.fire('Tidak Lengkap', 'Sila isi Nama, Harga, dan Kategori.', 'warning');
            return;
        }

        // 6. VALIDATION UNTUK LIVE_DATE
        const isCountdownBox = document.getElementById('p-is-countdown');
        const isCountdown = isCountdownBox ? isCountdownBox.checked : false;
        const liveDateInput = document.getElementById('p-live-date');
        const liveDate = liveDateInput ? liveDateInput.value : '';

        if (isCountdown && !liveDate) {
            Swal.fire('Tarikh Wajib', 'Sila tetapkan tarikh & masa untuk fungsi Countdown diaktifkan.', 'warning');
            return;
        }

        const isDigital = document.getElementById('p-is-digital').checked ? 1 : 0;
        const accessLink = document.getElementById('p-access-link').value.trim();
        
        if (isDigital && !accessLink) {
            Swal.fire('Pautan Wajib', 'Untuk produk digital, pautan akses fail wajib diisi.', 'warning');
            return;
        }

        const id = this.state.isEditing ? this.state.editId : 'P' + Date.now();
        const stockInput = document.getElementById('p-stock').value;
        
        const mediaInput = document.getElementById('p-extra-media') ? document.getElementById('p-extra-media').value : '';
        const mediaArr = mediaInput.split(',').map(s=>s.trim()).filter(s=>s!=='');
        
        const confObj = { s: parseInt(stockInput) || -1, type: 'MANUAL', media: mediaArr };
        const confStr = `[CONFIG:${JSON.stringify(confObj)}][/CONFIG]`;
        const finalDesc = document.getElementById('p-desc').value.trim() + '\n' + confStr;

        const payload = {
            action: 'save_menu_item',
            id: id,
            name: name,
            price: price,
            cat: cat,
            img: document.getElementById('p-img').value.trim(),
            description: finalDesc,
            discount_price: document.getElementById('p-disc').value || 0,
            weight_kg: document.getElementById('p-weight').value || 0.5,
            live_date: liveDate || null,
            is_countdown: isCountdown ? 1 : 0,
            is_free_shipping: document.getElementById('p-is-free-shipping').checked ? 1 : 0,
            is_digital: isDigital,
            access_link: accessLink,
            variations: JSON.stringify(this.state.currentVariations)
        };

        try {
            this.state.isProcessing = true;
            this.dom.btnSave.innerHTML = '<i class="ri-loader-4-line animate-spin mr-1"></i> Menyimpan...';
            
            const res = await this.request('POST', payload);
            if(res.status === 'success') {
                await Swal.fire({ icon: 'success', title: 'Tersimpan!', text: 'Katalog telah dikemaskini.', timer: 1500, showConfirmButton: false });
                this.closeModal();
                await this.loadData();
            } else throw new Error(res.msg);
        } catch(e) { Swal.fire('Ralat', e.message, 'error'); } 
        finally { this.state.isProcessing = false; this.dom.btnSave.innerHTML = 'Simpan Produk'; }
    },

    deleteItem: async function(id) {
        const { isConfirmed } = await Swal.fire({
            title: 'Padam Produk?', text: "Tindakan ini tidak boleh dikembalikan.", icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Ya, Padam', cancelButtonText: 'Batal'
        });

        if (isConfirmed) {
            Swal.fire({ title: 'Memadam...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
            try {
                const res = await this.request('POST', { action: 'delete_menu_item', id: id });
                if(res.status === 'success') {
                    await Swal.fire({ icon: 'success', title: 'Terpadam', timer: 1500, showConfirmButton: false });
                    await this.loadData();
                } else throw new Error(res.msg);
            } catch(e) { Swal.fire('Ralat', e.message, 'error'); }
        }
    },

    // ==========================================
    // 7. PREVIEW MODAL DYNAMIC
    // ==========================================
    openPreview: function(id) {
        const item = this.data.items.find(i => i.id === id);
        if(!item) return;

        let previewHTML = `
        <div id="preview-modal" class="fixed inset-0 bg-slate-900/80 backdrop-blur flex items-center justify-center z-[100] p-4 animate-fade-in" onclick="if(event.target===this) APP.closePreview(this)">
            <div class="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
                <button onclick="APP.closePreview(document.getElementById('preview-modal'))" class="absolute top-4 right-4 z-50 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur hover:bg-rose-500 transition"><i class="ri-close-line text-lg"></i></button>
                
                <div class="relative w-full h-64 bg-slate-100 shrink-0">
                    ${this.renderPreviewMedia(item)}
                    ${item.is_free_shipping == 1 ? `<div class="absolute top-4 left-4 bg-emerald-500 text-white text-[10px] font-black px-2 py-1 rounded shadow shadow-emerald-500/30 uppercase tracking-widest flex items-center gap-1"><i class="ri-truck-fill"></i> FREE POS</div>` : ''}
                    ${item.discount_price > 0 ? `<div class="absolute top-12 left-4 bg-rose-500 text-white text-[10px] font-black px-2 py-1 rounded shadow shadow-rose-500/30 uppercase tracking-widest">SALE</div>` : ''}
                </div>
                
                <div class="p-6 overflow-y-auto custom-scroll flex-1">
                    <div class="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">${item.category}</div>
                    <h2 class="text-xl font-black text-slate-800 leading-tight mb-2">${item.name}</h2>
                    <div class="flex items-end gap-2 mb-4">
                        <span class="text-2xl font-black text-emerald-600">RM${parseFloat(item.price).toFixed(2)}</span>
                        ${item.discount_price > 0 ? `<span class="text-sm line-through text-slate-400 mb-1">RM${parseFloat(item.discount_price).toFixed(2)}</span>` : ''}
                    </div>
                    
                    <div class="bg-slate-50 p-4 rounded-xl text-sm text-slate-600 whitespace-pre-line leading-relaxed mb-4 border border-slate-100">
                        ${this.parseData(item.description).cleanDesc}
                    </div>
                    
                    <div class="grid grid-cols-2 gap-3">
                        <div class="bg-blue-50 p-3 rounded-xl border border-blue-100 text-center"><div class="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Stok</div><div class="font-black text-blue-700">${this.calcTotalStock(item) === -1 ? 'Unlimited' : this.calcTotalStock(item)}</div></div>
                        <div class="bg-indigo-50 p-3 rounded-xl border border-indigo-100 text-center"><div class="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Berat</div><div class="font-black text-indigo-700">${item.weight_kg} kg</div></div>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', previewHTML);
    },

    // 4. INTERVAL CLEANUP UNTUK PREVIEW
    closePreview: function(modalEl) {
        if (this.state.intervals.preview) {
            clearInterval(this.state.intervals.preview);
            this.state.intervals.preview = null;
        }
        if (modalEl) modalEl.remove();
    },

    renderPreviewMedia: function(item) {
        const { config } = this.parseData(item.description);
        let mediaArr = [];
        if (item.image) mediaArr.push(item.image);
        if (config.media && config.media.length > 0) mediaArr = mediaArr.concat(config.media);
        
        // 2. ELAK DUPLICATE MEDIA URL
        mediaArr = [...new Set(mediaArr)];
        
        if (mediaArr.length === 0) return `<div class="w-full h-full flex items-center justify-center text-slate-300"><i class="ri-image-line text-5xl"></i></div>`;
        
        let html = `<div class="flex overflow-x-auto snap-x snap-mandatory w-full h-full custom-scroll-x scroll-smooth">`;
        mediaArr.forEach(url => {
            if(this.isYouTube(url)) {
                const ytId = this.getYouTubeId(url);
                html += `<div class="w-full h-full shrink-0 snap-center relative"><iframe src="https://www.youtube.com/embed/${ytId}?rel=0" class="w-full h-full" frameborder="0" allowfullscreen></iframe></div>`;
            } else {
                html += `<div class="w-full h-full shrink-0 snap-center"><img src="${url}" class="w-full h-full object-cover" /></div>`;
            }
        });
        html += `</div>`;
        if(mediaArr.length > 1) html += `<div class="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-[9px] px-2 py-1 rounded-full backdrop-blur font-bold tracking-widest pointer-events-none">SLIDE <i class="ri-arrow-right-line"></i></div>`;
        return html;
    },

    // ==========================================
    // 8. COUPON SYSTEM MODULE
    // ==========================================
    renderCoupons: function() {
        const list = document.getElementById('coupon-list');
        if(!list) return;

        if(this.data.coupons.length === 0) {
            list.innerHTML = `<div class="p-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50"><i class="ri-coupon-3-line text-3xl mb-2"></i><p class="text-sm font-medium">Tiada kupon aktif.</p></div>`;
            return;
        }

        list.innerHTML = this.data.coupons.map(c => `
            <div class="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm group hover:border-emerald-200 transition">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center font-black text-lg border border-emerald-100">%</div>
                    <div>
                        <div class="font-black text-slate-800 text-lg uppercase tracking-wide">${c.code}</div>
                        <div class="text-xs text-slate-500 font-medium">Potongan RM${parseFloat(c.val).toFixed(2)} • Limit: ${parseInt(c.max_limit)===0 ? 'Tiada Had' : c.max_limit} • Guna: <span class="text-emerald-600 font-bold">${c.used_count || 0}</span></div>
                    </div>
                </div>
                <button onclick="APP.deleteCoupon('${c.code}')" class="w-10 h-10 flex items-center justify-center bg-rose-50 text-rose-500 rounded-lg opacity-0 group-hover:opacity-100 transition hover:bg-rose-500 hover:text-white" title="Padam Kupon"><i class="ri-delete-bin-line text-lg"></i></button>
            </div>
        `).join('');
    },

    addCoupon: async function() {
        const code = document.getElementById('cpn-code').value.trim().toUpperCase();
        const val = document.getElementById('cpn-val').value;
        const target = 'ALL';
        const limit = document.getElementById('cpn-limit').value || 0;

        if(!code || !val) { Swal.fire('Tidak Lengkap', 'Kod Kupon dan Nilai Potongan wajib diisi.', 'warning'); return; }

        const payload = { action: 'add_coupon', code, val, target, limit };
        const btn = document.getElementById('btn-add-cpn');
        const ogHTML = btn.innerHTML;
        btn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i>';
        btn.disabled = true;

        try {
            const res = await this.request('POST', payload);
            if(res.status === 'success') {
                document.getElementById('cpn-code').value = '';
                document.getElementById('cpn-val').value = '';
                document.getElementById('cpn-limit').value = '';
                await this.loadData();
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Kupon ditambah!', showConfirmButton: false, timer: 1500 });
            } else throw new Error(res.msg);
        } catch(e) { Swal.fire('Ralat', e.message, 'error'); }
        finally { btn.innerHTML = ogHTML; btn.disabled = false; }
    },

    deleteCoupon: async function(code) {
        const { isConfirmed } = await Swal.fire({ title: `Padam kupon ${code}?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'Ya, Padam' });
        if(isConfirmed) {
            Swal.fire({ title: 'Memadam...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
            try {
                const res = await this.request('POST', { action: 'delete_coupon', code: code });
                if(res.status === 'success') { await this.loadData(); Swal.close(); } 
                else throw new Error(res.msg);
            } catch(e) { Swal.fire('Ralat', e.message, 'error'); }
        }
    },

    // ==========================================
    // 9. POINTS / SHOP SETTINGS
    // ==========================================
    
    // 3. FUNCTION UNTUK POPULATE POINT SETTINGS
    populatePointSettings: function() {
        const keys = ['pt_reward_star', 'pt_reward_comment', 'pt_reward_long', 'pt_redeem_value'];
        keys.forEach(k => { 
            const el = document.getElementById(k);
            if (el && this.data.settings[k] !== undefined) {
                el.value = this.data.settings[k];
            }
        });
    },

    savePointSettings: async function() {
        const payload = { action: 'save_shop_settings' };
        const keys = ['pt_reward_star', 'pt_reward_comment', 'pt_reward_long', 'pt_redeem_value'];
        
        let hasData = false;
        keys.forEach(k => { 
            const el = document.getElementById(k);
            if (el) { payload[k] = el.value; hasData = true; }
        });

        if(!hasData) return;

        const btn = document.getElementById('btn-save-pts');
        if(btn) { btn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i>'; btn.disabled = true; }

        try {
            const res = await this.request('POST', payload);
            if (res.status === 'success') Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Sistem Point Disimpan!', showConfirmButton: false, timer: 1500 });
            else throw new Error(res.msg);
        } catch(e) { Swal.fire('Ralat', e.message, 'error'); } 
        finally { if(btn) { btn.innerHTML = 'Simpan Tetapan Points'; btn.disabled = false; } }
    }
};

window.onload = () => APP.init();
