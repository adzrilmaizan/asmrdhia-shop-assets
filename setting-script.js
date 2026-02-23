const SETTING = {
    workerURL: "https://shopapi.asmrdhia.com",
    masterPass: "Adzril2!", // HARDCODED PASSWORD

    init: async function() {
        this.bindEvents();
        await this.loadSettings();
    },

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
                const fields = ['shop_name', 'shop_url', 'shop_phone', 'shop_address', 'shop_postcode', 'toyyib_key', 'toyyib_cat', 'ship_wm_base', 'ship_wm_weight', 'ship_wm_add', 'ship_em_base', 'ship_em_weight', 'ship_em_add', 'telegram_bot_token', 'telegram_chat_id'];
                
                fields.forEach(f => {
                    const el = document.getElementById(f);
                    if (el && data[f] !== undefined) el.value = data[f];
                });

                const elToyyibActive = document.getElementById('toyyib_active');
                if (elToyyibActive) elToyyibActive.value = data.toyyib_active !== undefined ? data.toyyib_active : "1";
                
                const elToyyibCharge = document.getElementById('toyyib_charge_cust');
                if (elToyyibCharge) elToyyibCharge.value = data.toyyib_charge_cust !== undefined ? data.toyyib_charge_cust : "1";

                this.updateSidebar();

                const loader = document.getElementById('loading-indicator');
                const content = document.getElementById('settings-content');
                if (loader) loader.classList.add('hidden');
                if (content) content.classList.remove('hidden');
            }
        } catch(e) { console.error("Gagal load tetapan", e); }
    },

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
        if(display) display.innerHTML = `<span class="font-black text-slate-800 tracking-tight text-xl">${name || 'Nama Kedai'}</span><div class="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest"><i class="ri-link text-emerald-500 mr-1"></i>${(url || 'url_kedai.com').replace('https://','').replace('http://','')}</div>`;

        const isProfileComplete = name && phone && url;
        const elProf = document.getElementById('status-profile');
        if(elProf) {
            elProf.innerHTML = isProfileComplete ? `<i class="ri-checkbox-circle-fill text-emerald-500 mr-1"></i>LENGKAP` : `<i class="ri-error-warning-fill text-amber-500 mr-1"></i>TIDAK LENGKAP`;
            elProf.className = isProfileComplete ? "text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded shadow-sm uppercase" : "text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-1 rounded shadow-sm uppercase";
        }

        const isToyyib = tKey && tCat && tActive === '1';
        const elPay = document.getElementById('status-payment');
        if(elPay) {
            elPay.innerHTML = isToyyib ? `<i class="ri-checkbox-circle-fill text-emerald-500 mr-1"></i>TOYYIBPAY` : `<i class="ri-information-fill text-blue-500 mr-1"></i>MANUAL`;
            elPay.className = isToyyib ? "text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded shadow-sm uppercase" : "text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-1 rounded shadow-sm uppercase";
        }

        const isTg = tgToken && tgChat;
        const elTg = document.getElementById('status-telegram');
        if(elTg) {
            elTg.innerHTML = isTg ? `<i class="ri-checkbox-circle-fill text-emerald-500 mr-1"></i>AKTIF` : `<i class="ri-error-warning-fill text-amber-500 mr-1"></i>TIDAK AKTIF`;
            elTg.className = isTg ? "text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded shadow-sm uppercase" : "text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-1 rounded shadow-sm uppercase";
        }
    },

    validateForm: function() {
        const name = document.getElementById('shop_name')?.value.trim();
        const url = document.getElementById('shop_url')?.value.trim();
        if (!name) { Swal.fire('Tidak Lengkap', 'Sila masukkan Nama Kedai.', 'warning'); return false; }
        if (!url) { Swal.fire('Tidak Lengkap', 'Sila masukkan URL Kedai.', 'warning'); return false; }
        return true;
    },

    confirmSave: async function() {
        if(!this.validateForm()) return;
        const { isConfirmed } = await Swal.fire({ title: 'Simpan Tetapan?', text: "Pastikan semua maklumat tepat.", icon: 'question', showCancelButton: true, confirmButtonColor: '#10b981', confirmButtonText: 'Ya, Simpan', cancelButtonText: 'Batal' });
        if (isConfirmed) await this.saveSettings();
    },

    saveSettings: async function() {
        const btn = document.getElementById('btn-save');
        const ogText = btn.innerHTML;
        btn.innerHTML = '<i class="ri-loader-4-line animate-spin mr-1"></i> Menyimpan...';
        btn.disabled = true;
        Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });

        const payload = {
            action: 'save_shop_settings',
            admin_token: this.masterPass // HARDCODED!
        };
        
        const keys = ['shop_name', 'shop_url', 'shop_phone', 'shop_address', 'shop_postcode', 'toyyib_key', 'toyyib_cat', 'toyyib_active', 'toyyib_charge_cust', 'ship_wm_base', 'ship_wm_weight', 'ship_wm_add', 'ship_em_base', 'ship_em_weight', 'ship_em_add', 'telegram_bot_token', 'telegram_chat_id'];
        
        keys.forEach(k => { const el = document.getElementById(k); if (el) payload[k] = el.value; });

        try {
            const res = await fetch(this.workerURL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(r=>r.json());
            if (res.status === 'success') {
                this.updateSidebar();
                await Swal.fire({ icon: 'success', title: 'Tersimpan!', text: 'Tetapan kedai telah dikemaskini.', timer: 1500, showConfirmButton: false });
            } else throw new Error(res.msg);
        } catch(e) { Swal.fire('Ralat', e.message, 'error'); } 
        finally { btn.innerHTML = ogText; btn.disabled = false; }
    },

    previewShop: function() {
        let url = document.getElementById('shop_url')?.value.trim();
        if(url) window.open(url.startsWith('http') ? url : 'https://' + url, '_blank');
    },

    togglePassword: function(inputId, iconId) {
        const input = document.getElementById(inputId); const icon = document.getElementById(iconId);
        if(input && icon) {
            input.type = input.type === 'password' ? 'text' : 'password';
            icon.className = input.type === 'password' ? 'ri-eye-off-line text-xl' : 'ri-eye-line text-xl';
        }
    }
};

window.onload = () => SETTING.init();
