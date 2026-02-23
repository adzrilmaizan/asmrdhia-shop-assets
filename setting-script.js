const SETTING = {
    workerURL: "https://shopapi.asmrdhia.com",
    couponList: [],

    init: async function() {
        this.bindEvents();
        await this.loadSettings();
        await this.loadCoupons();
    },

    // 5. EVENT LISTENERS (Update Sidebar Real-time)
    bindEvents: function() {
        ['shop_name', 'shop_phone', 'shop_url', 'toyyib_key', 'toyyib_cat', 'telegram_bot_token', 'telegram_chat_id'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => SETTING.updateSidebar());
        });
    },

    loadSettings: async function() {
        try {
            const res = await fetch(this.workerURL + "?action=get_shop_settings&_t=" + Date.now()).then(r => r.json());
            if (res.status === 'success' && res.data) {
                const data = res.data;
                const fields = ['shop_name', 'shop_url', 'shop_phone', 'shop_address', 'shop_postcode', 'toyyib_key', 'toyyib_cat', 'ship_wm_base', 'ship_wm_weight', 'ship_wm_add', 'ship_em_base', 'ship_em_weight', 'ship_em_add', 'telegram_bot_token', 'telegram_chat_id', 'pt_reward_star', 'pt_reward_comment', 'pt_reward_long', 'pt_redeem_value'];
                
                fields.forEach(f => {
                    const el = document.getElementById(f);
                    if (el && data[f] !== undefined) el.value = data[f];
                });

                // 7. DEFAULT VALUES
                const elToyyibActive = document.getElementById('toyyib_active');
                if (elToyyibActive) elToyyibActive.value = data.toyyib_active !== undefined ? data.toyyib_active : "1";
                
                const elToyyibCharge = document.getElementById('toyyib_charge_cust');
                if (elToyyibCharge) elToyyibCharge.value = data.toyyib_charge_cust !== undefined ? data.toyyib_charge_cust : "1";

                this.updateSidebar();

                // 1. LOADING INDICATOR
                const loader = document.getElementById('loading-indicator');
                const content = document.getElementById('settings-content');
                if (loader) loader.classList.add('hidden');
                if (content) content.classList.remove('hidden');
            }
        } catch(e) { console.error("Gagal load tetapan", e); }
    },

    // 6. DETAILED SIDEBAR STATUS
    updateSidebar: function() {
        const name = document.getElementById('shop_name')?.value.trim() || '';
        const phone = document.getElementById('shop_phone')?.value.trim() || '';
        const url = document.getElementById('shop_url')?.value.trim() || '';
        const tKey = document.getElementById('toyyib_key')?.value.trim() || '';
        const tCat = document.getElementById('toyyib_cat')?.value.trim() || '';
        const tActive = document.getElementById('toyyib_active')?.value || '1';
        const tgToken = document.getElementById('telegram_bot_token')?.value.trim() || '';
        const tgChat = document.getElementById('telegram_chat_id')?.value.trim() || '';

        const display = document.getElementById('sidebar-shop-name');
        if(display) {
            display.innerHTML = `<span class="font-black text-slate-800 tracking-tight text-xl">${name || 'Nama Kedai'}</span><div class="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest"><i class="ri-link text-emerald-500 mr-1"></i>${(url || 'url_kedai.com').replace('https://','').replace('http://','')}</div>`;
        }

        // Profile Status
        const isProfileComplete = name && phone && url;
        const elProf = document.getElementById('status-profile');
        if(elProf) {
            elProf.innerHTML = isProfileComplete ? `<i class="ri-checkbox-circle-fill text-emerald-500 mr-1"></i>LENGKAP` : `<i class="ri-error-warning-fill text-amber-500 mr-1"></i>TIDAK LENGKAP`;
            elProf.className = isProfileComplete ? "text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded shadow-sm uppercase" : "text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-1 rounded shadow-sm uppercase";
        }

        // Payment Status
        const isToyyib = tKey && tCat && tActive === '1';
        const elPay = document.getElementById('status-payment');
        if(elPay) {
            elPay.innerHTML = isToyyib ? `<i class="ri-checkbox-circle-fill text-emerald-500 mr-1"></i>TOYYIBPAY` : `<i class="ri-information-fill text-blue-500 mr-1"></i>MANUAL`;
            elPay.className = isToyyib ? "text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded shadow-sm uppercase" : "text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-1 rounded shadow-sm uppercase";
        }

        // Telegram Status
        const isTg = tgToken && tgChat;
        const elTg = document.getElementById('status-telegram');
        if(elTg) {
            elTg.innerHTML = isTg ? `<i class="ri-checkbox-circle-fill text-emerald-500 mr-1"></i>AKTIF` : `<i class="ri-error-warning-fill text-amber-500 mr-1"></i>TIDAK AKTIF`;
            elTg.className = isTg ? "text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded shadow-sm uppercase" : "text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-1 rounded shadow-sm uppercase";
        }
    },

    // 2. FORM VALIDATION
    validateForm: function() {
        const name = document.getElementById('shop_name')?.value.trim();
        const url = document.getElementById('shop_url')?.value.trim();
        const phone = document.getElementById('shop_phone')?.value.trim();
        const postcode = document.getElementById('shop_postcode')?.value.trim();

        if (!name) { Swal.fire('Tidak Lengkap', 'Sila masukkan Nama Kedai.', 'warning'); return false; }
        if (!url) { Swal.fire('Tidak Lengkap', 'Sila masukkan URL Kedai.', 'warning'); return false; }
        
        if (phone) {
            const cleanPhone = phone.replace(/\D/g, '');
            if (cleanPhone.length < 9 || cleanPhone.length > 12) {
                Swal.fire('Format Salah', 'No. Telefon bimbit mestilah antara 9 hingga 12 digit nombor.', 'warning'); return false;
            }
        }

        if (postcode && !/^\d{5}$/.test(postcode)) {
            Swal.fire('Format Salah', 'Poskod mestilah 5 digit nombor (Cth: 43000).', 'warning'); return false;
        }

        const rates = ['ship_wm_base', 'ship_wm_weight', 'ship_wm_add', 'ship_em_base', 'ship_em_weight', 'ship_em_add'];
        for(let r of rates) {
            const val = document.getElementById(r)?.value;
            if(val && parseFloat(val) < 0) {
                Swal.fire('Format Salah', 'Kadar pos/berat mestilah nombor positif atau 0.', 'warning'); return false;
            }
        }
        return true;
    },

    // 8. CONFIRM SAVE
    confirmSave: async function() {
        if(!this.validateForm()) return;

        const { isConfirmed } = await Swal.fire({
            title: 'Simpan Tetapan?',
            text: "Pastikan semua maklumat yang dimasukkan adalah tepat.",
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            confirmButtonText: 'Ya, Simpan',
            cancelButtonText: 'Batal'
        });

        if (isConfirmed) {
            await this.saveSettings();
        }
    },

    saveSettings: async function() {
        const btn = document.getElementById('btn-save');
        const ogText = btn.innerHTML;
        btn.innerHTML = '<i class="ri-loader-4-line animate-spin mr-1"></i> Menyimpan...';
        btn.disabled = true;
        Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });

        // PEMBETULAN STRUKTUR PAYLOAD
        const payload = {
            action: 'save_shop_settings',
            admin_token: 'Adzril2!' // <--- HARDCODED PASSWORD DI SINI
        };
        
        const keys = ['shop_name', 'shop_url', 'shop_phone', 'shop_address', 'shop_postcode', 'toyyib_key', 'toyyib_cat', 'toyyib_active', 'toyyib_charge_cust', 'ship_wm_base', 'ship_wm_weight', 'ship_wm_add', 'ship_em_base', 'ship_em_weight', 'ship_em_add', 'telegram_bot_token', 'telegram_chat_id', 'pt_reward_star', 'pt_reward_comment', 'pt_reward_long', 'pt_redeem_value'];
        
        // Loop ini akan memasukkan data dari form ke dalam payload secara automatik
        keys.forEach(k => { 
            const el = document.getElementById(k);
            if (el) {
                payload[k] = el.value;
            } 
        });

        try {
            const res = await fetch(this.workerURL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(r=>r.json());
            if (res.status === 'success') {
                this.updateSidebar();
                await Swal.fire({ icon: 'success', title: 'Tersimpan!', text: 'Tetapan kedai telah dikemaskini.', timer: 1500, showConfirmButton: false });
            } else throw new Error(res.msg);
        } catch(e) { Swal.fire('Ralat Penyimpanan', e.message, 'error'); } 
        finally { btn.innerHTML = ogText; btn.disabled = false; }
    },

    // 3. PREVIEW SHOP
    previewShop: function() {
        let url = document.getElementById('shop_url')?.value.trim();
        if(!url) {
            Swal.fire('Tiada URL', 'Sila masukkan dan simpan URL kedai terlebih dahulu.', 'info');
            return;
        }
        if(!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        window.open(url, '_blank');
    },

    // 4. TOGGLE PASSWORD
    togglePassword: function(inputId, iconId) {
        const input = document.getElementById(inputId);
        const icon = document.getElementById(iconId);
        if(input && icon) {
            if(input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('ri-eye-off-line');
                icon.classList.add('ri-eye-line');
            } else {
                input.type = 'password';
                icon.classList.remove('ri-eye-line');
                icon.classList.add('ri-eye-off-line');
            }
        }
    },

    testTelegram: async function() {
        const token = document.getElementById('telegram_bot_token').value;
        const chat = document.getElementById('telegram_chat_id').value;
        if(!token || !chat) { Swal.fire('Tidak Lengkap', 'Isi Token & Chat ID dahulu', 'warning'); return; }
        
        const btn = document.getElementById('btn-test-tg');
        const ogHTML = btn.innerHTML;
        btn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i> Uji...';
        btn.disabled = true;
        
        try {
            const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ chat_id: chat, text: "🟢 UJIAN SISTEM: Integrasi Telegram berjaya dipasang dengan DhiaCloud!" })
            });
            const data = await res.json();
            if(data.ok) Swal.fire('Berjaya!', 'Sila semak Telegram anda.', 'success');
            else throw new Error(data.description);
        } catch(e) { Swal.fire('Gagal', e.message, 'error'); }
        finally { btn.innerHTML = ogHTML; btn.disabled = false; }
    },

    // --- COUPON MODULE ---
    loadCoupons: async function() {
        try {
            const res = await fetch(this.workerURL + "?action=get_coupons&_t=" + Date.now()).then(r => r.json());
            if (res.status === 'success') {
                this.couponList = res.coupons || [];
                this.renderCoupons();
            }
        } catch(e) { console.log('Gagal load kupon', e); }
    },

    renderCoupons: function() {
        const list = document.getElementById('coupon-list');
        if(!list) return;

        if(this.couponList.length === 0) {
            list.innerHTML = `<div class="p-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50"><i class="ri-coupon-3-line text-3xl mb-2"></i><p class="text-sm font-medium">Tiada kupon aktif.</p></div>`;
            return;
        }

        list.innerHTML = this.couponList.map(c => `
            <div class="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm group hover:border-emerald-200 transition">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center font-black text-lg border border-emerald-100">
                        %
                    </div>
                    <div>
                        <div class="font-black text-slate-800 text-lg uppercase tracking-wide">${c.code}</div>
                        <div class="text-xs text-slate-500 font-medium">Potongan RM${parseFloat(c.val).toFixed(2)} • Limit: ${parseInt(c.max_limit)===0 ? 'Tiada Had' : c.max_limit} • Guna: <span class="text-emerald-600 font-bold">${c.used_count || 0}</span></div>
                    </div>
                </div>
                <button onclick="SETTING.deleteCoupon('${c.code}')" class="w-10 h-10 flex items-center justify-center bg-rose-50 text-rose-500 rounded-lg opacity-0 group-hover:opacity-100 transition hover:bg-rose-500 hover:text-white" title="Padam Kupon"><i class="ri-delete-bin-line text-lg"></i></button>
            </div>
        `).join('');
    },

    addCoupon: async function() {
        const code = document.getElementById('cpn-code').value.trim().toUpperCase();
        const val = document.getElementById('cpn-val').value;
        const target = 'ALL';
        const limit = document.getElementById('cpn-limit').value || 0;

        if(!code || !val) { Swal.fire('Tidak Lengkap', 'Kod Kupon dan Nilai Potongan wajib diisi.', 'warning'); return; }

        const payload = { 
            action: 'add_coupon', 
            code, val, target, limit,
            admin_token: "Adzril2!" // <--- HARDCODED PASSWORD UNTUK KUPON JUGA
        };

        const btn = document.getElementById('btn-add-cpn');
        const ogHTML = btn.innerHTML;
        btn.innerHTML = '<i class="ri-loader-4-line animate-spin"></i>';
        btn.disabled = true;

        try {
            const res = await fetch(this.workerURL, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) }).then(r=>r.json());
            if(res.status === 'success') {
                document.getElementById('cpn-code').value = '';
                document.getElementById('cpn-val').value = '';
                document.getElementById('cpn-limit').value = '';
                await this.loadCoupons();
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
                const res = await fetch(this.workerURL, { 
                    method: 'POST', 
                    headers: {'Content-Type':'application/json'}, 
                    body: JSON.stringify({ 
                        action: 'delete_coupon', 
                        code: code, 
                        admin_token: "Adzril2!" // <--- HARDCODED PASSWORD UNTUK DELETE KUPON
                    }) 
                }).then(r=>r.json());
                
                if(res.status === 'success') {
                    await this.loadCoupons();
                    Swal.close();
                } else throw new Error(res.msg);
            } catch(e) { Swal.fire('Ralat', e.message, 'error'); }
        }
    },

    switchTab: function(tabId) {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.tab-btn').forEach(el => {
            el.classList.remove('bg-blue-50', 'text-blue-600', 'border-blue-200');
            el.classList.add('bg-white', 'text-slate-600', 'border-slate-200');
        });

        document.getElementById(`tab-${tabId}`).classList.remove('hidden');
        const activeBtn = document.getElementById(`btn-tab-${tabId}`);
        if(activeBtn) {
            activeBtn.classList.remove('bg-white', 'text-slate-600', 'border-slate-200');
            activeBtn.classList.add('bg-blue-50', 'text-blue-600', 'border-blue-200');
        }
    }
};

window.onload = () => SETTING.init();
