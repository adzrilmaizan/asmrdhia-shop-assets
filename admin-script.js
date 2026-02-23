// VARIABLES GLOBAL
const SESSION_KEY = "asmr_v3_session";
const WORKER_URL = "https://shopapi.asmrdhia.com";

function toggleScreen(screenName) {
    const elLogin = document.getElementById('screen-login');
    const elDash = document.getElementById('screen-dashboard');
    if (screenName === 'DASHBOARD') {
        elLogin.style.display = 'none';
        elDash.style.display = 'block';
    } else {
        elLogin.style.display = 'flex';
        elDash.style.display = 'none';
    }
}

function showModal() {
    const modal = document.getElementById('modal-logout');
    const content = document.getElementById('modal-content');
    modal.style.display = 'flex';
    setTimeout(() => { content.style.transform = 'scale(1)'; content.style.opacity = '1'; }, 10);
}

function hideModal() {
    const modal = document.getElementById('modal-logout');
    const content = document.getElementById('modal-content');
    content.style.transform = 'scale(0.95)'; content.style.opacity = '0';
    setTimeout(() => { modal.style.display = 'none'; }, 300);
}

function handleLogout() { showModal(); }

// LOGOUT: PENTING - Clear semua memori
function confirmLogout() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('admin_secret_token');
    document.getElementById('inp-user').value = '';
    document.getElementById('inp-pass').value = '';
    hideModal();
    setTimeout(() => { toggleScreen('LOGIN'); }, 300);
}

window.handleFakeShake = function() {
    const box = document.getElementById('login-box');
    box.classList.remove('shake-now');
    void box.offsetWidth; 
    box.classList.add('shake-now');
    const passInput = document.getElementById('inp-pass');
    if(passInput) { passInput.value = ''; passInput.focus(); }
};

// BERJAYA MASUK
function doLoginSuccess(pass = null) {
    localStorage.setItem(SESSION_KEY, 'active'); 
    // Hanya simpan password kalau ia didatangkan dari login rasmi
    if (pass !== null && pass !== "") {
        localStorage.setItem('admin_secret_token', pass); 
    }
    toggleScreen('DASHBOARD');
    fetchStats(); 
}

let globalOrders = []; 
let globalShopName = "KEDAI SAYA";

async function fetchStats() {
    try {
        const [o, p, s] = await Promise.all([
            fetch(WORKER_URL + "?action=get_all_orders").then(r => r.json()),
            fetch(WORKER_URL + "?action=get_menu_data").then(r => r.json()),
            fetch(WORKER_URL + "?action=get_shop_settings").then(r => r.json())
        ]);
        const orders = o.orders || [];
        const products = p.menus || [];
        globalOrders = orders; 
        if (s.data && s.data.shop_name) globalShopName = s.data.shop_name;
        const pending = orders.filter(x => x.status === 'UNPAID' || x.status === 'PROCESSING').length;
        const now = new Date();
        const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        const sales = orders.filter(x => ['PAID', 'PROCESSING', 'COMPLETED'].includes(x.status) && x.date === todayStr).reduce((sum, x) => sum + parseFloat(x.total || 0), 0);
        if(document.getElementById('dash-pending')) document.getElementById('dash-pending').innerText = pending;
        if(document.getElementById('dash-products')) document.getElementById('dash-products').innerText = products.length;
        if(document.getElementById('dash-sales')) document.getElementById('dash-sales').innerText = `RM ${sales.toFixed(2)}`;
    } catch (e) { console.log('Error fetching stats:', e); }
}

