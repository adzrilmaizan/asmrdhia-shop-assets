const APP = {
    workerURL: "https://shopapi.asmrdhia.com",
    allOrders: [],
    filteredOrders: [], 
    currentFilter: 'all',
    currentSearch: '',
    shopName: 'kedai kami',
    shopUrl: '', 
    
    currentPage: 1,
    itemsPerPage: 10,

    startLoad: async function() {
        const list = document.getElementById('order-list');
        list.innerHTML = `<div class="flex flex-col items-center justify-center py-24 text-slate-400"><i class="ri-loader-4-line text-5xl animate-spin mb-4 text-blue-500"></i><p class="font-medium">Memuatkan pesanan...</p></div>`;
        document.getElementById('pagination-controls').classList.add('hidden');
        
        try {
            const [resOrders, resSettings] = await Promise.all([
                fetch(this.workerURL + "?action=get_all_orders&_t=" + Date.now()).then(r=>r.json()),
                fetch(this.workerURL + "?action=get_shop_settings&_t=" + Date.now()).then(r=>r.json())
            ]);
            
            this.allOrders = resOrders.orders || (Array.isArray(resOrders) ? resOrders : []);
            
            this.shopName = (resSettings.data && resSettings.data.shop_name) ? resSettings.data.shop_name : 'kedai kami';
            let rawUrl = (resSettings.data && resSettings.data.shop_url) ? resSettings.data.shop_url : window.location.origin;
            this.shopUrl = rawUrl.replace(/\/$/, ""); 
            
            this.updateStats();
            this.processData();
            this.syncUnpaidOrders();
        } catch(e) { 
            list.innerHTML = `<div class="text-center py-20 bg-white rounded-2xl border border-slate-200"><div class="w-16 h-16 mx-auto mb-4 text-rose-400 bg-rose-50 rounded-full flex items-center justify-center"><i class="ri-wifi-off-line text-3xl"></i></div><p class="text-slate-600 font-bold mb-4">Gagal menyambung ke pangkalan data.</p><button onclick="APP.startLoad()" class="btn btn-primary">Cuba lagi</button></div>`; 
        }
    },

    silentRefresh: async function() {
        try {
            const resOrders = await fetch(this.workerURL + "?action=get_all_orders&_t=" + Date.now()).then(r=>r.json());
            this.allOrders = resOrders.orders || (Array.isArray(resOrders) ? resOrders : []);
            this.updateStats();
            this.processData(); 
        } catch(e) {
            console.error('Silent refresh failed', e);
        }
    },

    syncUnpaidOrders: async function() {
        const recentUnpaid = this.allOrders.filter(o => o.status === 'UNPAID' && o.payment_ref).slice(0, 5);
        if(recentUnpaid.length > 0) {
            this.updateStatusText(true);
            let changes = false;
            for(const order of recentUnpaid) {
                try { 
                    const check = await fetch(this.workerURL + `?action=check_payment_status&bill_code=${order.payment_ref}`).then(r=>r.json());
                    if(check.paid) changes = true; 
                } catch(e) {}
            }
            if(changes) {
                await this.silentRefresh();
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Bayaran dikemaskini automatik!', showConfirmButton: false, timer: 3000 });
            }
            this.updateStatusText(false);
        }
    },

    updateStatusText: function(isChecking = false) {
        const filterMap = { 'all': 'semua', 'UNPAID': 'belum bayar', 'PAID': 'telah bayar', 'PROCESSING': 'diproses', 'COMPLETED': 'selesai', 'DELETED': 'sampah' };
        const filterText = filterMap[this.currentFilter] || this.currentFilter.toLowerCase();
        const timeStr = new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' });
        
        let searchText = this.currentSearch ? ` · Cari: "<span class="text-blue-600 font-bold">${this.currentSearch}</span>"` : '';
        
        if (isChecking) {
            document.getElementById('status-text').innerHTML = `<i class="ri-loader-4-line animate-spin text-blue-500"></i> Menyemak status pembayaran...`;
        } else {
            let filterHtml = this.currentFilter === 'all' ? `<span class="secret-trigger" ondblclick="APP.revealDangerZone()">semua</span>` : filterText;
            document.getElementById('status-text').innerHTML = `<i class="ri-checkbox-circle-fill text-emerald-500"></i> Senarai ${filterHtml} status dikemaskini pada ${timeStr} ${searchText}`;
        }
    },

    revealDangerZone: function() {
        document.getElementById('danger-zone-modal').classList.add('active');
    },

    factoryReset: async function() {
        const { value: text } = await Swal.fire({
            title: 'PENGESAHAN AKHIR',
            html: 'Sila taip perkataan <b>RESET</b> di bawah untuk meneruskan pemadaman:',
            input: 'text',
            inputPlaceholder: 'Taip RESET di sini',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Padam Sekarang',
            cancelButtonText: 'Batal'
        });

        if (text === 'RESET') {
            Swal.fire({ title: 'Memadam Data...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
            
            try {
                const res = await fetch(this.workerURL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'factory_reset' })
                }).then(r => r.json());

                if (res.status === 'success') {
                    await Swal.fire('Berjaya!', 'Sistem anda telah dikosongkan sepenuhnya dan sedia untuk bermula baru.', 'success');
                    location.reload(); 
                } else {
                    Swal.fire('Ralat', res.msg, 'error');
                }
            } catch (e) {
                Swal.fire('Ralat', 'Gagal berhubung dengan server.', 'error');
            }
        } else if (text !== undefined) {
            Swal.fire('Dibatalkan', 'Perkataan tidak sepadan. Pemadaman dibatalkan demi keselamatan.', 'info');
        }
    },

    search: function(val) {
        this.currentSearch = val.toLowerCase().trim();
        const clearBtn = document.getElementById('clear-search');
        if(clearBtn) clearBtn.style.display = this.currentSearch ? 'block' : 'none';
        
        this.currentPage = 1; 
        this.processData();
    },

    clearSearch: function() { 
        document.getElementById('search-input').value = ''; 
        document.getElementById('clear-search').style.display = 'none';
        
        this.currentPage = 1; 
        this.search(''); 
    },

    filter: function(status, el) { 
        if(el) { document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active')); el.classList.add('active'); } 
        this.currentFilter = status;
        
        this.currentPage = 1; 
        this.processData();
    },

    processData: function() {
        let result = this.allOrders;
        
        if (this.currentFilter === 'DELETED') result = result.filter(x => x.status === 'DELETED');
        else if (this.currentFilter !== 'all') result = result.filter(x => x.status === this.currentFilter);
        else result = result.filter(x => x.status !== 'DELETED');

        if (this.currentSearch) {
            result = result.filter(o => {
                const term = this.currentSearch;
                const searchFields = [(o.id || '').toLowerCase(), (o.customer_name || '').toLowerCase(), (o.customer_phone || '').toLowerCase(), (o.customer_email || '').toLowerCase(), (o.tracking_number || '').toLowerCase()];
                return searchFields.some(field => field.includes(term));
            });
        }
        
        this.filteredOrders = result;
        
        const totalItems = this.filteredOrders.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        
        if (totalItems === 0) {
            this.currentPage = 1;
        } else if (this.currentPage > totalPages) {
            this.currentPage = totalPages;
        } else if (this.currentPage < 1) {
            this.currentPage = 1;
        }

        this.updatePaginationUI();
        this.updateStatusText(false);
    },

    updatePaginationUI: function() {
        const totalItems = this.filteredOrders.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        const paginationEl = document.getElementById('pagination-controls');

        if (totalItems <= this.itemsPerPage) {
            if (paginationEl) paginationEl.classList.add('hidden');
            this.render(this.filteredOrders);
            return;
        } else {
            if (paginationEl) paginationEl.classList.remove('hidden');
        }

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, totalItems);
        
        const paginatedItems = this.filteredOrders.slice(startIndex, endIndex);

        const infoEl = document.getElementById('pagination-info');
        if(infoEl) infoEl.innerText = `Menunjukkan ${startIndex + 1}-${endIndex} daripada ${totalItems} order`;

        const btnPrev = document.getElementById('btn-prev');
        const btnNext = document.getElementById('btn-next');
        if(btnPrev) btnPrev.disabled = (this.currentPage <= 1);
        if(btnNext) btnNext.disabled = (this.currentPage >= totalPages);

        this.render(paginatedItems);
    },

    prevPage: function() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.updatePaginationUI();
            window.scrollTo({ top: 0, behavior: 'smooth' }); 
        }
    },

    nextPage: function() {
        const totalPages = Math.ceil(this.filteredOrders.length / this.itemsPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.updatePaginationUI();
            window.scrollTo({ top: 0, behavior: 'smooth' }); 
        }
    },

    highlightText: function(text, search) {
        if (!search || !text) return text;
        const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<span class="search-highlight">$1</span>');
    },

    updateStats: function() { 
        document.getElementById('stat-total').innerText = this.allOrders.filter(x => x.status !== 'DELETED').length; 
        document.getElementById('stat-unpaid').innerText = this.allOrders.filter(x => x.status === 'UNPAID').length; 
        document.getElementById('stat-paid').innerText = this.allOrders.filter(x => x.status === 'PAID').length; 
        document.getElementById('stat-deleted').innerText = this.allOrders.filter(x => x.status === 'DELETED').length; 
    },
    
    render: function(orders) {
        const list = document.getElementById('order-list');
        if(orders.length === 0) { 
            list.innerHTML = `<div class="text-center py-20 bg-white rounded-3xl border border-slate-200"><div class="w-16 h-16 mx-auto mb-4 bg-slate-50 rounded-full flex items-center justify-center text-slate-300"><i class="ri-inbox-2-line text-3xl"></i></div><p class="text-slate-500 font-medium">Tiada rekod pesanan dijumpai.</p></div>`;
            return; 
        }
        
        let html = '';
        orders.forEach(o => {
            let badgeClass = 'badge-unpaid';
            let statusText = o.status;
            
            if (o.status === 'PAID') badgeClass = 'badge-paid';
            else if (o.status === 'PROCESSING') badgeClass = 'badge-process';
            else if (o.status === 'COMPLETED') badgeClass = 'badge-completed';
            else if (o.status === 'DELETED') badgeClass = 'badge-deleted';
            
            const orderDate = o.date ? new Date(o.date).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' }) : '';
            let displayName = o.customer_name || 'Pelanggan';
            let displayId = `#${(o.id || '').slice(-6)}`;
            let displayPhone = o.customer_phone || '';
            
            if (this.currentSearch) {
                displayName = this.highlightText(displayName, this.currentSearch);
                displayId = this.highlightText(displayId, this.currentSearch);
                displayPhone = this.highlightText(displayPhone, this.currentSearch);
            }

            html += `
            <div class="order-card">
                <div class="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                    
                    <div class="shrink-0 flex items-center gap-3 md:w-32">
                        <span class="font-mono font-black text-blue-600 text-sm bg-blue-50 px-2 py-1 rounded border border-blue-100">${displayId}</span>
                        ${o.payment_ref ? '<i class="ri-bank-card-fill text-slate-300" title="FPX Payment"></i>' : '<i class="ri-whatsapp-fill text-emerald-400" title="Manual Order"></i>'}
                    </div>

                    <div class="flex-1 min-w-0">
                        <div class="font-bold text-slate-800 text-base truncate mb-1">${displayName}</div>
                        <div class="flex items-center gap-3 text-xs text-slate-500">
                            ${displayPhone ? `<span class="font-medium"><i class="ri-phone-fill mr-1 text-slate-400"></i>${displayPhone}</span>` : ''}
                            <span class="hidden sm:inline text-slate-300">•</span>
                            <span><i class="ri-calendar-2-fill mr-1 text-slate-400"></i>${orderDate}</span>
                        </div>
                    </div>

                    <div class="shrink-0 flex items-center gap-4 md:w-48 justify-between md:justify-end">
                        <span class="amount-badge">RM ${parseFloat(o.total || 0).toFixed(2)}</span>
                        <span class="status-badge ${badgeClass}">${statusText}</span>
                    </div>

                </div>

                <div class="shrink-0 flex items-center gap-2 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 justify-end">
                    ${o.status !== 'DELETED' ? 
                        `<button onclick="APP.deleteOrder('${o.id}')" class="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 rounded-xl transition" title="Padam Order"><i class="ri-delete-bin-line text-lg"></i></button>` : 
                        `<div class="w-10 h-10 flex items-center justify-center text-rose-300 bg-rose-50 rounded-xl"><i class="ri-delete-bin-2-fill text-lg"></i></div>`
                    }
                    <button onclick="APP.showDetail('${o.id}')" class="btn btn-primary px-5"><i class="ri-eye-line mr-1"></i> Detail</button>
                </div>
            </div>`;
        });
        list.innerHTML = html;
    },

    copyText: function(btn) {
        const text = btn.getAttribute('data-copy');
        if (!text) return;
        
        navigator.clipboard.writeText(text).then(() => {
            const originalHTML = btn.innerHTML;
            
            btn.innerHTML = '<i class="ri-check-double-line text-base"></i><span class="text-[10px] font-bold ml-1 tracking-wide">COPIED</span>';
            btn.classList.replace('text-slate-500', 'text-emerald-600');
            btn.classList.replace('hover:text-blue-600', 'hover:text-emerald-600');
            btn.classList.replace('bg-slate-50', 'bg-emerald-50');
            btn.classList.add('border', 'border-emerald-200', 'w-auto', 'px-3');
            
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.classList.replace('text-emerald-600', 'text-slate-500');
                btn.classList.replace('hover:text-emerald-600', 'hover:text-blue-600');
                btn.classList.replace('bg-emerald-50', 'bg-slate-50');
                btn.classList.remove('border', 'border-emerald-200', 'w-auto', 'px-3');
            }, 1500);
        }).catch(() => {
            Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Gagal salin teks!', showConfirmButton: false, timer: 1500 });
        });
    },

    showDetail: function(id) {
        const order = this.allOrders.find(o => String(o.id) === String(id));
        if(!order) return;
        
        document.getElementById('admin-modal-title').innerHTML = `<span>Order</span> <span class="font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100 text-lg">#${(order.id || '').toString().slice(-6)}</span>`;
        
        let reasonHtml = order.status === 'DELETED' ? `<div class="bg-rose-50 text-rose-800 p-4 rounded-xl mb-6 text-sm border border-rose-200 flex items-start gap-3 shadow-sm"><i class="ri-error-warning-fill text-rose-500 text-xl"></i><div><span class="font-bold">Dibatalkan:</span><br>"${order.reason}"</div></div>` : '';
        
        let items = []; 
        try { 
            if (order.items) items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items; 
            if (typeof items === 'string') items = JSON.parse(items); 
        } catch(e){}
        
        const itemsHtml = (Array.isArray(items) ? items : []).map(i => `<div class="flex justify-between py-3 text-sm border-b border-slate-100 last:border-0"><span class="text-slate-700 font-medium">${i.qty}x ${i.name}</span><span class="font-bold text-slate-800">RM ${(parseFloat(i.price||0) * parseInt(i.qty||1)).toFixed(2)}</span></div>`).join('');
        const subtotal = items.reduce((sum, i) => sum + (parseFloat(i.price||0) * parseInt(i.qty||1)), 0);
        const postage = Math.max(0, parseFloat(order.total || 0) - subtotal);
        
        const createCopyBlock = (label, value, isMultiline = false) => {
            if(!value || value === '-') return '';
            const safeAttrValue = value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
            return `
                <div class="flex items-start justify-between gap-3 p-3.5 bg-white rounded-xl border border-slate-200 mb-3 shadow-sm hover:border-blue-200 transition-colors">
                    <div class="flex-1 min-w-0">
                        <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">${label}</div>
                        <div class="text-sm font-bold text-slate-800 ${isMultiline ? 'leading-relaxed whitespace-pre-line' : 'truncate'}">${value}</div>
                    </div>
                    <button onclick="APP.copyText(this)" data-copy="${safeAttrValue}" class="shrink-0 flex items-center justify-center w-9 h-9 bg-slate-50 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded-lg transition" title="Copy ${label}">
                        <i class="ri-file-copy-line text-lg"></i>
                    </button>
                </div>
            `;
        };

        const custName = order.customer_name || 'N/A';
        const custPhone = order.customer_phone || '';
        const custEmail = order.customer_email || '';
        const custAddress = order.ship_address || '';
        
        const bodyHTML = `
            <div class="space-y-6">
                ${reasonHtml}
                
                <div>
                    <h4 class="text-xs font-black text-blue-600 uppercase tracking-widest mb-3 flex items-center gap-2"><div class="w-6 h-6 bg-blue-100 rounded flex items-center justify-center"><i class="ri-user-location-fill text-sm"></i></div> Maklumat Pelanggan</h4>
                    <div class="bg-slate-100 p-3 rounded-2xl border border-slate-200">
                        ${createCopyBlock('Nama Penuh', custName)}
                        ${createCopyBlock('No. Telefon', custPhone)}
                        ${createCopyBlock('E-mel', custEmail)}
                        ${createCopyBlock('Alamat Penghantaran', custAddress, true)}
                    </div>
                </div>
                
                <div>
                    <h4 class="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3 flex items-center gap-2"><div class="w-6 h-6 bg-indigo-100 rounded flex items-center justify-center"><i class="ri-shopping-bag-fill text-sm"></i></div> Item Pesanan</h4>
                    <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                        <div class="space-y-1">${itemsHtml}</div>
                        <div class="mt-4 pt-4 border-t border-dashed border-slate-200 space-y-2">
                            <div class="flex justify-between text-sm"><span class="text-slate-500 font-medium">Subtotal</span><span class="font-bold">RM ${subtotal.toFixed(2)}</span></div>
                            <div class="flex justify-between text-sm"><span class="text-slate-500 font-medium">Pos / Tambahan</span><span class="font-bold">RM ${postage.toFixed(2)}</span></div>
                            <div class="flex justify-between font-black text-lg pt-3 mt-1 border-t border-slate-100 text-slate-900"><span>JUMLAH</span><span class="text-blue-600">RM ${parseFloat(order.total || 0).toFixed(2)}</span></div>
                        </div>
                    </div>
                </div>
                
                ${order.tracking_number ? `
                <div class="bg-gradient-to-r from-blue-50 to-indigo-50 p-5 rounded-2xl border border-blue-100 shadow-sm relative overflow-hidden">
                    <div class="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full -mr-8 -mt-8"></div>
                    <div class="flex justify-between items-center relative z-10">
                        <div>
                            <div class="text-xs font-black text-blue-500 uppercase tracking-widest mb-2">NO. TRACKING</div>
                            <div class="flex items-center gap-3">
                                <div class="font-mono text-xl font-black text-blue-900 bg-white px-3 py-1 rounded-lg border border-blue-200 shadow-sm">${order.tracking_number}</div>
                                <button onclick="APP.copyText(this)" data-copy="${order.tracking_number}" class="flex items-center justify-center text-blue-600 hover:text-white bg-white hover:bg-blue-600 w-10 h-10 rounded-xl shadow-sm border border-blue-200 transition" title="Copy Tracking"><i class="ri-file-copy-line text-lg"></i></button>
                            </div>
                        </div>
                        <button onclick="APP.inputTracking('${order.id}', '${order.tracking_number}')" class="text-blue-500 hover:text-blue-700 bg-white p-3 rounded-xl shadow-sm border border-blue-100 transition" title="Edit Tracking"><i class="ri-edit-2-line text-xl"></i></button>
                    </div>
                </div>` : ''}
            </div>`;
            
        document.getElementById('admin-modal-body').innerHTML = bodyHTML;

        let footerHtml = '';
        if(order.status === 'DELETED') {
            footerHtml = `<div class="w-full text-center text-rose-500 font-bold text-sm bg-rose-50 p-4 rounded-xl border border-rose-100"><i class="ri-delete-bin-2-fill mr-1"></i> Order Dibatalkan</div>`;
        } else if (order.status === 'COMPLETED') {
            footerHtml = `
                <div class="w-full sm:w-1/3 text-center text-emerald-600 font-bold text-sm bg-emerald-50 p-3.5 rounded-xl border border-emerald-100 flex items-center justify-center gap-2"><i class="ri-checkbox-circle-fill text-lg"></i> Selesai</div>
                <button onclick="APP.whatsappCustomer('${order.id}')" class="flex-1 bg-[#25D366] text-white py-3.5 rounded-xl font-bold text-sm hover:bg-[#128C7E] transition shadow-lg shadow-green-200 flex items-center justify-center gap-2"><i class="ri-whatsapp-fill text-xl"></i> WhatsApp Pelanggan</button>
            `;
        } else if (order.status === 'UNPAID') {
            footerHtml = `
                <button onclick="APP.checkPayment('${order.payment_ref}')" class="flex-1 bg-amber-500 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-amber-600 transition shadow-lg shadow-amber-200 flex items-center justify-center gap-2"><i class="ri-refresh-line text-lg"></i> Semak Bayaran</button>
                <button onclick="APP.markPaidManual('${order.id}')" class="flex-1 bg-white border-2 border-slate-200 text-slate-700 py-3.5 rounded-xl font-bold text-sm hover:bg-slate-50 transition flex items-center justify-center gap-2"><i class="ri-check-double-line text-lg"></i> Force Paid</button>
            `;
        } else {
            if(order.tracking_number) {
                 footerHtml = `
                    <div class="flex gap-2 w-full mb-3">
                        <button onclick="addTrackingTimeline('${order.id}')" class="flex-1 bg-blue-600 text-white py-3.5 rounded-xl font-bold text-sm hover:bg-blue-700 transition shadow-sm flex items-center justify-center gap-2"><i class="ri-map-pin-time-line text-lg"></i> Update Tracking</button>
                        <button onclick="copyTrackingLink('${order.id}')" class="flex-1 border border-slate-200 bg-white text-slate-700 py-3.5 rounded-xl font-bold text-sm hover:bg-slate-50 transition shadow-sm flex items-center justify-center gap-2"><i class="ri-links-line text-lg"></i> Copy Link</button>
                    </div>
                    <button onclick="APP.sendEmailAndComplete('${order.id}')" class="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-sm hover:bg-emerald-700 transition shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 uppercase tracking-wide"><i class="ri-mail-send-fill text-lg"></i> Email Resit & Selesai</button>
                 `;
            } else {
                 footerHtml = `<button onclick="APP.inputTracking('${order.id}')" class="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-sm hover:bg-blue-700 transition shadow-lg shadow-blue-200 flex items-center justify-center gap-2 uppercase tracking-wide"><i class="ri-truck-fill text-lg"></i> Masukkan Tracking</button>`;
            }
        }
        document.getElementById('admin-modal-footer').innerHTML = footerHtml;
        document.getElementById('admin-specific-modal').classList.add('active');
    },

    closeModal: function() { 
        document.getElementById('admin-specific-modal').classList.remove('active'); 
    },

    whatsappCustomer: function(id) {
        const order = this.allOrders.find(o => String(o.id) === String(id));
        if (!order) return;
        let phone = order.customer_phone || '';
        phone = phone.replace(/\D/g, ''); 
        if (phone.startsWith('0')) phone = '6' + phone;

        let items = [];
        try { items = JSON.parse(order.items || '[]'); } catch(e) {}
        let itemNames = items.map(i => i.name).join(', ');
        
        const reviewUrl = this.shopUrl;

        let msg = `Hai ${order.customer_name},\n\nTerima kasih kerana membeli di ${this.shopName}. Pesanan anda (Order #${order.id.slice(-6)}) telah berjaya diproses.`;
        if (order.tracking_number) msg += `\n\n📦 *Info Penghantaran:*\nNo. Tracking: ${order.tracking_number}`;
        
        msg += `\n\nNanti dah terima ${itemNames}, mohon layari kedai kami ${reviewUrl} dan tekan butang "Earn Points" di atas untuk beri ulasan dan kumpul point diskaun ya!`;

        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    },

    inputTracking: async function(id, currentVal = '') {
        const { value: trackingNo } = await Swal.fire({ title: 'No. Tracking', input: 'text', inputValue: currentVal, inputPlaceholder: 'Cth: JNT123456789', showCancelButton: true, confirmButtonText: 'Simpan', cancelButtonText: 'Batal', confirmButtonColor: '#3b82f6' });
        if (trackingNo) {
            Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
            try {
                const res = await fetch(this.workerURL, { method: 'POST', body: JSON.stringify({ action: 'save_tracking_manual', order_id: id, tracking_number: trackingNo }), headers:{'Content-Type':'application/json'} }).then(r=>r.json());
                if(res.status === 'success') {
                    await Swal.fire({ icon: 'success', title: 'Tersimpan!', text: 'No. tracking telah dikemaskini', timer: 1500, showConfirmButton: false });
                    this.closeModal(); 
                    this.silentRefresh(); 
                } else Swal.fire('Ralat', res.msg, 'error');
            } catch(e) { Swal.fire('Ralat Rangkaian', e.message, 'error'); }
        }
    },

    checkPayment: async function(billCode) {
        if(!billCode) return;
        Swal.fire({ title: 'Menyemak ToyyibPay...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
        try {
            const res = await fetch(this.workerURL + "?action=check_payment_status&bill_code=" + billCode).then(r=>r.json());
            if(res.paid) { 
                await Swal.fire({ icon: 'success', title: 'Bayaran Diterima!', text: 'Status pesanan ditukar ke PAID', timer: 1500, showConfirmButton: false }); 
                this.closeModal(); 
                this.silentRefresh(); 
            } else { 
                Swal.fire({ icon: 'info', title: 'Belum Dibayar', text: 'Pelanggan belum membuat pembayaran FPX.', confirmButtonColor: '#3b82f6' }); 
            }
        } catch(e) { Swal.fire('Ralat', e.message, 'error'); }
    },

    markPaidManual: async function(id) {
        const result = await Swal.fire({ title: 'Sahkan Bayaran?', text: "Anda pasti pelanggan ini telah membayar secara manual?", icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Sahkan', confirmButtonColor: '#10b981' });
        if (result.isConfirmed) {
            Swal.fire({ title: 'Memproses...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
            try {
                const res = await fetch(this.workerURL, { method: 'POST', body: JSON.stringify({action:'manual_mark_paid', order_id:id}), headers:{'Content-Type':'application/json'} }).then(r=>r.json());
                if(res.status === 'success') {
                    await Swal.fire({ icon: 'success', title: 'Berjaya', text: 'Status ditukar ke PAID', timer: 1500, showConfirmButton: false });
                    this.closeModal(); 
                    this.silentRefresh(); 
                } else {
                    Swal.fire('Ralat', res.msg, 'error');
                }
            } catch(e) { Swal.fire('Ralat Rangkaian', e.message, 'error'); }
        }
    },
    
    sendEmailAndComplete: async function(id) {
        const order = this.allOrders.find(o => String(o.id) === String(id));
        if (!order) return;
        
        let items = [];
        try { items = JSON.parse(order.items || '[]'); } catch(e) {}
        
        let itemText = ""; 
        let subtotal = 0;
        let itemNamesArray = [];
        
        items.forEach((item, index) => {
            let itemTotal = parseFloat(item.price) * parseInt(item.qty);
            subtotal += itemTotal;
            itemText += `${index + 1}. ${item.name} (x${item.qty}) - RM${itemTotal.toFixed(2)}\n`;
            itemNamesArray.push(item.name);
        });
        
        let itemNames = itemNamesArray.join(', ');
        
        const reviewUrl = this.shopUrl;
        
        let grandTotal = parseFloat(order.total);
        let postage = Math.max(0, grandTotal - subtotal);
        
        const subject = `Tracking Order #${order.id.slice(-6)} - ${order.customer_name}`;
        
        const body = `Hai ${order.customer_name},\n\nTerima kasih kerana membeli di ${this.shopName}!\nBerikut adalah pesanan anda:\n\n${itemText}\nSubtotal: RM${subtotal.toFixed(2)}\nPostage: RM${postage.toFixed(2)}\nJUMLAH: RM${grandTotal.toFixed(2)}\n\nSTATUS PENGHANTARAN:\nNo. Tracking: ${order.tracking_number}\n\nNanti dah terima ${itemNames}, mohon layari kedai kami ${reviewUrl} dan tekan butang "Earn Points" di atas untuk beri ulasan ya!`;

        window.open(`mailto:${order.customer_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
        
        Swal.fire({ title: 'Menyelesaikan order...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
        
        try {
            const res = await fetch(this.workerURL, { method: 'POST', body: JSON.stringify({action:'mark_completed', order_id:id}), headers:{'Content-Type':'application/json'} }).then(r=>r.json());
            if(res.status === 'success') {
                await Swal.fire({ icon: 'success', title: 'Selesai!', text: 'Pesanan telah dilengkapkan dan ditutup.', timer: 1500, showConfirmButton: false });
                this.closeModal(); 
                this.silentRefresh(); 
            } else {
                Swal.fire('Ralat', res.msg, 'error');
            }
        } catch (e) {
            Swal.fire('Ralat Rangkaian', 'Gagal memproses. Sila periksa internet anda.', 'error');
        }
    },

    deleteOrder: async function(id) {
        const { value: reason } = await Swal.fire({ title: 'Padam Order?', input: 'textarea', inputPlaceholder: 'Sila nyatakan sebab...', showCancelButton: true, confirmButtonText: 'Padam', confirmButtonColor: '#ef4444' });
        if (reason) {
            Swal.fire({ title: 'Memadam...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });
            try {
                const res = await fetch(this.workerURL, { method: 'POST', body: JSON.stringify({ action: 'delete_order', id: id, reason: reason }), headers: { 'Content-Type': 'application/json' } }).then(r=>r.json());
                if(res.status === 'success') {
                    await Swal.fire({ icon: 'success', title: 'Dipadam!', text: 'Order telah dimasukkan ke senarai Sampah.', showConfirmButton: false, timer: 1500 });
                    this.closeModal(); 
                    this.silentRefresh(); 
                } else {
                    Swal.fire('Ralat', res.msg, 'error');
                }
            } catch(e) { Swal.fire('Ralat Rangkaian', e.message, 'error'); }
        }
    }
};

window.onload = () => APP.startLoad();
