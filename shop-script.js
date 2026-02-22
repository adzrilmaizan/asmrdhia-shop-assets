const WORKER_URL = "https://shopapi.asmrdhia.com";

const SYS = {
    goToAdmin: () => {
        if(localStorage.getItem('asmrdhia_session')) window.location.href = '/p/order.html';
        else { document.getElementById('shop-container')?.classList.add('hidden'); document.getElementById('view-admin').classList.remove('hidden'); }
    },
    goToShop() { document.getElementById('view-admin').classList.add('hidden'); document.getElementById('shop-container')?.classList.remove('hidden'); }
};

const ADMIN = {
    login() {
        if(document.getElementById('admin-pass').value === "admin123") { localStorage.setItem('asmrdhia_session', 'ACTIVE'); window.location.href = '/p/order.html'; }
        else Swal.fire({title:'Access Denied', text:'Invalid password', icon:'error', background: '#1e2329', color: '#fff'});
    }
};

const SHOP = {
    state: { 
        products: [], categories: [], currentCategory: 'ALL',
        coupons: [], cart: [], activeCoupon: null, settings: {}, 
        globalCountdownInterval: null, modalQty: 1, currentSelection: null,
        appliedPoints: { email: null, points: 0, amount: 0 },
        reviewOrder: null, reviewName: null, reviewItemsData: []
    },
    
    showToast(title, icon = 'success') {
        Swal.fire({ toast: true, position: 'top', icon: icon, title: title, showConfirmButton: false, timer: 2000, background: '#1e2329', color: '#fff' });
    },

    async init() {
        this.checkPaymentStatus();
        const saved = localStorage.getItem('asmr_cart');
        if(saved) this.state.cart = JSON.parse(saved);
        this.updateCartUI();

        try {
            const [prod, coup, set] = await Promise.all([
                fetch(`${WORKER_URL}?action=get_menu_data&_t=${Date.now()}`).then(r=>r.json()),
                fetch(`${WORKER_URL}?action=get_coupons&_t=${Date.now()}`).then(r=>r.json()),
                fetch(`${WORKER_URL}?action=get_shop_settings&_t=${Date.now()}`).then(r=>r.json())
            ]);
            
            this.state.products = prod.menus || [];
            this.state.coupons = coup.coupons || [];

            if(Array.isArray(set.data)) {
                this.state.settings = set.data.reduce((acc, item) => { acc[item.key] = item.value; return acc; }, {});
            } else {
                this.state.settings = set.data || {};
            }
            
            if(this.state.settings.shop_name) document.getElementById('shop-brand-name').innerText = this.state.settings.shop_name;

            const ptRate = parseFloat(this.state.settings.pt_redeem_value) || 0.10;
            const ptStar = parseInt(this.state.settings.pt_reward_star) || 1;
            const ptLong = parseInt(this.state.settings.pt_reward_long) || 10;
            const maxPts = (5 * ptStar) + ptLong;

            const vrInfo = document.getElementById('vr-pt-info');
            if(vrInfo) vrInfo.innerHTML = `Dapatkan sehingga ${maxPts} pts bagi setiap produk yang dinilai. <br><span class="text-amber-400 font-bold">1 pt = RM${ptRate.toFixed(2)} Diskaun!</span>`;
            
            const cartPtHeader = document.getElementById('cart-pt-header');
            if(cartPtHeader) cartPtHeader.innerHTML = `<i class="ri-copper-coin-line text-amber-400 text-base"></i> Tebus Point (1 pt = RM${ptRate.toFixed(2)})`;

            this.extractCategories();
            this.renderCategories();
            this.renderProducts();
            this.initCountdown();

            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('product')) setTimeout(() => { this.viewProduct(urlParams.get('product')); }, 300);
        } catch(e) { 
            const grid = document.getElementById('product-grid');
            if(grid) grid.innerHTML = `<div class="col-span-full py-20 text-center text-red-400 font-bold"><i class="ri-wifi-off-line text-4xl mb-2 block"></i> Failed to connect to server.</div>`;
        }
    },

    getVariations(data) {
        if(!data) return [];
        if(Array.isArray(data)) return data;
        try { return JSON.parse(data); } catch(e) { return []; }
    },

    parseConfig(text) {
        let conf = { isActive: 1, stock: 0, discount: 0, isCountdown: 0, liveDate: '', cleanDesc: text || '' };
        if(!text) return conf;
        const m = text.match(/\[CONFIG:(.*?)\]\[\/CONFIG\]/);
        if(m && m[1]) {
            try { const c = JSON.parse(m[1]); if(c.a!==undefined)conf.isActive=c.a; if(c.s!==undefined)conf.stock=parseInt(c.s)||0; if(c.d)conf.discount=parseFloat(c.d); if(c.c)conf.isCountdown=c.c; if(c.t)conf.liveDate=c.t; } catch(e){}
            conf.cleanDesc = text.replace(m[0], '').trim();
        }
        return conf;
    },

    parseMedia(imgData) {
        if (!imgData || imgData.length < 5) return [];
        try { const parsed = JSON.parse(imgData); if (Array.isArray(parsed)) return parsed; return [imgData]; } catch(e) { return [imgData]; }
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

    extractCategories() {
        const cats = new Set();
        this.state.products.forEach(p => { if(p.category && p.category.trim() !== '') cats.add(p.category.trim()); });
        this.state.categories = Array.from(cats);
    },

    renderCategories() {
        const container = document.getElementById('category-container');
        if(this.state.categories.length === 0) { container.classList.add('hidden'); return; }
        container.classList.remove('hidden');

        let html = `<button onclick="SHOP.filterByCategory('ALL')" class="category-pill btn-active ${this.state.currentCategory === 'ALL' ? 'active' : ''}">All</button>`;
        this.state.categories.forEach(c => { html += `<button onclick="SHOP.filterByCategory('${c}')" class="category-pill btn-active ${this.state.currentCategory === c ? 'active' : ''}">${c}</button>`; });
        container.innerHTML = html;
    },

    filterByCategory(cat) {
        this.state.currentCategory = cat;
        document.getElementById('grid-title').innerText = cat === 'ALL' ? 'Paling baru' : cat;
        this.renderCategories(); 
        this.renderProducts();
    },
    
    clearSearch() {
        document.getElementById('search-input').value = '';
        this.renderProducts();
    },

    renderProducts() {
        const grid = document.getElementById('product-grid');
        const searchInput = document.getElementById('search-input');
        const term = searchInput.value.toLowerCase().trim();
        
        const clearBtn = document.getElementById('clear-search');
        if(clearBtn) clearBtn.style.display = term !== '' ? 'block' : 'none';

        grid.innerHTML = '';
        
        if (term !== '') {
            this.state.currentCategory = 'ALL';
            document.getElementById('grid-title').innerText = 'Search Results';
            this.renderCategories();
        } else {
            document.getElementById('grid-title').innerText = this.state.currentCategory === 'ALL' ? 'Paling baru' : this.state.currentCategory;
        }
        
        const list = this.state.products.filter(p => {
            const c = this.parseConfig(p.description);
            const matchSearch = p.name.toLowerCase().includes(term) || (p.category && p.category.toLowerCase().includes(term));
            const matchCat = this.state.currentCategory === 'ALL' || (p.category && p.category.trim() === this.state.currentCategory);
            return c.isActive === 1 && matchSearch && matchCat;
        });
        
        if(list.length === 0) { 
            grid.innerHTML = `
                <div class="col-span-full empty-state">
                    <i class="ri-search-2-line text-5xl text-gray-600 mb-3 block"></i>
                    <h3 class="text-white font-bold text-lg mb-1">No products found</h3>
                    <p class="text-gray-500 text-sm">Try adjusting your search or filters.</p>
                </div>`; 
            return; 
        }
        
        list.forEach(p => {
            const conf = this.parseConfig(p.description);
            const vars = this.getVariations(p.variations);
            let actualStock = conf.stock;
            if (vars.length > 0) actualStock = vars.reduce((acc, v) => acc + (parseInt(v.stock) || 0), 0);

            const price = parseFloat(p.price);
            const finalPrice = (conf.discount > 0 && conf.discount < price) ? conf.discount : price;
            
            const mediaArr = this.parseMedia(p.image);
            let rawImgUrl = mediaArr.length > 0 ? mediaArr[0] : '';
            const img = rawImgUrl ? (this.getYoutubeThumbnail(rawImgUrl) || rawImgUrl) : 'https://placehold.co/400?text=No+Img';
            
            let badgeHTML = '';
            if (actualStock <= 0) badgeHTML = '<span class="absolute top-3 left-3 badge-red shadow-sm z-20">OUT OF STOCK</span>';
            else if (conf.discount > 0) badgeHTML = `<span class="absolute top-3 left-3 badge-green shadow-sm z-20">-${Math.round(((price-conf.discount)/price)*100)}%</span>`;
            else if (p.is_free_shipping === 1 || p.is_digital === 1) badgeHTML = `<span class="absolute top-3 left-3 bg-blue-500 text-white px-2 py-1 rounded-md text-[9px] font-bold shadow-sm z-20"><i class="ri-truck-fill"></i> FREE POS</span>`;
            
            let ratingHTML = '';
            if (p.rating_count > 0) ratingHTML = `<div class="rating-badge"><i class="ri-star-fill text-amber-400"></i> ${p.rating_avg}</div>`;

            let priceHTML = `<span class="text-white font-bold text-base sm:text-lg leading-tight">RM${finalPrice.toFixed(2)}</span>`;
            if (conf.discount > 0 && conf.discount < price) priceHTML += `<span class="text-gray-500 line-through text-[11px] sm:text-xs leading-tight">RM${price.toFixed(2)}</span>`;

            const isScheduled = conf.isCountdown == 1 && conf.liveDate;
            const isLocked = isScheduled ? new Date(conf.liveDate) > new Date() : false;
            
            let overlayHTML = '';
            if(isLocked) {
                overlayHTML = `
                <div class="locked-overlay absolute inset-0 bg-black/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center transition-opacity duration-500" id="timer-${p.id}" data-time="${conf.liveDate}">
                    <i class="ri-lock-2-line text-white text-2xl mb-2 opacity-50"></i>
                    <div class="bento-timer-container">
                        <div class="timer-box"><div class="timer-val d-val">00</div><div class="timer-lbl">D</div></div>
                        <div class="timer-box"><div class="timer-val h-val">00</div><div class="timer-lbl">H</div></div>
                        <div class="timer-box"><div class="timer-val m-val">00</div><div class="timer-lbl">M</div></div>
                        <div class="timer-box"><div class="timer-val s-val">00</div><div class="timer-lbl">S</div></div>
                    </div>
                </div>`;
            }
            
            let actionBtn = `<button onclick="event.stopPropagation(); SHOP.quickAdd('${p.id}')" class="absolute bottom-3 right-3 w-8 h-8 bg-emerald-500 hover:bg-emerald-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 transition-transform active:scale-95 z-40 btn-active" aria-label="Quick Add"><i class="ri-add-line text-lg"></i></button>`;
            if (isLocked) actionBtn = ''; 
            if (actualStock <= 0) actionBtn = `<div class="absolute bottom-3 right-3 w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-gray-400 z-40"><i class="ri-forbid-line text-lg"></i></div>`;
                
            grid.innerHTML += `
            <div class="bg-[var(--bg-card)] rounded-2xl overflow-hidden cursor-pointer flex flex-col relative group border border-white/5 hover:border-white/10 transition-all" onclick="SHOP.viewProduct('${p.id}')">
                <div class="relative aspect-square bg-[#2a3038] overflow-hidden">
                    <img src="${img}" alt="${p.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy">
                    ${this.getYoutubeThumbnail(rawImgUrl) ? '<div class="absolute inset-0 flex items-center justify-center text-white/80 pointer-events-none z-10"><i class="ri-play-circle-fill text-5xl drop-shadow-md"></i></div>' : ''}
                    ${ratingHTML}
                    ${badgeHTML}
                    ${overlayHTML}
                </div>
                <div class="p-4 flex flex-col justify-between flex-1 relative">
                    <h3 class="text-sm font-medium text-gray-300 line-clamp-1 mb-1 pr-6">${p.name}</h3>
                    <div class="flex flex-col items-start pr-10 min-w-0">
                        <span class="text-white font-bold text-base sm:text-lg leading-tight truncate w-full">RM${finalPrice.toFixed(2)}</span>
                        ${conf.discount > 0 && conf.discount < price ? `<span class="text-gray-500 line-through text-[11px] sm:text-xs leading-none truncate w-full">RM${price.toFixed(2)}</span>` : ''}
                    </div>
                    ${actionBtn}
                </div>
            </div>`;
        });
    },

    initCountdown() {
        if(this.state.globalCountdownInterval) clearInterval(this.state.globalCountdownInterval);
        this.state.globalCountdownInterval = setInterval(() => {
            document.querySelectorAll('.locked-overlay').forEach(el => {
                const targetDate = el.getAttribute('data-time');
                if (!targetDate) return;

                const diff = new Date(targetDate) - new Date();
                if (diff <= 0) {
                    el.style.opacity = '0';
                    setTimeout(() => el.remove(), 500);
                    this.renderProducts(); 
                    return;
                }

                const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((diff % (1000 * 60)) / 1000);

                const dEl = el.querySelector('.d-val'); if (dEl) dEl.innerText = d.toString().padStart(2, '0');
                const hEl = el.querySelector('.h-val'); if (hEl) hEl.innerText = h.toString().padStart(2, '0');
                const mEl = el.querySelector('.m-val'); if (mEl) mEl.innerText = m.toString().padStart(2, '0');
                const sEl = el.querySelector('.s-val'); if (sEl) sEl.innerText = s.toString().padStart(2, '0');
            });
        }, 1000);
    },

    scrollGallery(direction) {
        const gallery = document.getElementById('dm-image-gallery');
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

    closeModal() {
        document.getElementById('details-modal').classList.add('hidden');
        const url = new URL(window.location);
        url.searchParams.delete('product');
        window.history.pushState({}, '', url);
        
        const gallery = document.getElementById('dm-image-gallery');
        if (gallery) gallery.innerHTML = '';
    },

    quickAdd(id) {
        const p = this.state.products.find(x=>x.id==id);
        if(!p) return;
        const c = this.parseConfig(p.description);
        
        if(c.isCountdown == 1 && new Date(c.liveDate) > new Date()) { 
            Swal.fire({ icon: 'info', title: 'Locked', text: 'This product has not launched yet.', background: '#1e2329', color: '#fff', confirmButtonColor: '#10b981' }); return; 
        }

        let variations = this.getVariations(p.variations);
        if(variations.length > 0) {
            this.viewProduct(id);
            return;
        }

        let actualStock = parseInt(c.stock) || 0;
        if(actualStock <= 0) {
            this.showToast('Out of stock', 'error'); return; 
        }
        
        const exist = this.state.cart.find(x => x.cartId === id);
        let currentCartQty = exist ? exist.qty : 0;
        
        if (currentCartQty + 1 > actualStock) {
            this.showToast('Max stock limit reached', 'error');
            return;
        }

        this.addToCart(id, null, c.discount, 1);
    },

    viewProduct(id) {
        const p = this.state.products.find(x=>x.id==id);
        if(!p) return;
        const c = this.parseConfig(p.description);
        
        if(c.isCountdown == 1 && new Date(c.liveDate) > new Date()) { 
            Swal.fire({ icon: 'info', title: 'Locked', text: 'This product has not launched yet.', background: '#1e2329', color: '#fff', confirmButtonColor: '#10b981' }); return; 
        }

        const url = new URL(window.location);
        url.searchParams.set('product', p.id);
        window.history.pushState({ path: url.href }, '', url);

        const mediaArr = this.parseMedia(p.image);
        const freeShipBadge = document.getElementById('dm-freeship-badge');
        if (p.is_free_shipping === 1 || p.is_digital === 1) freeShipBadge.classList.remove('hidden');
        else freeShipBadge.classList.add('hidden');

        document.getElementById('dm-title').innerText = p.name;
        document.getElementById('dm-desc').innerText = c.cleanDesc || 'No additional information.';
        document.getElementById('dm-cat').innerText = p.category || 'GENERAL';
        
        let variations = this.getVariations(p.variations);
        let maxStock = c.stock;
        if(variations.length > 0) {
             maxStock = variations.reduce((a, v) => a + (parseInt(v.stock)||0), 0);
        }
        
        document.getElementById('dm-stock').innerText = maxStock;
        document.getElementById('dm-weight').innerText = (Number(p.weight_kg) || 0.5) + ' KG';
        
        const ratingSum = document.getElementById('dm-rating-summary');
        if (p.rating_count > 0) {
            document.getElementById('dm-rating-avg').innerText = p.rating_avg;
            document.getElementById('dm-rating-count').innerText = p.rating_count;
            ratingSum.classList.remove('hidden');
        } else {
            ratingSum.classList.add('hidden');
        }

        this.loadProductReviews(p.id);

        const priceBox = document.getElementById('dm-price-box'), badge = document.getElementById('dm-promo-badge'), price = parseFloat(p.price);
        
        if(c.discount > 0 && c.discount < price) { 
            priceBox.innerHTML = `<span class="text-3xl font-black text-emerald-400">RM${c.discount.toFixed(2)}</span><span class="text-sm text-gray-500 line-through font-medium">RM${price.toFixed(2)}</span>`; 
            badge.classList.remove('hidden'); 
        } else { 
            priceBox.innerHTML = `<span class="text-3xl font-black text-white">RM${price.toFixed(2)}</span>`; 
            badge.classList.add('hidden'); 
        }

        const gallery = document.getElementById('dm-image-gallery');
        const indicator = document.getElementById('dm-gallery-indicator');
        const btnLeft = document.getElementById('btn-scroll-left');
        const btnRight = document.getElementById('btn-scroll-right');
        
        const renderGallery = (mArr) => {
            if(gallery) {
                gallery.innerHTML = '';
                if(mArr.length === 0) mArr = ['https://placehold.co/400x400?text=No+Media'];
                
                mArr.forEach((url, idx) => {
                    const isYt = this.getYoutubeThumbnail(url);
                    if (isYt) {
                        const embedUrl = this.getEmbedUrl(url);
                        gallery.innerHTML += `
                        <div class="w-full h-full shrink-0 snap-item relative bg-black flex items-center justify-center" id="slide-${idx}">
                            <img src="${isYt}" class="w-full h-full object-cover opacity-60 cursor-pointer" onclick="SHOP.playVideo('slide-${idx}', '${embedUrl}')" loading="lazy">
                            <i class="ri-play-circle-fill absolute text-white text-6xl opacity-90 drop-shadow-lg cursor-pointer hover:scale-110 transition-transform" onclick="SHOP.playVideo('slide-${idx}', '${embedUrl}')" style="top:50%; left:50%; transform:translate(-50%,-50%);"></i>
                        </div>`;
                    } else {
                        gallery.innerHTML += `<div class="w-full h-full shrink-0 snap-item relative bg-black flex items-center justify-center"><img src="${url}" class="w-full h-full object-cover" loading="lazy"></div>`;
                    }
                });
            }
            if(indicator) indicator.style.display = mArr.length > 1 ? 'block' : 'none';
            if(btnLeft) btnLeft.style.display = mArr.length > 1 ? '' : 'none'; 
            if(btnRight) btnRight.style.display = mArr.length > 1 ? '' : 'none';
        };

        renderGallery(mediaArr);

        const varDiv = document.getElementById('dm-var-section'), varList = document.getElementById('dm-var-list');
        varList.innerHTML = '';
        
        this.state.currentSelection = null; 
        this.state.modalQty = 1; 
        document.getElementById('dm-qty-display').innerText = 1;

        if(variations.length > 0) {
            varDiv.classList.remove('hidden');
            variations.forEach(v => {
                const btn = document.createElement('button');
                btn.className = 'var-btn';
                btn.innerText = `${v.label} (${v.stock})`; 
                btn.disabled = v.stock <= 0;
                
                btn.onclick = () => {
                    this.state.currentSelection = v; 
                    Array.from(varList.children).forEach(b=>b.classList.remove('active'));
                    btn.classList.add('active');
                    
                    const vMediaArr = this.parseMedia(v.image);
                    if(vMediaArr.length > 0 && vMediaArr[0] !== '') {
                        renderGallery(vMediaArr); 
                    }

                    if(v.price) priceBox.innerHTML = `<span class="text-3xl font-black text-emerald-400">RM${parseFloat(v.price).toFixed(2)}</span>`;
                    document.getElementById('dm-stock').innerText = v.stock;
                    if(v.weight) document.getElementById('dm-weight').innerText = v.weight + ' KG';
                    
                    this.state.modalQty = 1;
                    document.getElementById('dm-qty-display').innerText = 1;
                };
                varList.appendChild(btn);
            });
        } else {
            varDiv.classList.add('hidden');
        }

        const btn = document.getElementById('dm-add-btn');
        if(maxStock <= 0) { 
            btn.disabled = true; 
            document.getElementById('dm-add-text').innerText = "OUT OF STOCK";
            btn.className = "flex-1 bg-[var(--bg-input)] text-gray-500 py-3.5 rounded-xl font-bold cursor-not-allowed flex items-center justify-center gap-2"; 
        } else { 
            btn.disabled = false; 
            document.getElementById('dm-add-text').innerText = "ADD TO CART";
            btn.className = "flex-1 bg-emerald-500 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition flex items-center justify-center gap-2 btn-active";
            btn.onclick = () => { 
                if(variations.length > 0 && !this.state.currentSelection) { 
                    Swal.fire({title: 'Select Variation', text: 'Please select an option first.', icon: 'warning', background: '#1e2329', color: '#fff'}); return; 
                } 
                
                const selectedStock = this.state.currentSelection ? parseInt(this.state.currentSelection.stock) : maxStock;
                const cartId = variations.length > 0 ? `${p.id}-${this.state.currentSelection.label}` : p.id;
                const exist = this.state.cart.find(x => x.cartId === cartId);
                const currentInCart = exist ? exist.qty : 0;
                
                if (currentInCart + this.state.modalQty > selectedStock) {
                     this.showToast('Max stock limit reached', 'error');
                     return;
                }
                
                this.addToCart(p.id, this.state.currentSelection, c.discount); 
                this.closeModal(); 
            };
        }
        document.getElementById('details-modal').classList.remove('hidden');
        
        const scrollArea = document.getElementById('dm-scroll-area');
        if (scrollArea) scrollArea.scrollTop = 0;
    },

    async loadProductReviews(productId) {
        const listDiv = document.getElementById('dm-reviews-list');
        listDiv.innerHTML = '<div class="text-center py-6 text-gray-500"><i class="ri-loader-4-line animate-spin text-2xl mb-1 block"></i><span class="text-xs">Loading reviews...</span></div>';
        try {
            const res = await fetch(`${WORKER_URL}?action=get_product_reviews&product_id=${productId}&_t=${Date.now()}`).then(r => r.json());
            if (res.status === 'success' && res.reviews && res.reviews.length > 0) {
                let html = '';
                res.reviews.forEach(r => {
                    const dateObj = new Date(r.created_at);
                    const formattedDate = dateObj.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' });
                    let starsHtml = '<div class="star-cluster">';
                    for (let i = 1; i <= 5; i++) { starsHtml += `<i class="ri-star-fill ${i <= r.rating ? 'active' : ''}"></i>`; }
                    starsHtml += '</div>';
                    const initial = r.customer_name ? r.customer_name.charAt(0).toUpperCase() : 'A';
                    html += `<div class="review-card"><div class="flex justify-between items-start mb-2"><div class="flex gap-3 items-center"><div class="reviewer-avatar">${initial}</div><div><div class="text-sm font-bold text-white flex items-center gap-1">${r.customer_name || 'Anonymous'} <i class="ri-verified-badge-fill text-emerald-500 text-xs" title="Verified Buyer"></i></div><div class="text-[10px] text-gray-500">${formattedDate}</div></div></div>${starsHtml}</div>${r.comment ? `<div class="text-sm text-gray-300 mt-2 leading-relaxed bg-[#2a3038] p-3 rounded-xl">${r.comment}</div>` : ''}</div>`;
                });
                listDiv.innerHTML = html;
            } else {
                listDiv.innerHTML = `<div class="bg-[var(--bg-input)] p-6 rounded-2xl text-center"><i class="ri-chat-smile-2-line text-3xl text-gray-600 block mb-2"></i><div class="text-sm font-bold text-gray-400">No reviews yet</div><p class="text-xs text-gray-500 mt-1">Be the first to review this product.</p></div>`;
            }
        } catch(e) { listDiv.innerHTML = '<div class="text-center text-red-400 text-xs py-4">Failed to load reviews.</div>'; }
    },

    copyProductLink() {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => { this.showToast('Link copied!', 'success'); }).catch(err => { console.error('Failed to copy', err); });
    },

    shareProduct() {
        const url = window.location.href;
        if (navigator.share) { navigator.share({ title: document.getElementById('dm-title').innerText, text: 'Check out this product!', url: url }).catch(console.error); } else { this.copyProductLink(); }
    },

    modalQtyChange(d) { 
        let n = this.state.modalQty + d; 
        if(n < 1) n = 1; 
        
        const maxDisplayed = parseInt(document.getElementById('dm-stock').innerText) || 999;
        if(n > maxDisplayed) {
            this.showToast('Max stock limit reached', 'error');
            return;
        }
        
        this.state.modalQty = n; 
        document.getElementById('dm-qty-display').innerText = n; 
    },
    
    addToCart(id, variant, discount, customQty = null) {
        const p = this.state.products.find(x=>x.id==id);
        const name = variant ? `${p.name} (${variant.label})` : p.name;
        const price = variant ? parseFloat(variant.price) : (discount > 0 ? discount : parseFloat(p.price));
        const weight = variant ? (Number(variant.weight) || Number(p.weight_kg) || 0.5) : (Number(p.weight_kg) || 0.5);
        const cartId = variant ? `${id}-${variant.label}` : id;
        
        const exist = this.state.cart.find(x => x.cartId === cartId);
        const qtyToAdd = customQty !== null ? customQty : this.state.modalQty;

        if(exist) exist.qty += qtyToAdd; 
        else this.state.cart.push({ cartId, id, name, price, img: p.image, weight, qty: qtyToAdd });
        
        this.saveCart(); 
        this.showToast('Added to cart!');
    },
    
    saveCart() { localStorage.setItem('asmr_cart', JSON.stringify(this.state.cart)); this.updateCartUI(); },
    
    updateCartUI() {
        const totalQty = this.state.cart.reduce((a,b)=>a+b.qty,0); 
        document.getElementById('cart-count').innerText = totalQty; 
        document.getElementById('cart-count').classList.toggle('scale-0', totalQty === 0);
        
        const list = document.getElementById('cart-items'); 
        list.innerHTML = ''; 
        let sub = 0;
        
        this.state.cart.forEach(i => { 
            sub += i.price * i.qty; 
            
            const mediaArr = this.parseMedia(i.img);
            let rawImgUrl = mediaArr.length > 0 ? mediaArr[0] : '';
            const finalImg = rawImgUrl ? (this.getYoutubeThumbnail(rawImgUrl) || rawImgUrl) : 'https://placehold.co/400?text=No+Img';
            
            list.innerHTML += `
            <div class="flex gap-4 bg-[var(--bg-card)] p-3 rounded-2xl border border-white/5 shadow-sm">
                <img src="${finalImg}" class="w-16 h-16 object-cover rounded-xl bg-gray-800" loading="lazy">
                <div class="flex-1 min-w-0 py-1 flex flex-col justify-between">
                    <div class="text-xs font-medium text-gray-200 line-clamp-2 leading-snug">${i.name}</div>
                    <div class="flex items-center justify-between mt-1">
                        <div class="text-sm text-white font-bold">RM${i.price.toFixed(2)}</div>
                        <div class="flex items-center gap-3 bg-[var(--bg-input)] rounded-lg px-2 py-0.5">
                            <button onclick="SHOP.changeQty('${i.cartId}',-1)" class="w-5 h-5 flex items-center justify-center font-bold text-gray-400 hover:text-white">-</button>
                            <span class="text-xs font-bold text-white w-3 text-center">${i.qty}</span>
                            <button onclick="SHOP.changeQty('${i.cartId}',1)" class="w-5 h-5 flex items-center justify-center font-bold text-gray-400 hover:text-white">+</button>
                        </div>
                    </div>
                </div>
            </div>`; 
        });
        
        const btnCheckout = document.getElementById('btn-checkout-drawer');
        if(this.state.cart.length === 0) {
            list.innerHTML = `<div class="empty-state">
                <i class="ri-shopping-cart-line text-5xl text-gray-600 mb-3"></i>
                <div class="text-white font-bold text-lg">Cart is empty</div>
                <div class="text-gray-500 text-xs mt-1">Looks like you haven't added anything yet.</div>
            </div>`;
            if (btnCheckout) btnCheckout.disabled = true;
            
            if(this.state.appliedPoints.points > 0) {
                this.state.appliedPoints = { email: null, points: 0, amount: 0 };
                document.getElementById('btn-apply-pt').innerText = 'TEBUS';
                document.getElementById('btn-apply-pt').className = 'bg-amber-500 hover:bg-amber-600 text-gray-900 px-4 py-2 rounded-lg text-xs font-black transition btn-active';
            }
        } else {
            if (btnCheckout) btnCheckout.disabled = false;
        }
        
        let disc = this.state.activeCoupon ? Number(this.state.activeCoupon.val) : 0;
        if (isNaN(disc)) disc = 0;
        if (disc > sub) disc = sub;

        document.getElementById('cart-subtotal').innerText = `RM${sub.toFixed(2)}`; 
        
        const discRow = document.getElementById('discount-row');
        if (disc > 0) {
            discRow.classList.remove('hidden');
            document.getElementById('cart-discount').innerText = `-RM${disc.toFixed(2)}`;
        } else {
            discRow.classList.add('hidden');
        }

        const ptRow = document.getElementById('pt-discount-row');
        let ptDiscAmount = this.state.appliedPoints.amount || 0;
        
        let currentSub = sub - disc;
        if (ptDiscAmount > currentSub) ptDiscAmount = currentSub;

        if (ptDiscAmount > 0) {
            ptRow.classList.remove('hidden');
            document.getElementById('cart-pt-discount').innerText = `-RM${ptDiscAmount.toFixed(2)}`;
        } else {
            ptRow.classList.add('hidden');
        }

        // --- PENGIRAAN BARU UNTUK UI TROLI DENGAN FPX ---
        let baseTotal = sub - disc - ptDiscAmount;
        let isToyyibActive = this.state.settings.toyyib_active !== '0';
        let isChargeCust = this.state.settings.toyyib_charge_cust !== '0';
        let fpxFee = (isToyyibActive && isChargeCust && baseTotal > 0) ? 1.00 : 0;

        const cartFpxRow = document.getElementById('cart-fpx-row');
        if (cartFpxRow) {
            if (fpxFee > 0) cartFpxRow.classList.remove('hidden');
            else cartFpxRow.classList.add('hidden');
        }

        const finalTotal = Math.max(0, baseTotal) + fpxFee;
        document.getElementById('cart-total').innerText = `RM${finalTotal.toFixed(2)}`;

        if (!document.getElementById('checkout-modal').classList.contains('hidden')) {
            this.updateCheckoutSummary();
        }
    },
    
    changeQty(cid, d) { 
        const item = this.state.cart.find(x=>x.cartId===cid); 
        if(item) { 
            const newQty = item.qty + d;
            if(newQty <= 0) {
                this.state.cart = this.state.cart.filter(x=>x.cartId!==cid); 
                this.saveCart(); 
                return;
            }
            
            if (d > 0) {
                const p = this.state.products.find(x=>x.id==item.id);
                let maxStock = 999;
                if(p) {
                    const vars = this.getVariations(p.variations);
                    if(vars.length > 0) {
                        const vLabel = item.cartId.replace(`${p.id}-`, '');
                        const vMatch = vars.find(v => v.label === vLabel);
                        if(vMatch) maxStock = parseInt(vMatch.stock);
                    } else {
                        maxStock = parseInt(this.parseConfig(p.description).stock);
                    }
                }
                if(newQty > maxStock) {
                    this.showToast('Max stock limit reached', 'error');
                    return;
                }
            }

            item.qty = newQty;
            this.saveCart(); 
        } 
    },
    
    toggleCart() { 
        const d = document.getElementById('cart-drawer'), o = document.getElementById('cart-overlay'); 
        const isClosed = d.classList.contains('translate-x-full'); 
        if(isClosed) { d.classList.remove('translate-x-full'); o.classList.remove('hidden'); setTimeout(()=>o.classList.remove('opacity-0'),10); } 
        else { d.classList.add('translate-x-full'); o.classList.add('opacity-0'); setTimeout(()=>o.classList.add('hidden'),300); } 
    },
    
    openCheckout() { 
        if(this.state.cart.length === 0) return; 
        this.toggleCart(); 
        document.getElementById('checkout-modal').classList.remove('hidden'); 
        this.updateCheckoutSummary(); 
    },

    calculateShipping() {
        const state = document.getElementById('ship-state').value;
        if (!state) return 0;

        let hasFreeShipping = false;
        this.state.cart.forEach(item => {
            const prod = this.state.products.find(x => x.id == item.id);
            if(prod && (prod.is_free_shipping === 1 || prod.is_digital === 1)) {
                hasFreeShipping = true;
            }
        });

        if (hasFreeShipping) return 0; 

        const s = this.state.settings || {};
        const isEM = ['SBH', 'SWK', 'LBN'].includes(state);

        const getV = (k) => {
            const v = s[`ship_${k}`] || s[k];
            const num = Number(v);
            if (isNaN(num)) {
                if (k.includes('base') && isEM) return 15.0;
                if (k.includes('base') && !isEM) return 8.0;
                if (k.includes('weight')) return 1.0;
                if (k.includes('add') && isEM) return 5.0;
                if (k.includes('add') && !isEM) return 2.0;
                return 0;
            }
            return num;
        };

        const baseP = isEM ? getV('em_base') : getV('wm_base');
        const baseW = isEM ? getV('em_weight') : getV('wm_weight');
        const addP  = isEM ? getV('em_add') : getV('wm_add');

        const totalW = this.state.cart.reduce((a,b)=> a + ((Number(b.weight) || 0.5) * b.qty), 0);
        const extraW = Math.max(0, totalW - baseW);
        return baseP + (Math.ceil(extraW) * addP);
    },

    updateCheckoutSummary() {
        let sub = 0;
        let itemListHTML = '';
        let hasFreeShipping = false; 
        let isAllDigital = true;
        
        if (this.state.cart.length === 0) isAllDigital = false;

        this.state.cart.forEach(item => {
            const itemTotal = (Number(item.price) || 0) * (Number(item.qty) || 0);
            sub += itemTotal;
            
            const prod = this.state.products.find(x => x.id == item.id);
            if(prod) {
                if(prod.is_free_shipping === 1) hasFreeShipping = true;
                if(prod.is_digital !== 1) isAllDigital = false;
            }

            itemListHTML += `
                <div class="flex justify-between text-sm text-gray-300">
                    <span class="truncate pr-4">${item.name} <span class="text-emerald-400 font-bold ml-1">x${item.qty}</span></span>
                    <span class="font-bold text-white whitespace-nowrap">RM${itemTotal.toFixed(2)}</span>
                </div>
            `;
        });

        document.getElementById('co-item-list').innerHTML = itemListHTML;

        const shipSection = document.getElementById('shipping-details-section');
        const shipState = document.getElementById('ship-state');
        if (isAllDigital) {
            if(shipSection) shipSection.classList.add('hidden');
            if(shipState) shipState.required = false;
        } else {
            if(shipSection) shipSection.classList.remove('hidden');
            if(shipState) shipState.required = true;
        }

        let disc = this.state.activeCoupon ? Number(this.state.activeCoupon.val) : 0;
        if(isNaN(disc)) disc = 0;
        if(disc > sub) disc = sub;
        
        let ptDiscAmount = this.state.appliedPoints.amount || 0;
        let currentSub = sub - disc;
        if (ptDiscAmount > currentSub) ptDiscAmount = currentSub;

        const ship = isAllDigital ? 0 : (this.calculateShipping() || 0);
        
        // PENGIRAAN BASE TOTAL SEBENAR (UNTUK HANTAR KE DATABASE/TOYYIBPAY)
        let baseTotal = (sub - disc - ptDiscAmount + ship);

        // KIRAAN FPX FEE (HANYA UNTUK PAPARAN UI)
        let isToyyibActive = this.state.settings.toyyib_active !== '0';
        let isChargeCust = this.state.settings.toyyib_charge_cust !== '0';
        let fpxFee = (isToyyibActive && isChargeCust && baseTotal > 0) ? 1.00 : 0;

        const shipEl = document.getElementById('co-shipping');
        if (isAllDigital) {
            shipEl.innerHTML = `<span class="bg-purple-500 text-white px-2 py-0.5 rounded text-xs"><i class="ri-file-download-fill"></i> DIGITAL</span>`; 
            shipEl.className = "font-bold text-purple-400";
        } else if(ship === 0 && !document.getElementById('ship-state').value) {
            shipEl.innerText = "Select State"; 
            shipEl.className = "font-bold text-amber-400 animate-pulse";
        } else if (hasFreeShipping) {
            shipEl.innerHTML = `<span class="bg-emerald-500 text-white px-2 py-0.5 rounded text-xs"><i class="ri-truck-fill"></i> FREE POS</span>`; 
            shipEl.className = "font-bold text-emerald-500";
        } else {
            shipEl.innerText = `RM${ship.toFixed(2)}`; 
            shipEl.className = "font-bold text-white";
        }
        
        document.getElementById('co-discount').innerText = `-RM${disc.toFixed(2)}`;
        document.getElementById('co-discount-row').classList.toggle('hidden', disc === 0);
        
        document.getElementById('co-pt-discount').innerText = `-RM${ptDiscAmount.toFixed(2)}`;
        document.getElementById('co-pt-discount-row').classList.toggle('hidden', ptDiscAmount === 0);

        const fpxRow = document.getElementById('co-fpx-row');
        if (fpxRow) {
            if (fpxFee > 0) fpxRow.classList.remove('hidden');
            else fpxRow.classList.add('hidden');
        }
        
        const finalGrand = isNaN(baseTotal) ? 0 : baseTotal;
        const displayTotal = finalGrand + fpxFee;
        
        // PAPAR GRAND TOTAL TERMASUK RM1 (Supaya Pelanggan Tak Terkejut)
        document.getElementById('co-grand-total').innerText = `RM${Math.max(0, displayTotal).toFixed(2)}`;
        
        // HANTAR 'finalGrand' (Harga Tanpa Caj) ke fungsi processOrder
        return { sub, disc, ptDiscAmount, ship, total: finalGrand, isAllDigital };
    },

    openReviewVerifyModal() {
        document.getElementById('verify-review-modal').classList.remove('hidden');
    },

    async verifyReview() {
        const orderId = document.getElementById('vr-order').value.trim();
        const email = document.getElementById('vr-email').value.trim();
        if(!orderId || !email) return this.showToast('Lengkapkan E-mel dan Order ID', 'warning');
        
        const btn = document.getElementById('btn-verify-review');
        btn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i> Menyemak...';
        btn.disabled = true;

        try {
            const res = await fetch(WORKER_URL, {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({action: 'verify_review', order_id: orderId, email: email})
            }).then(r=>r.json());

            if(res.status === 'success') {
                document.getElementById('verify-review-modal').classList.add('hidden');
                this.state.reviewOrder = orderId;
                this.state.reviewName = res.customer_name;
                this.renderReviewItems(res.items);
                document.getElementById('write-review-modal').classList.remove('hidden');
            } else {
                Swal.fire({title:'Ralat', text:res.msg, icon:'error', background: '#1e2329', color: '#fff'});
            }
        } catch(e) {
            this.showToast('Masalah sambungan', 'error');
        } finally {
            btn.innerHTML = 'SAHKAN BELIAN';
            btn.disabled = false;
        }
    },

    renderReviewItems(items) {
        this.state.reviewItemsData = items.map(i => ({ product_id: i.id, name: i.name, rating: 5, comment: '' }));
        const container = document.getElementById('wr-items-container');
        container.innerHTML = '';
        
        items.forEach((item, index) => {
            container.innerHTML += `
                <div class="bg-[var(--bg-input)] p-5 rounded-2xl border border-white/5">
                    <div class="font-bold text-sm text-white mb-3">${item.name}</div>
                    <div class="flex gap-2 mb-4" id="stars-${index}">
                        ${[1,2,3,4,5].map(star => `<i class="ri-star-fill text-3xl cursor-pointer text-amber-400 hover:scale-110 transition-transform" onclick="SHOP.setRating(${index}, ${star})"></i>`).join('')}
                    </div>
                    <textarea oninput="SHOP.updateReviewComment(${index}, this.value)" rows="3" class="w-full p-4 bg-[var(--bg-card)] border border-transparent focus:border-amber-400 rounded-xl text-sm text-white outline-none transition custom-scroll" placeholder="Kongsikan pendapat anda..."></textarea>
                </div>
            `;
        });
    },

    setRating(index, rating) {
        this.state.reviewItemsData[index].rating = rating;
        const starContainer = document.getElementById(`stars-${index}`);
        starContainer.innerHTML = [1,2,3,4,5].map(star => `<i class="ri-star-fill text-3xl cursor-pointer ${star <= rating ? 'text-amber-400' : 'text-gray-600'} hover:scale-110 transition-transform" onclick="SHOP.setRating(${index}, ${star})"></i>`).join('');
    },

    updateReviewComment(index, text) {
        this.state.reviewItemsData[index].comment = text;
    },

    async submitReviews() {
        const btn = document.getElementById('btn-submit-reviews');
        btn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i> Sedang Menghantar...';
        btn.disabled = true;

        try {
            const res = await fetch(WORKER_URL, {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ action: 'submit_review', order_id: this.state.reviewOrder, customer_name: this.state.reviewName, reviews_data: this.state.reviewItemsData })
            }).then(r=>r.json());

            if(res.status === 'success') {
                document.getElementById('write-review-modal').classList.add('hidden');
                Swal.fire({
                    icon: 'success', title: 'Hebat!',
                    text: `Anda telah memenangi ${res.points_earned} Points! Boleh tebus masa checkout nanti.`,
                    background: '#1e2329', color: '#fff', confirmButtonColor: '#10b981'
                });
            } else {
                Swal.fire({title:'Ralat', text:res.msg, icon:'error', background: '#1e2329', color: '#fff'});
            }
        } catch(e) {
            this.showToast('Masalah sambungan', 'error');
        } finally {
            btn.innerHTML = 'HANTAR & TEBUS POINTS';
            btn.disabled = false;
        }
    },

    async checkPoints() {
        const email = document.getElementById('pt-email').value.trim();
        const orderId = document.getElementById('pt-order').value.trim();
        if(!email || !orderId) return this.showToast('Sila masukkan E-mel dan Order ID lama', 'warning');
        
        const btn = document.getElementById('btn-check-pt');
        btn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i>';
        btn.disabled = true;

        try {
            const res = await fetch(WORKER_URL, { 
                method: 'POST', headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify({action: 'check_points', email: email, order_id: orderId}) 
            }).then(r=>r.json());
            
            if(res.status === 'success') {
                if(res.points > 0) {
                    const ptRate = parseFloat(this.state.settings.pt_redeem_value) || 0.10;
                    const amount = res.points * ptRate; 
                    
                    document.getElementById('points-msg').className = 'hidden';
                    document.getElementById('points-action').classList.remove('hidden');
                    document.getElementById('pt-balance-display').innerText = `${res.points} pts (RM${amount.toFixed(2)})`;
                    
                    this.tempPtEmail = email;
                    this.tempPtVal = res.points;
                    this.tempPtAmt = amount;
                } else {
                    document.getElementById('points-msg').className = 'text-xs font-bold mt-3 pl-1 text-red-400';
                    document.getElementById('points-msg').innerHTML = '<i class="ri-information-line"></i> Maaf, tiada point terkumpul.';
                    document.getElementById('points-action').classList.add('hidden');
                }
            } else {
                document.getElementById('points-msg').className = 'text-xs font-bold mt-3 pl-1 text-red-400';
                document.getElementById('points-msg').innerHTML = `<i class="ri-close-circle-line"></i> ${res.msg}`;
                document.getElementById('points-action').classList.add('hidden');
            }
        } catch(e) {
            this.showToast('Ralat sambungan', 'error');
        } finally {
            btn.innerHTML = 'SEMAK';
            btn.disabled = false;
        }
    },

    applyPoints() {
        if(this.state.appliedPoints.points > 0) {
            this.state.appliedPoints = { email: null, points: 0, amount: 0 };
            document.getElementById('btn-apply-pt').innerText = 'TEBUS';
            document.getElementById('btn-apply-pt').className = 'bg-amber-500 hover:bg-amber-600 text-gray-900 px-4 py-2 rounded-lg text-xs font-black transition btn-active';
            this.updateCartUI();
            this.showToast('Point dibatalkan', 'info');
            return;
        }
        this.state.appliedPoints = { email: this.tempPtEmail, points: this.tempPtVal, amount: this.tempPtAmt };
        document.getElementById('btn-apply-pt').innerText = 'BATAL';
        document.getElementById('btn-apply-pt').className = 'bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-black transition btn-active';
        this.updateCartUI();
        this.showToast('Point ditebus!');
    },

    async processOrder() {
        const btn = document.getElementById('btn-pay');
        const totals = this.updateCheckoutSummary();
        
        const name = document.getElementById('cust-name').value.trim();
        const phone = document.getElementById('cust-phone').value.trim();
        const email = document.getElementById('cust-email').value.trim();
        
        let addr = 'DIGITAL';
        let post = 'DIGITAL';
        let state = 'DIGITAL';
        let city = 'DIGITAL';

        if (!totals.isAllDigital) {
            addr = document.getElementById('ship-addr').value.trim();
            post = document.getElementById('ship-postcode').value.trim();
            state = document.getElementById('ship-state').value;
            city = document.getElementById('ship-city').value.trim();

            if(!name || !phone || !email || !addr || !post || !state || !city) { 
                Swal.fire({title:'Incomplete', text:'Please fill in all required fields.', icon:'warning', background: '#1e2329', color: '#fff'}); 
                return; 
            }
            if(!/^\d{5}$/.test(post)) {
                Swal.fire({title:'Invalid Postcode', text:'Postcode must be 5 digits.', icon:'warning', background: '#1e2329', color: '#fff'}); 
                return; 
            }
        } else {
            if(!name || !phone || !email) { 
                Swal.fire({title:'Incomplete', text:'Please fill in your personal details.', icon:'warning', background: '#1e2329', color: '#fff'}); 
                return; 
            }
        }

        const ogText = btn.innerHTML;
        btn.disabled = true; 
        btn.innerHTML = '<i class="ri-loader-4-line animate-spin text-xl"></i> PROCESSING...';
        
        const payload = { 
            action: 'create_customer_order', 
            cust_name: name, cust_phone: phone, cust_email: email, 
            ship_address: addr, ship_city: city, ship_postcode: post, ship_state: state, 
            items: this.state.cart, 
            shipping_cost: totals.ship.toFixed(2), 
            total: totals.total.toFixed(2), 
            return_url: window.location.origin,
            points_used: this.state.appliedPoints.points, 
            points_email: this.state.appliedPoints.email,
            coupon_code: this.state.activeCoupon ? this.state.activeCoupon.code : null
        };
        
        try {
            const res = await fetch(WORKER_URL, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) }).then(r=>r.json());
            if(res.status==='success' && res.payment_url) { 
                localStorage.removeItem('asmr_cart'); 
                window.location.href = res.payment_url; 
            } else { 
                Swal.fire({title:'Transaksi Ditolak', text:res.msg || 'Sistem menolak permintaan anda.', icon:'error', background: '#1e2329', color: '#fff'}); 
                btn.disabled = false; btn.innerHTML = ogText; 
            }
        } catch(e) { 
            Swal.fire({title:'Connection Error', text:'Please check your internet', icon:'error', background: '#1e2329', color: '#fff'}); 
            btn.disabled = false; btn.innerHTML = ogText; 
        }
    },
    applyCoupon() {
        const btn = document.getElementById('btn-apply-coupon');
        const input = document.getElementById('coupon-input');
        const el = document.getElementById('coupon-msg');

        if (this.state.activeCoupon) {
            this.state.activeCoupon = null;
            input.value = '';
            input.disabled = false;
            btn.innerText = 'APPLY';
            btn.className = 'bg-gray-700 hover:bg-gray-600 text-white px-5 py-3 rounded-xl text-xs font-bold transition btn-active w-24 flex items-center justify-center';
            el.classList.add('hidden');
            this.updateCartUI();
            this.showToast('Coupon removed', 'info');
            return;
        }

        const code = input.value.toUpperCase().trim();
        const coupon = this.state.coupons.find(c => c.code === code);
        
        el.classList.remove('hidden', 'text-emerald-500', 'text-red-500');
        
        if(coupon) {
            const limit = parseInt(coupon.max_limit) || 0;
            const used = parseInt(coupon.used_count) || 0;
            
            if (limit > 0 && used >= limit) {
                this.state.activeCoupon = null;
                el.innerHTML = '<i class="ri-close-line"></i> Kupon Telah Habis Ditebus (Expired)'; 
                el.classList.add('text-red-500');
                this.updateCartUI();
                return;
            }

            this.state.activeCoupon = coupon;
            el.innerHTML = '<i class="ri-check-line"></i> Promo Applied!'; 
            el.classList.add('text-emerald-500');
            
            input.disabled = true;
            btn.innerText = 'REMOVE';
            btn.className = 'bg-red-500 hover:bg-red-600 text-white px-5 py-3 rounded-xl text-xs font-bold transition btn-active w-24 flex items-center justify-center';
            this.showToast('Coupon Applied!');
        } else {
            this.state.activeCoupon = null;
            el.innerHTML = '<i class="ri-close-line"></i> Invalid Promo Code'; 
            el.classList.add('text-red-500');
        }
        this.updateCartUI();
    },

    checkPaymentStatus() {
        const p = new URLSearchParams(window.location.search);
        if(p.get('status_id') === '1') { 
            window.history.replaceState({},'',window.location.pathname); 
            Swal.fire({
                icon: 'success',
                title: 'Payment Successful!',
                text: 'Thank you for your purchase.',
                confirmButtonColor: '#10b981',
                background: '#1e2329', color: '#fff'
            }); 
            localStorage.removeItem('asmr_cart'); 
            this.state.cart = []; 
            this.updateCartUI(); 
        }
    }
};

window.onload = () => SHOP.init();