const REPORT = {
    openModal: () => {
        const m = document.getElementById('modal-report'); const c = document.getElementById('report-content');
        m.style.display = 'flex'; setTimeout(() => { c.style.opacity = '1'; c.style.transform = 'scale(1)'; }, 10);
        fetchStats();
    },
    closeModal: () => {
        const m = document.getElementById('modal-report'); const c = document.getElementById('report-content');
        c.style.opacity = '0'; c.style.transform = 'scale(0.95)'; setTimeout(() => { m.style.display = 'none'; }, 300);
    },
    toggleCustomDate: () => {
        const val = document.getElementById('rpt-range').value;
        document.getElementById('rpt-custom-box').classList.toggle('hidden', val !== 'custom');
        document.getElementById('rpt-month-box').classList.toggle('hidden', val !== 'month');
    },
    getLocalDateStr: (d) => { return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0]; },
    generate: async (type, btnElement) => {
        if(globalOrders.length === 0) { Swal.fire('Tiada Data', 'Tiada rekod.', 'warning'); return; }
        const originalHTML = btnElement.innerHTML;
        btnElement.innerHTML = `<i class="ri-loader-4-line animate-spin text-2xl text-purple-500 mb-1"></i><span class="text-xs font-bold text-purple-600">Proses...</span>`;
        document.querySelectorAll('#modal-report button').forEach(b => b.disabled = true);
        await new Promise(res => setTimeout(res, 600));

        try {
            const range = document.getElementById('rpt-range').value; let filtered = [];
            const todayStr = REPORT.getLocalDateStr(new Date());
            const sourceData = globalOrders.filter(o => ['PAID', 'PROCESSING', 'COMPLETED'].includes(o.status));

            if(range === 'today') { filtered = sourceData.filter(o => o.date === todayStr); } 
            else if(range === '7') { const limitStr = REPORT.getLocalDateStr(new Date(Date.now() - (7 * 24 * 60 * 60 * 1000))); filtered = sourceData.filter(o => o.date >= limitStr); } 
            else if(range === '30') { const limitStr = REPORT.getLocalDateStr(new Date(Date.now() - (30 * 24 * 60 * 60 * 1000))); filtered = sourceData.filter(o => o.date >= limitStr); } 
            else if (range === 'month') { const mVal = document.getElementById('rpt-month').value; if(!mVal) throw new Error('Pilih bulan.'); filtered = sourceData.filter(o => o.date.startsWith(mVal)); } 
            else if (range === 'custom') { const start = document.getElementById('rpt-start').value; const end = document.getElementById('rpt-end').value; if(!start || !end) throw new Error('Pilih tarikh.'); filtered = sourceData.filter(o => o.date >= start && o.date <= end); }

            if(filtered.length === 0) { Swal.fire({ toast: true, position: 'top', icon: 'info', title: 'Tiada Jualan', showConfirmButton: false, timer: 3000 }); return; }

            filtered.sort((a,b) => new Date(a.date) - new Date(b.date));
            const exportData = filtered.map((o, index) => ({ No: index + 1, Tarikh: o.date, OrderID: `#${(o.id||'').slice(-6)}`, Pelanggan: o.customer_name, Status: o.status, Total: parseFloat(o.total || 0) }));
            const totalSales = exportData.reduce((sum, item) => sum + item.Total, 0);
            const fileName = `Laporan_Jualan_${todayStr}`;

            if (type === 'csv' || type === 'xlsx') {
                exportData.push({ No: '', Tarikh: '', OrderID: '', Pelanggan: 'JUMLAH KESELURUHAN (RM)', Status: '', Total: totalSales });
                const ws = XLSX.utils.json_to_sheet(exportData); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Laporan Jualan");
                XLSX.writeFile(wb, `${fileName}.${type}`);
            } else if (type === 'pdf') {
                const { jsPDF } = window.jspdf; const doc = new jsPDF();
                doc.setFontSize(18); doc.setTextColor(41, 128, 185); doc.text(globalShopName.toUpperCase(), 14, 20);
                doc.setFontSize(11); doc.setTextColor(50, 50, 50); doc.text("Penyata Laporan Jualan", 14, 27);
                doc.setFontSize(9); doc.setTextColor(100, 100, 100); let dateSub = (range === 'today') ? `Tarikh Jualan: ${todayStr}` : `Saringan: ${range.toUpperCase()}`; doc.text(`${dateSub}  |  Dicetak pada: ${new Date().toLocaleString('ms-MY')}`, 14, 33);
                doc.autoTable({ startY: 40, head: [['No', 'Tarikh', 'Order ID', 'Pelanggan', 'Status', 'Jumlah (RM)']], body: filtered.map((o, i) => [i + 1, o.date, `#${(o.id||'').slice(-6)}`, o.customer_name, o.status, parseFloat(o.total || 0).toFixed(2)]), foot: [['', '', '', '', 'JUMLAH KESELURUHAN:', `RM ${totalSales.toFixed(2)}`]], theme: 'grid', headStyles: { fillColor: [41, 128, 185] }, footStyles: { fillColor: [241, 196, 15], textColor: [0,0,0], fontStyle: 'bold' }, styles: { fontSize: 9 } });
                doc.save(`${fileName}.pdf`);
            }
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Dimuat Turun!', showConfirmButton: false, timer: 2000 });
        } catch (err) { Swal.fire('Ralat', err.message, 'error'); } 
        finally { btnElement.innerHTML = originalHTML; document.querySelectorAll('#modal-report button').forEach(b => b.disabled = false); }
    }
};

