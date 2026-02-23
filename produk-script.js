const ASMRDHIA_APP = {
    config: { worker: "https://shopapi.asmrdhia.com", masterPass: "Adzril2!" }, // <-- Kunci diletakkan di sini
    state: { products: [], coupons: [], settings: {} },
    intervals: { global: null, preview: null },

    async request(method, bodyData = null, customAction = null) {
        const options = { method: method, headers: { 'Content-Type': 'application/json' } };
        if (bodyData) options.body = JSON.stringify(bodyData);
        let url = this.config.worker;
        if (method === 'GET' && customAction) url += `?action=${customAction}&_t=${Date.now()}`;
        else if (method === 'GET') url += `?action=get_menu_data&_t=${Date.now()}`;
        const res = await fetch(url, options);
        return await res.json();
    },

    safeJSONParse(data) { 
        if (!data) return []; 
        if (typeof data === 'object') return data; 
        try { return JSON.parse(data); } 
        catch(e) { return []; } 
    },
    
    parseData(text) {
        let data = { discount: 0, isCountdown: 0, liveDate: '', stock: 0, isActive: 1, cleanDesc: text || '' };
        if (!text) return data;
        const m = text.match(/\[CONFIG:(.*?)\]\[\/CONFIG\]/);
        if (m && m[1]) {
            try {
                const c = JSON.parse(m[1]);
                data.discount = parseFloat(c.d) || 0; 
                data.isCountdown = c.c || 0; 
                data.liveDate = c.t || '';
                data.stock = c.s !== undefined ? parseInt(c.s) : 0; 
                data.isActive = c.a !== undefined ? parseInt(c.a) : 1;
            } catch (e) {}
            data.cleanDesc = text.replace(m[0], '').trim();
        }
        return data;
    },

    parseMedia(imgData) {
        if (!imgData || imgData.length < 5) return [];
        try {
            const parsed = JSON.parse(imgData);
            if (Array.isArray(parsed)) return parsed;
            return [imgData];
        } catch(e) {
            return [imgData];
        }
    },

    getYoutubeThumbnail(url) {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? `https://img.youtube.com/vi/${match[2]}/hqdefault.jpg` : null;
    },

    getEmbedUrl(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}?autoplay=1` : null;
    },

    async init() {
        try {
            const [resProd, resCoup, resSet] = await Promise.all([
                this.request('GET'),
                this.request('GET', null, 'get_coupons'),
                this.request('GET', null, 'get_shop_settings')
            ]);
            this.state.products = resProd.menus || [];
            this.state.coupons = resCoup.coupons || [];
            this.state.settings = resSet.data || {};

            this.renderProductGrid();
            this.renderCoupons();
            this.populateProductDropdown();
            this.populatePointSettings();
            this.startGlobalCountdowns();
        } catch (e) {
            Swal.fire('Ralat', 'Gagal memuatkan data dari server', 'error');
        }
    },

    populatePointSettings() {
        document.getElementById('set-pt-star').value = this.state.settings.pt_reward_star || 1;
        document.getElementById('set-pt-comm').value = this.state.settings.pt_reward_comment || 5;
        document.getElementById('set-pt-long').value = this.state.settings.pt_reward_long || 10;
        document.getElementById('set-pt-rate').value = this.state.settings.pt_redeem_value || 0.10;
    },

    async savePointSettings() {
        const btn = document.getElementById('btn-save-pts');
        const og = btn.innerHTML;
        btn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i> Menyimpan...';
        btn.disabled = true;

        const payload = {
            action: 'save_shop_settings',
            admin_token: this.config.masterPass, // <-- KUNCI GHAIB
            pt_reward_star: document.getElementById('set-pt-star').value,
            pt_reward_comment: document.getElementById('set-pt-comm').value,
            pt_reward_long: document.getElementById('set-pt-long').value,
            pt_redeem_value: document.getElementById('set-pt-rate').value
        };

        try {
            const res = await this.request('POST', payload);
            if(res.status === 'success') {
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Tetapan Points disimpan!', showConfirmButton: false, timer: 1500 });
            } else throw new Error(res.msg);
        } catch(e) {
            Swal.fire('Ralat', e.message, 'error');
        } finally {
            btn.innerHTML = og;
            btn.disabled = false;
        }
    },

    isProductLocked(liveDate) {
        if (!liveDate) return false;
        return new Date(liveDate) > new Date();
    },

    updateCountdownDisplay(elementId, targetDate) {
        const element = document.getElementById(elementId);
        if (!element) return false;
        
        const diff = new Date(targetDate) - new Date();
        
        if (diff <= 0) { 
            element.innerHTML = '<div class="text-xs font-bold text-emerald-400 bg-black/50 px-3 py-1.5 rounded-lg border border-emerald-500/30">TELAH DIBUKA!</div>'; 
            const overlay = element.closest('.lock-overlay-container');
            if (overlay) {
                overlay.style.display = 'none';
            }
            return false; 
        }
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        element.innerHTML = `
            <div class="countdown-segment"><span class="countdown-value">${days.toString().padStart(2, '0')}</span><span class="countdown-label">Hari</span></div>
            <div class="countdown-segment"><span class="countdown-value">${hours.toString().padStart(2, '0')}</span><span class="countdown-label">Jam</span></div>
            <div class="countdown-segment"><span class="countdown-value">${minutes.toString().padStart(2, '0')}</span><span class="countdown-label">Min</span></div>
            <div class="countdown-segment"><span class="countdown-value">${seconds.toString().padStart(2, '0')}</span><span class="countdown-label">Sa</span></div>
        `;
        return true;
    },

    updateTableCountdowns() {
        this.state.products.forEach(p => {
            const meta = this.parseData(p.description);
            if (meta.isCountdown == 1 && meta.liveDate) {
                const isLocked = this.isProductLocked(meta.liveDate);
                if (isLocked) { this.updateCountdownDisplay(`grid-cd-${p.id}`, meta.liveDate); }
            }
        });
    },

    startGlobalCountdowns() {
        if (this.intervals.global) clearInterval(this.intervals.global);
        this.intervals.global = setInterval(() => { this.updateTableCountdowns(); }, 1000);
    },

    populateProductDropdown() {
        const select = document.getElementById('new_coupon_target');
        if (!select) return;
        select.innerHTML = '<option value="ALL">🎯 Semua Produk (Global)</option>';
        if (this.state.products.length > 0) {
            this.state.products.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id; 
                opt.innerText = `📦 ${p.name.substring(0, 30)}... (RM${p.price})`;
                select.appendChild(opt);
            });
        }
    },

    renderCoupons() {
        const list = document.getElementById('coupon-list');
        if (!list) return;
        
        document.getElementById('coupon-count').innerText = this.state.coupons.length;
        list.innerHTML = '';

        if (this.state.coupons.length === 0) {
            list.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-400 font-medium bg-white">Tiada kupon aktif dikesan.</td></tr>';
            return;
        }

        this.state.coupons.forEach(c => {
            let targetName = '<span class="bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs font-bold">GLOBAL</span>';
            if (c.target !== 'ALL') {
                const prod = this.state.products.find(p => p.id === c.target);
                targetName = prod ? `<span class="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium truncate max-w-[150px] inline-block" title="${prod.name}">${prod.name}</span>` : `<span class="text-red-500 text-xs">Produk Dibuang</span>`;
            }

            let limitHtml = '<span class="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded-md">Unlimited</span>';
            if (c.max_limit && parseInt(c.max_limit) > 0) {
                let used = parseInt(c.used_count) || 0;
                let max = parseInt(c.max_limit);
                if (used >= max) {
                    limitHtml = `<span class="bg-red-100 text-red-600 px-2 py-1 rounded-md text-[10px] font-bold tracking-wider">HABIS (${used}/${max})</span>`;
                } else {
                    limitHtml = `<span class="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">${used} / ${max}</span>`;
                }
            } else if (c.used_count && parseInt(c.used_count) > 0) {
                 limitHtml = `<span class="text-xs text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded-md">Diguna: ${c.used_count}</span>`;
            }

            list.innerHTML += `
                <tr>
                    <td><div class="font-mono font-bold text-gray-900">${c.code}</div></td>
                    <td><span class="font-bold text-emerald-600">RM ${parseFloat(c.val).toFixed(2)}</span></td>
                    <td>${targetName}</td>
                    <td>${limitHtml}</td>
                    <td class="text-right">
                        <button onclick="ASMRDHIA_APP.deleteCoupon('${c.code}')" class="text-gray-400 hover:text-red-500 transition" title="Padam">
                            <i class="ri-delete-bin-line text-lg"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
    },

    async addCoupon() {
        const btn = document.getElementById('btn-add-coupon');
        const code = document.getElementById('new_coupon_code').value.toUpperCase().trim();
        const val = parseFloat(document.getElementById('new_coupon_val').value);
        const limitStr = document.getElementById('new_coupon_limit').value;
        const target = document.getElementById('new_coupon_target').value;

        if (!code) return Swal.fire('Gagal', 'Sila masukkan Kod Kupon', 'warning');
        if (isNaN(val) || val <= 0) return Swal.fire('Gagal', 'Nilai potongan tidak sah', 'warning');

        const limit = limitStr ? parseInt(limitStr) : 0;

        btn.disabled = true; 
        btn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i>';
        
        try {
            // <-- KUNCI GHAIB DIMASUKKAN DI SINI
            const res = await this.request('POST', { action: 'add_coupon', code: code, val: val, target: target, limit: limit, admin_token: this.config.masterPass });
            if (res.status === 'success') {
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Kupon ditambah!', showConfirmButton: false, timer: 1500 });
                document.getElementById('new_coupon_code').value = ''; 
                document.getElementById('new_coupon_val').value = '';
                document.getElementById('new_coupon_limit').value = '';
                
                const newC = await this.request('GET', null, 'get_coupons');
                this.state.coupons = newC.coupons || [];
                this.renderCoupons();
                this.populateProductDropdown();
            } else throw new Error(res.msg);
        } catch(e) { 
            Swal.fire('Ralat', e.message, 'error'); 
        } finally { 
            btn.disabled = false; 
            btn.innerHTML = '<i class="ri-add-line text-lg"></i> Tambah'; 
        }
    },

    async deleteCoupon(code) {
        const res = await Swal.fire({ 
            title: `Padam Kupon?`, 
            text: code, 
            icon: 'warning', 
            showCancelButton: true, 
            confirmButtonText: 'Ya', 
            confirmButtonColor: '#ef4444' 
        });
        
        if (res.isConfirmed) {
            Swal.fire({ title: 'Memadam...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
            try {
                // <-- KUNCI GHAIB DIMASUKKAN DI SINI
                const response = await this.request('POST', { action: 'delete_coupon', code: code, admin_token: this.config.masterPass });
                if (response.status === 'success') {
                    this.state.coupons = this.state.coupons.filter(c => c.code !== code);
                    this.renderCoupons();
                    this.populateProductDropdown();
                    Swal.close();
                } else throw new Error(response.msg);
            } catch(e) { 
                Swal.fire('Ralat', 'Gagal memadam kupon.', 'error'); 
            }
        }
    },

    renderProductGrid(data = null) {
        const grid = document.getElementById('product-grid');
        grid.innerHTML = '';
        const list = data || this.state.products;
        
        if (list.length === 0) {
            grid.innerHTML = `<div class="col-span-full py-16 text-center bg-white rounded-2xl border border-gray-100 shadow-sm"><i class="ri-plant-line text-4xl text-gray-300 block mb-2"></i><p class="text-gray-500 font-medium">Tiada produk dijumpai.</p></div>`;
            document.getElementById('prod-count').innerText = 0;
            return;
        }

        list.forEach(p => {
            const meta = this.parseData(p.description);
            const vars = this.safeJSONParse(p.variations);
            let actualStock = meta.stock;
            if (vars.length > 0) actualStock = vars.reduce((acc, v) => acc + (parseInt(v.stock) || 0), 0);
            
            const price = parseFloat(p.price) || 0;
            const discount = meta.discount;
            
            const mediaArr = this.parseMedia(p.image);
            let rawImgUrl = mediaArr.length > 0 ? mediaArr[0] : '';
            const img = rawImgUrl ? (this.getYoutubeThumbnail(rawImgUrl) || rawImgUrl) : 'https://placehold.co/400?text=No+Img';
            
            const isScheduled = meta.isCountdown == 1 && meta.liveDate;
            const isLocked = isScheduled ? this.isProductLocked(meta.liveDate) : false;

            let badgesHTML = '';
            if (meta.isActive === 0) badgesHTML += `<span class="badge badge-outline"><i class="ri-eye-off-line"></i> DRAFT</span>`;
            if (actualStock <= 0 && meta.isActive === 1) badgesHTML += `<span class="badge badge-red">HABIS STOK</span>`;
            if (discount > 0 && discount < price) badgesHTML += `<span class="badge badge-orange">-${Math.round(((price-discount)/price)*100)}%</span>`;
            if (p.is_free_shipping === 1) badgesHTML += `<span class="badge badge-green"><i class="ri-truck-fill"></i> FREE POS</span>`;
            
            let priceHTML = `<div class="font-bold text-gray-900 text-lg">RM ${price.toFixed(2)}</div>`;
            if (discount > 0 && discount < price) {
                priceHTML = `<div class="text-xs text-gray-400 line-through">RM ${price.toFixed(2)}</div><div class="font-bold text-emerald-600 text-lg">RM ${discount.toFixed(2)}</div>`;
            }

            let lockHTML = '';
            if (isLocked) {
                const cid = `grid-cd-${p.id}`;
                lockHTML = `
                <div class="lock-overlay-container absolute inset-0 bg-gray-900/70 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center text-white transition-opacity duration-500">
                    <i class="ri-lock-2-line text-3xl mb-1"></i>
                    <div class="text-[10px] uppercase tracking-widest font-bold mb-3">Terkunci</div>
                    <div id="${cid}" class="countdown-timer"></div>
                </div>`;
            }

            grid.innerHTML += `
                <div class="product-card group ${meta.isActive === 0 ? 'opacity-70 grayscale-[30%]' : ''}">
                    <div class="card-img-container">
                        <img src="${img}" class="card-img" loading="lazy">
                        ${this.getYoutubeThumbnail(rawImgUrl) ? '<div class="absolute inset-0 flex items-center justify-center text-white/80 pointer-events-none"><i class="ri-play-circle-fill text-5xl drop-shadow-md"></i></div>' : ''}
                        <div class="absolute top-3 left-3 flex flex-col gap-1 z-20 items-start">${badgesHTML}</div>
                        ${lockHTML}
                        <div class="card-overlay">
                            <button onclick="ASMRDHIA_APP.editProduct('${p.id}')" class="action-btn-circle" title="Edit"><i class="ri-pencil-line"></i></button>
                            <button onclick="ASMRDHIA_APP.previewProduct('${p.id}')" class="action-btn-circle" title="Preview"><i class="ri-eye-line"></i></button>
                        </div>
                    </div>
                    <div class="p-4 flex flex-col justify-between flex-1 bg-white">
                        <div>
                            <h3 class="font-bold text-gray-900 text-[15px] leading-tight mb-1 line-clamp-2" title="${p.name}">${p.name}</h3>
                        </div>
                        <div class="flex justify-between items-end mt-3 border-t border-gray-50 pt-3">
                            <div>${priceHTML}</div>
                            <div class="text-xs text-gray-500 font-medium flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-md">
                                <i class="ri-stack-line text-gray-400"></i> ${actualStock} ${vars.length>0 ? `(${vars.length}v)` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        document.getElementById('prod-count').innerText = list.length;
        this.updateTableCountdowns(); 
    },

    searchProduct(val) { 
        const term = val.toLowerCase(); 
        const filtered = this.state.products.filter(p => p.name.toLowerCase().includes(term) || (p.category && p.category.toLowerCase().includes(term))); 
        this.renderProductGrid(filtered); 
    },

    openModal(edit=false) { 
        document.getElementById('product-modal').classList.add('active'); 
        document.getElementById('modal-title').innerText = edit ? "Edit Produk" : "Tambah Produk Baru"; 
        document.getElementById('btn-delete').classList.toggle('hidden', !edit); 
        if(!edit) this.resetForm(); 
    },
    
    closeModal() { 
        document.getElementById('product-modal').classList.remove('active'); 
    },

    scrollGallery(direction) {
        const gallery = document.getElementById('prev-image-gallery');
        if(gallery) {
            const scrollAmount = gallery.clientWidth; 
            gallery.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
        }
    },

    playVideo(containerId, embedUrl) {
        const container = document.getElementById(containerId);
        if(container) {
            container.innerHTML = `<iframe width="100%" height="100%" src="${embedUrl}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
        }
    },

    closePreviewModal() {
        document.getElementById('preview-modal').classList.remove('active');
        if (this.intervals.preview) clearInterval(this.intervals.preview);
        
        const gallery = document.getElementById('prev-image-gallery');
        if (gallery) gallery.innerHTML = '';
    },
    
    resetForm() { 
        ['prod-id','prod-name','prod-price','prod-discount','prod-cat','prod-weight','prod-desc','prod-live-date'].forEach(id=>{
            const el = document.getElementById(id);
            if(el) el.value = '';
        });
        
        const prodStock = document.getElementById('prod-stock');
        if(prodStock) prodStock.value = 0;
        
        const prodStatus = document.getElementById('prod-status');
        if(prodStatus) prodStatus.value = 1;
        
        const prodFreeShip = document.getElementById('prod-free-ship');
        if(prodFreeShip) prodFreeShip.checked = false;
        
        const prodIsCountdown = document.getElementById('prod-is-countdown');
        if(prodIsCountdown) prodIsCountdown.checked = false;
        
        this.toggleCountdown(false);
        
        const variationList = document.getElementById('variation-list');
        if(variationList) variationList.innerHTML = ''; 
        
        const mainMediaList = document.getElementById('main-media-list');
        if(mainMediaList) {
            mainMediaList.innerHTML = '';
            this.addMainMedia(); 
        }
        
        this.updateFormPreview(); 
        this.calcTotalStock(); 
    },

    addMainMedia(url = '') {
        const list = document.getElementById('main-media-list');
        if (!list) return;
        if (list.children.length >= 8) return Swal.fire('Had Maksimum', 'Hanya 8 media dibenarkan', 'warning');
        
        const div = document.createElement('div');
        div.className = "flex gap-2 items-center slide-in";
        div.innerHTML = `
            <input type="url" class="clean-input flex-1 main-media-input !py-2" placeholder="URL Gambar / YouTube" value="${url}" oninput="ASMRDHIA_APP.updateFormPreview()">
            <button type="button" onclick="this.parentElement.remove(); ASMRDHIA_APP.updateFormPreview()" class="w-10 h-10 shrink-0 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition"><i class="ri-delete-bin-line"></i></button>
        `;
        list.appendChild(div);
        this.updateFormPreview();
    },

    updateFormPreview() { 
        const grid = document.getElementById('media-preview-grid');
        if (!grid) return;
        
        grid.innerHTML = '';
        const inputs = document.querySelectorAll('.main-media-input');
        
        let hasValid = false;
        let count = 0;
        
        inputs.forEach((inp) => {
            const url = inp.value.trim();
            if(url.length > 5) {
                hasValid = true;
                const isYt = this.getYoutubeThumbnail(url);
                const thumb = isYt || url;
                const icon = isYt ? '<div class="absolute inset-0 bg-black/40 flex items-center justify-center"><i class="ri-play-circle-fill text-white text-2xl drop-shadow-md"></i></div>' : '';
                grid.innerHTML += `<div class="aspect-square rounded-xl overflow-hidden relative border border-gray-200 shadow-sm"><img src="${thumb}" class="w-full h-full object-cover">${icon}</div>`;
                count++;
            }
        });
        
        if(!hasValid) {
            grid.innerHTML = `<div class="col-span-4 py-8 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-400 text-xs font-medium"><i class="ri-image-add-line text-3xl mb-2"></i> Pratonton Media</div>`;
        } else {
            for(let i=count; i<4; i++) {
                grid.innerHTML += `<div class="aspect-square bg-gray-100 rounded-xl border border-dashed border-gray-200 flex items-center justify-center text-gray-300"><i class="ri-image-line text-2xl"></i></div>`;
            }
        }
    },

    updateManualStock() { 
        const stockInput = document.getElementById('prod-stock');
        const displayInput = document.getElementById('prod-stock-display');
        if(stockInput && displayInput) {
            displayInput.value = stockInput.value; 
        }
    },

    calcTotalStock() {
        let total = 0;
        const rows = document.querySelectorAll('#variation-list .var-row');
        
        const singleStockContainer = document.getElementById('single-stock-container');
        const noVarMsg = document.getElementById('no-var-msg');
        const stockBadge = document.getElementById('stock-auto-badge');
        const displayInput = document.getElementById('prod-stock-display');
        
        if(rows.length > 0) {
            rows.forEach(r => {
                const stockInput = r.querySelector('.var-stock');
                if(stockInput) total += (parseInt(stockInput.value)||0);
            });
            
            if(singleStockContainer) singleStockContainer.style.display = 'none';
            if(noVarMsg) noVarMsg.style.display = 'none';
            if(stockBadge) {
                stockBadge.innerText = "AUTO";
                stockBadge.className = "bg-blue-100 text-blue-600 text-[10px] px-2 py-0.5 rounded font-bold";
            }
        } else {
            const stockInput = document.getElementById('prod-stock');
            if(stockInput) total = parseInt(stockInput.value)||0;
            
            if(singleStockContainer) singleStockContainer.style.display = 'block';
            if(noVarMsg) noVarMsg.style.display = 'block';
            if(stockBadge) {
                stockBadge.innerText = "MANUAL";
                stockBadge.className = "bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded font-bold";
            }
        }
        
        if(displayInput) displayInput.value = total;
    },

    addVarRow(l='', p='', s='', w='', mediaArr=[]) {
        const container = document.getElementById('variation-list');
        if (!container) return;
        
        const div = document.createElement('div'); 
        div.className = "var-row bg-white border border-gray-200 p-4 rounded-xl mb-4 relative group hover:border-emerald-300 transition-colors shadow-sm";
        
        let mediaHtml = '';
        if(!mediaArr || mediaArr.length === 0) mediaArr = [''];
        mediaArr.forEach(url => {
            mediaHtml += `<div class="flex gap-2 items-center"><input type="text" class="var-media-input clean-input !py-1.5 !px-2 text-xs" placeholder="URL Gambar Khas" value="${url}"><button type="button" onclick="this.parentElement.remove()" class="w-8 h-8 shrink-0 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition"><i class="ri-close-line"></i></button></div>`;
        });

        div.innerHTML = `
            <button type="button" onclick="this.parentElement.remove(); ASMRDHIA_APP.calcTotalStock()" class="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition"><i class="ri-close-circle-fill text-xl"></i></button>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 pr-6">
                <div><label class="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Label</label><input class="var-name clean-input !py-1.5 !px-2 text-xs font-bold" placeholder="Cth: Merah XL" value="${l}"></div>
                <div><label class="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Harga (RM)</label><input type="number" class="var-price clean-input !py-1.5 !px-2 text-xs" placeholder="0.00" value="${p}"></div>
                <div><label class="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Stok</label><input type="number" class="var-stock clean-input !py-1.5 !px-2 text-xs bg-emerald-50 focus:bg-white" placeholder="0" value="${s}" oninput="ASMRDHIA_APP.calcTotalStock()"></div>
                <div><label class="text-[10px] font-bold text-gray-500 uppercase mb-1 block">Berat (KG)</label><input type="number" class="var-weight clean-input !py-1.5 !px-2 text-xs" placeholder="0.5" value="${w}"></div>
            </div>
            <div class="border-t border-gray-100 pt-3 bg-gray-50 -mx-4 -mb-4 p-4 rounded-b-xl">
                <div class="flex items-center justify-between mb-3">
                    <span class="text-[10px] font-bold text-gray-500 uppercase">Gambar Variasi (Max 8)</span>
                    <button type="button" onclick="ASMRDHIA_APP.addVarMediaInput(this)" class="text-[10px] text-blue-600 font-bold bg-blue-100 hover:bg-blue-200 px-2 py-1.5 rounded transition"><i class="ri-add-line"></i> Tambah</button>
                </div>
                <div class="var-media-container space-y-2">
                    ${mediaHtml}
                </div>
            </div>`;
        container.appendChild(div); 
        this.calcTotalStock();
    },

    addVarMediaInput(btn) {
        const container = btn.closest('.var-row')?.querySelector('.var-media-container');
        if(!container) return;
        if(container.children.length >= 8) return Swal.fire('Had Maksimum', 'Maksimum 8 gambar untuk setiap variasi.', 'warning');
        
        const div = document.createElement('div');
        div.className = "flex gap-2 items-center";
        div.innerHTML = `<input type="text" class="var-media-input clean-input !py-1.5 !px-2 text-xs" placeholder="URL Gambar Khas"><button type="button" onclick="this.parentElement.remove()" class="w-8 h-8 shrink-0 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition"><i class="ri-close-line"></i></button>`;
        container.appendChild(div);
    },

    toggleCountdown(show) { 
        const countdownBox = document.getElementById('countdown-box');
        const countdownPreview = document.getElementById('countdown-preview');
        
        if(countdownBox) countdownBox.style.display = show ? 'block' : 'none'; 
        if(countdownPreview) countdownPreview.style.display = show ? 'block' : 'none'; 
    },
    
    validateScheduleDate() {
        const date = document.getElementById('prod-live-date')?.value;
        if(date) { 
            this.updateCountdownDisplay('countdown-display', date);
            if (this.intervals.preview) clearInterval(this.intervals.preview);
            this.intervals.preview = setInterval(() => { this.updateCountdownDisplay('countdown-display', date); }, 1000);
        }
    },

    editProduct(id) {
        const p = this.state.products.find(x => x.id == id);
        if (!p) return;
        const meta = this.parseData(p.description);
        
        document.getElementById('prod-id').value = p.id;
        document.getElementById('prod-name').value = p.name;
        document.getElementById('prod-price').value = p.price;
        document.getElementById('prod-discount').value = meta.discount || '';
        document.getElementById('prod-weight').value = p.weight_kg || '';
        document.getElementById('prod-cat').value = p.category || '';
        document.getElementById('prod-desc').value = meta.cleanDesc;
        document.getElementById('prod-stock').value = meta.stock;
        document.getElementById('prod-status').value = meta.isActive;
        document.getElementById('prod-free-ship').checked = (p.is_free_shipping === 1);
        
        document.getElementById('main-media-list').innerHTML = '';
        const mediaArr = this.parseMedia(p.image);
        if(mediaArr.length > 0) {
            mediaArr.forEach(url => this.addMainMedia(url));
        } else {
            this.addMainMedia();
        }
        
        document.getElementById('variation-list').innerHTML = '';
        const vars = this.safeJSONParse(p.variations);
        if(vars.length > 0) {
            vars.forEach(v => {
                const vMediaArr = this.parseMedia(v.image);
                this.addVarRow(v.label, v.price, v.stock, v.weight, vMediaArr);
            });
        }
        this.calcTotalStock();

        if (meta.isCountdown == 1) {
            document.getElementById('prod-is-countdown').checked = true;
            this.toggleCountdown(true);
            if (meta.liveDate) {
                document.getElementById('prod-live-date').value = meta.liveDate;
                this.validateScheduleDate();
            }
        } else {
            document.getElementById('prod-is-countdown').checked = false;
            this.toggleCountdown(false);
        }
        this.openModal(true);
    },

    async saveProduct() {
        const btn = document.getElementById('btn-save');
        const ogText = btn.innerHTML;
        
        const name = document.getElementById('prod-name').value;
        const price = document.getElementById('prod-price').value;
        if (!name || !price) return Swal.fire('Ralat', 'Nama & Harga wajib diisi', 'warning');

        btn.disabled = true; 
        btn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i> Menyimpan...';

        let mainMedia = [];
        document.querySelectorAll('.main-media-input').forEach(inp => {
            if(inp.value.trim()) mainMedia.push(inp.value.trim());
        });
        const finalImgData = mainMedia.length > 0 ? JSON.stringify(mainMedia) : '';

        let variations = [];
        document.querySelectorAll('#variation-list .var-row').forEach(row => {
            const vName = row.querySelector('.var-name')?.value;
            const vPrice = parseFloat(row.querySelector('.var-price')?.value) || 0;
            const vStock = parseInt(row.querySelector('.var-stock')?.value) || 0;
            const vWeight = parseFloat(row.querySelector('.var-weight')?.value) || 0;
            
            let varMedia = [];
            row.querySelectorAll('.var-media-input').forEach(inp => {
                if(inp.value.trim()) varMedia.push(inp.value.trim());
            });
            const vImgData = varMedia.length > 0 ? JSON.stringify(varMedia) : '';

            if(vName) variations.push({ 
                label: vName, 
                price: vPrice, 
                stock: vStock, 
                weight: vWeight, 
                image: vImgData 
            });
        });

        const finalStock = variations.length > 0 ? variations.reduce((a,b)=>a+b.stock,0) : (parseInt(document.getElementById('prod-stock')?.value)||0);
        const finalDiscount = parseFloat(document.getElementById('prod-discount')?.value) || 0;
        const isC = document.getElementById('prod-is-countdown')?.checked ? 1 : 0;
        const lDate = document.getElementById('prod-live-date')?.value;
        const { cleanDesc } = this.parseData(document.getElementById('prod-desc')?.value);

        const configObj = { 
            d: finalDiscount, 
            s: finalStock, 
            a: parseInt(document.getElementById('prod-status')?.value) || 1, 
            c: isC, 
            t: (isC && lDate) ? lDate : '' 
        };
        
        const desc = `[CONFIG:${JSON.stringify(configObj)}][/CONFIG] ${cleanDesc || ''}`;

        const data = {
            action: 'save_menu_item',
            admin_token: this.config.masterPass, // <-- KUNCI GHAIB DIMASUKKAN DI SINI
            id: document.getElementById('prod-id')?.value || 'P' + Date.now(),
            name: name, 
            price: price, 
            weight_kg: document.getElementById('prod-weight')?.value || 0.5,
            cat: document.getElementById('prod-cat')?.value, 
            img: finalImgData,
            description: desc, 
            variations: JSON.stringify(variations), 
            discount_price: finalDiscount,
            is_countdown: configObj.c, 
            live_date: configObj.c ? configObj.t : null,
            is_free_shipping: document.getElementById('prod-free-ship')?.checked ? 1 : 0
        };

        try {
            const res = await this.request('POST', data);
            if (res.status === 'success') {
                Swal.fire({ 
                    icon: 'success', 
                    title: 'Berjaya', 
                    text: 'Produk disimpan', 
                    timer: 1000, 
                    showConfirmButton: false 
                });
                this.closeModal(); 
                
                const [resProd, resCoup] = await Promise.all([
                    this.request('GET'),
                    this.request('GET', null, 'get_coupons')
                ]);
                this.state.products = resProd.menus || [];
                this.state.coupons = resCoup.coupons || [];
                
                this.renderProductGrid();
                this.renderCoupons();
                this.populateProductDropdown();
            } else throw new Error(res.msg);
        } catch (e) { 
            Swal.fire('Gagal', e.message, 'error'); 
        } finally { 
            btn.disabled = false; 
            btn.innerHTML = ogText; 
        }
    },

    async deleteProduct() {
        const res = await Swal.fire({ 
            title: 'Padam Produk?', 
            text: 'Tindakan ini tidak boleh dikembalikan',
            icon: 'warning', 
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Ya, Padam'
        });
        
        if(res.isConfirmed) {
            try { 
                await this.request('POST', { 
                    action: 'delete_menu_item', 
                    admin_token: this.config.masterPass, // <-- KUNCI GHAIB DIMASUKKAN DI SINI
                    id: document.getElementById('prod-id')?.value 
                }); 
                Swal.fire('Dipadam', 'Produk berjaya dipadam', 'success'); 
                this.closeModal(); 
                
                const [resProd, resCoup] = await Promise.all([
                    this.request('GET'),
                    this.request('GET', null, 'get_coupons')
                ]);
                this.state.products = resProd.menus || [];
                this.state.coupons = resCoup.coupons || [];
                
                this.renderProductGrid();
                this.renderCoupons();
                this.populateProductDropdown();
            } catch(e) { 
                Swal.fire('Ralat', e.message, 'error'); 
            }
        }
    },

    previewProduct(id = null) {
        let name, mediaArr = [], price, discount, cat, desc, stock, isActive, variations = [], isCountdown, liveDate, isFreeShip;

        if (id) {
            const p = this.state.products.find(x => x.id == id);
            if (!p) return;
            const meta = this.parseData(p.description);
            name = p.name; 
            price = parseFloat(p.price); 
            discount = meta.discount;
            cat = p.category; 
            desc = meta.cleanDesc; 
            variations = this.safeJSONParse(p.variations);
            stock = variations.length > 0 ? variations.reduce((a, v) => a + (parseInt(v.stock)||0), 0) : meta.stock;
            isActive = meta.isActive; 
            isCountdown = meta.isCountdown; 
            liveDate = meta.liveDate; 
            isFreeShip = p.is_free_shipping; 
            mediaArr = this.parseMedia(p.image);
        } else {
            name = document.getElementById('prod-name')?.value; 
            document.querySelectorAll('.main-media-input').forEach(i => { 
                if(i.value.trim()) mediaArr.push(i.value.trim()); 
            });
            price = parseFloat(document.getElementById('prod-price')?.value) || 0; 
            discount = parseFloat(document.getElementById('prod-discount')?.value) || 0;
            cat = document.getElementById('prod-cat')?.value; 
            desc = document.getElementById('prod-desc')?.value;
            stock = parseInt(document.getElementById('prod-stock-display')?.value) || 0;
            isActive = parseInt(document.getElementById('prod-status')?.value) || 1;
            isCountdown = document.getElementById('prod-is-countdown')?.checked ? 1 : 0; 
            liveDate = document.getElementById('prod-live-date')?.value;
            isFreeShip = document.getElementById('prod-free-ship')?.checked ? 1 : 0; 
            
            document.querySelectorAll('#variation-list .var-row').forEach(row => {
                const vName = row.querySelector('.var-name')?.value;
                const vStock = row.querySelector('.var-stock')?.value;
                if(vName) variations.push({ label: vName, stock: parseInt(vStock) || 0 });
            });
        }

        document.getElementById('prev-name').innerText = name || 'Nama Produk';
        document.getElementById('prev-cat').innerText = cat || 'UMUM';
        document.getElementById('prev-desc').innerText = desc || 'Tiada penerangan.';

        const gallery = document.getElementById('prev-image-gallery');
        const scrollNav = document.getElementById('prev-scroll-nav');
        
        const renderGallery = (mArr) => {
            if(gallery) {
                gallery.innerHTML = '';
                if(mArr.length === 0 || (mArr.length === 1 && mArr[0] === '')) mArr = ['https://placehold.co/400x400?text=No+Media'];
                
                mArr.forEach((url, idx) => {
                    const isYt = this.getYoutubeThumbnail(url);
                    const embedUrl = isYt ? this.getEmbedUrl(url) : null;
                    const thumb = isYt || url;
                    
                    if (isYt) {
                        gallery.innerHTML += `
                        <div class="w-full h-full shrink-0 snap-item relative bg-black flex items-center justify-center" id="prev-slide-${idx}">
                            <img src="${thumb}" class="w-full h-full object-cover opacity-60 cursor-pointer" onclick="ASMRDHIA_APP.playVideo('prev-slide-${idx}', '${embedUrl}')">
                            <i class="ri-play-circle-fill absolute text-white text-5xl opacity-90 drop-shadow-lg cursor-pointer hover:scale-110 transition-transform" onclick="ASMRDHIA_APP.playVideo('prev-slide-${idx}', '${embedUrl}')"></i>
                        </div>`;
                    } else {
                        gallery.innerHTML += `<div class="w-full h-full shrink-0 snap-item relative bg-black flex items-center justify-center"><img src="${thumb}" class="w-full h-full object-cover"></div>`;
                    }
                });
            }
            
            if(scrollNav) {
                if(mArr.length > 1) {
                    scrollNav.style.display = 'block';
                } else {
                    scrollNav.style.display = 'none';
                }
            }
        };

        renderGallery(mediaArr);

        const priceCont = document.getElementById('prev-price-container');
        const promoBadge = document.getElementById('prev-promo-badge');
        if (discount > 0 && discount < price && priceCont) {
            priceCont.innerHTML = `<span class="text-gray-400 line-through text-sm">RM${price.toFixed(2)}</span> <span class="text-2xl font-bold text-emerald-600">RM${discount.toFixed(2)}</span>`;
            if(promoBadge) {
                promoBadge.innerText = `-${Math.round(((price - discount) / price) * 100)}%`; 
                promoBadge.style.display = 'inline-flex';
            }
        } else {
            if(priceCont) priceCont.innerHTML = `<span class="text-2xl font-bold text-gray-900">RM${price.toFixed(2)}</span>`; 
            if(promoBadge) promoBadge.style.display = 'none';
        }

        const stockBadge = document.getElementById('prev-stock-badge');
        if(stockBadge) {
            if (isActive === 0) { 
                stockBadge.innerText = "DRAFT"; 
                stockBadge.className = "absolute top-4 left-4 badge badge-outline z-20 flex items-center"; 
                stockBadge.style.display = 'inline-flex'; 
            } 
            else if (stock <= 0) { 
                stockBadge.innerText = "HABIS STOK"; 
                stockBadge.className = "absolute top-4 left-4 badge badge-red z-20 flex items-center"; 
                stockBadge.style.display = 'inline-flex'; 
            } 
            else { 
                stockBadge.style.display = 'none'; 
            }
        }

        const freeShipBadge = document.getElementById('prev-freeship-badge');
        if(freeShipBadge) {
            if (isFreeShip === 1) freeShipBadge.style.display = 'inline-flex'; 
            else freeShipBadge.style.display = 'none';
        }

        const varCont = document.getElementById('prev-var-container');
        const varList = document.getElementById('prev-var-list');
        if(varList) varList.innerHTML = '';
        
        if (variations.length > 0 && varCont && varList) {
            varCont.classList.remove('hidden');
            variations.forEach(v => { 
                const btn = document.createElement('button');
                btn.className = 'px-3 py-1.5 border border-gray-200 bg-white rounded-lg text-xs font-semibold text-gray-600 hover:border-emerald-500 hover:text-emerald-600 transition shadow-sm';
                btn.innerText = `${v.label} (${v.stock})`;
                
                btn.onclick = () => {
                    Array.from(varList.children).forEach(b=>b.classList.remove('bg-emerald-50', 'border-emerald-500', 'text-emerald-600'));
                    btn.classList.add('bg-emerald-50', 'border-emerald-500', 'text-emerald-600');
                    
                    const vMediaArr = this.parseMedia(v.image);
                    if(vMediaArr.length > 0 && vMediaArr[0] !== '') {
                        renderGallery(vMediaArr);
                    }

                    if(v.price && priceCont) {
                        priceCont.innerHTML = `<span class="text-2xl font-bold text-emerald-600">RM${parseFloat(v.price).toFixed(2)}</span>`;
                        if(promoBadge) promoBadge.style.display = 'none';
                    }
                    
                    if(stockBadge && isActive !== 0) {
                        if (v.stock <= 0) {
                            stockBadge.innerText = "HABIS STOK";
                            stockBadge.className = "absolute top-4 left-4 badge badge-red z-20 flex items-center";
                            stockBadge.style.display = 'inline-flex';
                        } else {
                            stockBadge.style.display = 'none';
                        }
                    }
                };
                varList.appendChild(btn);
            });
        } else if(varCont) {
            varCont.classList.add('hidden');
        }

        const isScheduled = isCountdown == 1 && liveDate;
        const isLocked = isScheduled ? this.isProductLocked(liveDate) : false;
        
        const lockOverlay = document.getElementById('prev-lock-overlay');
        if(lockOverlay) {
            lockOverlay.style.display = isLocked ? 'flex' : 'none';
        }
        
        if (isLocked) {
            this.updateCountdownDisplay('prev-countdown', liveDate);
            if (this.intervals.preview) clearInterval(this.intervals.preview);
            this.intervals.preview = setInterval(() => {
                 this.updateCountdownDisplay('prev-countdown', liveDate);
            }, 1000);
        } else {
             if (this.intervals.preview) clearInterval(this.intervals.preview);
        }

        document.getElementById('preview-modal')?.classList.add('active');
    }
};

window.onload = () => ASMRDHIA_APP.init();
