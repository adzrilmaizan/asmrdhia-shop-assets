const SETTING = {
    workerURL: "https://shopapi.asmrdhia.com",
    state: { settings: {} },
    
    init: async function() {
        try {
            const resSettings = await fetch(this.workerURL + "?action=get_shop_settings&_t=" + Date.now()).then(r=>r.json());
            if (resSettings.status === 'success') this.state.settings = resSettings.data || {};

            const keys = ['shop_name', 'shop_url', 'shop_phone', 'shop_address', 'shop_postcode', 'toyyib_key', 'toyyib_cat', 'toyyib_active', 'toyyib_charge_cust', 'ship_wm_base', 'ship_wm_weight', 'ship_wm_add', 'ship_em_base', 'ship_em_weight', 'ship_em_add', 'telegram_bot_token', 'telegram_chat_id'];
            
            keys.forEach(k => { 
                if (this.state.settings[k] !== undefined && document.getElementById(k)) {
                    document.getElementById(k).value = this.state.settings[k]; 
                }
            });

            if(document.getElementById('toyyib_active').value === "") document.getElementById('toyyib_active').value = "1";
            if(document.getElementById('toyyib_charge_cust').value === "") document.getElementById('toyyib_charge_cust').value = "1";

            this.updateSidebar();
            document.getElementById('loading-indicator').classList.add('hidden');
            document.getElementById('settings-content').classList.remove('hidden');
        } catch(e) { Swal.fire('Ralat Teras', 'Gagal memuatkan pangkalan data.', 'error'); }
    },

    togglePassword: function(inputId, iconId) {
        const input = document.getElementById(inputId);
        const icon = document.getElementById(iconId);
        if (input.type === "password") {
            input.type = "text"; icon.classList.replace('ri-eye-off-line', 'ri-eye-line'); icon.classList.add('text-blue-500');
        } else {
            input.type = "password"; icon.classList.replace('ri-eye-line', 'ri-eye-off-line'); icon.classList.remove('text-blue-500');
        }
    },

    updateSidebar: function() {
        const name = document.getElementById('shop_name')?.value;
        const phone = document.getElementById('shop_phone')?.value;
        const url = document.getElementById('shop_url')?.value;
        
        const profileEl = document.getElementById('stat-profile');
        if (name && phone && url) profileEl.innerHTML = '<span class="text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100 shadow-sm"><i class="ri-checkbox-circle-fill mr-1"></i> LENGKAP</span>';
        else profileEl.innerHTML = '<span class="text-amber-600 bg-amber-50 px-3 py-1 rounded-lg border border-amber-100 shadow-sm"><i class="ri-error-warning-fill mr-1"></i> TAK LENGKAP</span>';

        const tKey = document.getElementById('toyyib_key')?.value;
        const tCat = document.getElementById('toyyib_cat')?.value;
        const tActive = document.getElementById('toyyib_active')?.value;
        
        const paymentEl = document.getElementById('stat-payment');
        if (tKey && tCat && tActive === '1') paymentEl.innerHTML = '<span class="text-blue-600 font-bold bg-blue-50 px-3 py-1 rounded-lg border border-blue-100 shadow-sm"><i class="ri-link-m"></i> TOYYIBPAY</span>';
        else paymentEl.innerHTML = '<span class="text-slate-500 font-bold bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 shadow-sm"><i class="ri-whatsapp-line"></i> MANUAL</span>';
        
        const tgKey = document.getElementById('telegram_bot_token')?.value;
        const tgID = document.getElementById('telegram_chat_id')?.value;
        const tgEl = document.getElementById('stat-telegram');
        if (tgKey && tgID) tgEl.innerHTML = '<span class="text-[#0088cc] font-bold bg-[#0088cc]/10 px-3 py-1 rounded-lg border border-[#0088cc]/20 shadow-sm"><i class="ri-telegram-fill"></i> AKTIF</span>';
        else tgEl.innerHTML = '<span class="text-slate-400 font-bold bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 shadow-sm">TIDAK AKTIF</span>';
    },

    validateForm: function() {
        const name = document.getElementById('shop_name').value.trim();
        const url = document.getElementById('shop_url').value.trim();
        const phone = document.getElementById('shop_phone').value.replace(/\D/g, ''); 
        const post = document.getElementById('shop_postcode').value.trim();

        if (!name) return "Sila masukkan Nama Kedai.";
        if (!url) return "Sila masukkan URL Kedai Utama.";
        if (phone.length < 9 || phone.length > 12) return "Format Nombor Telefon tidak sah.";
        
        const postRegex = /^\d{5}$/;
        if (!postRegex.test(post)) return "Poskod mestilah mengandungi 5 angka (Cth: 43000).";

        const shipFields = ['ship_wm_base', 'ship_wm_weight', 'ship_wm_add', 'ship_em_base', 'ship_em_weight', 'ship_em_add'];
        for (let f of shipFields) {
            let val = parseFloat(document.getElementById(f).value);
            if (isNaN(val) || val < 0) return "Sila pastikan semua kos penghantaran diisi dengan nombor positif.";
        }

        return null; 
    },

    confirmSave: async function() {
        const errorMsg = this.validateForm();
        if (errorMsg) return Swal.fire('Maklumat Tidak Lengkap', errorMsg, 'warning');

        const result = await Swal.fire({ title: 'Simpan Tetapan?', text: "Pastikan semua maklumat adalah tepat.", icon: 'question', showCancelButton: true, confirmButtonText: 'Ya, Simpan', confirmButtonColor: '#2563eb' });
        if (result.isConfirmed) this.saveSettings();
    },

    saveSettings: async function() {
        const btn = document.getElementById('btn-save');
        const ogText = btn.innerHTML;
        btn.innerHTML = '<i class="ri-loader-4-line animate-spin mr-1"></i> Menyimpan...';
        btn.disabled = true;
        Swal.fire({ title: 'Menyimpan...', didOpen: () => Swal.showLoading(), allowOutsideClick: false });

        const payload = { action: 'save_shop_settings' };
        
        const keys = ['shop_name', 'shop_url', 'shop_phone', 'shop_address', 'shop_postcode', 'toyyib_key', 'toyyib_cat', 'toyyib_active', 'toyyib_charge_cust', 'ship_wm_base', 'ship_wm_weight', 'ship_wm_add', 'ship_em_base', 'ship_em_weight', 'ship_em_add', 'telegram_bot_token', 'telegram_chat_id'];
        
        keys.forEach(k => { if (document.getElementById(k)) payload[k] = document.getElementById(k).value; });

        try {
            const res = await fetch(this.workerURL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(r=>r.json());
            if (res.status === 'success') {
                this.updateSidebar();
                await Swal.fire({ icon: 'success', title: 'Tersimpan!', text: 'Tetapan kedai telah dikemaskini.', timer: 1500, showConfirmButton: false });
            } else throw new Error(res.msg);
        } catch(e) { Swal.fire('Ralat Penyimpanan', e.message, 'error'); } 
        finally { btn.innerHTML = ogText; btn.disabled = false; }
    },

    previewShop: function() {
        let url = document.getElementById('shop_url').value;
        if (!url) { Swal.fire('URL Kosong', 'Sila isi ruangan URL Kedai Utama terlebih dahulu.', 'info'); return; }
        if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;
        window.open(url, '_blank');
    }
};

window.addEventListener('load', () => SETTING.init());

['shop_name', 'shop_phone', 'shop_url', 'toyyib_key', 'toyyib_cat', 'telegram_bot_token', 'telegram_chat_id'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => SETTING.updateSidebar());
});