document.addEventListener("DOMContentLoaded", () => {
    
    // 1. MATA HANYA UNTUK TENGOK PASSWORD
    const btnShowPass = document.getElementById('btn-show-pass');
    if(btnShowPass) {
        btnShowPass.addEventListener('click', function(e) {
            e.preventDefault();
            const inpPass = document.getElementById('inp-pass');
            const iconPass = document.getElementById('icon-pass');
            if(inpPass.type === 'password') {
                inpPass.type = 'text';
                iconPass.classList.replace('ri-eye-off-line', 'ri-eye-line');
            } else {
                inpPass.type = 'password';
                iconPass.classList.replace('ri-eye-line', 'ri-eye-off-line');
            }
        });
    }

    // 2. BUTANG LOGIN SEBENAR (TEGAS)
    const loginBtn = document.getElementById('btn-login-main');
    if(loginBtn) {
        loginBtn.onclick = async function(e) {
            e.preventDefault();
            const user = document.getElementById('inp-user').value.trim();
            const pass = document.getElementById('inp-pass').value;
            
            if(!user || !pass) { 
                window.handleFakeShake(); 
                return; 
            }

            const oldTxt = loginBtn.innerText;
            loginBtn.innerText = "MENGESAHKAN...";
            loginBtn.disabled = true;

            try {
                const res = await fetch(WORKER_URL, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'verify_login', admin_token: pass })
                }).then(r => r.json());

                if(res.status === 'success') {
                    doLoginSuccess(pass); 
                } else {
                    window.handleFakeShake();
                    Swal.fire({ toast: true, position: 'top', icon: 'error', title: 'Akses Dihalang', text: 'Kata laluan salah!', showConfirmButton: false, timer: 3000 });
                }
            } catch(err) {
                Swal.fire('Ralat Rangkaian', 'Gagal menyambung ke server', 'error');
            } finally {
                loginBtn.innerText = oldTxt;
                loginBtn.disabled = false;
            }
        };
    }

    // 3. FAKE LOGIN READ ONLY (DOUBLE CLICK OR)
    const secretOr = document.getElementById('secret-key');
    if(secretOr) {
        secretOr.addEventListener('dblclick', (e) => {
            e.preventDefault(); e.stopPropagation();
            // Masuk read-only: Token dihantar sebagai NULL
            doLoginSuccess(null); 
        });
        secretOr.addEventListener('mousedown', (e) => { if (e.detail > 1) e.preventDefault(); });
    }

    if (localStorage.getItem(SESSION_KEY)) {
        toggleScreen('DASHBOARD');
        fetchStats(); 
    } else {
        toggleScreen('LOGIN');
    }

    const btnLogout = document.getElementById('btn-logout');
    if(btnLogout) btnLogout.addEventListener('click', (e) => { e.preventDefault(); handleLogout(); });
    document.getElementById('modal-cancel')?.addEventListener('click', hideModal);
    document.getElementById('modal-confirm')?.addEventListener('click', confirmLogout);
    document.getElementById('modal-logout')?.addEventListener('click', (e) => { if(e.target.id === 'modal-logout') hideModal(); });
    document.getElementById('modal-report')?.addEventListener('click', (e) => { if(e.target.id === 'modal-report') REPORT.closeModal(); });
});
