// VARIABLES GLOBAL
const SESSION_KEY = "asmr_v3_session";
const WORKER_URL = "https://shopapi.asmrdhia.com";

// --- 1. TUKAR SKRIN ---
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

// --- 2. MODAL FUNCTIONS ---
function showModal() {
    const modal = document.getElementById('modal-logout');
    const content = document.getElementById('modal-content');
    
    modal.style.display = 'flex';
    setTimeout(() => {
        content.style.transform = 'scale(1)';
        content.style.opacity = '1';
    }, 10);
}

function hideModal() {
    const modal = document.getElementById('modal-logout');
    const content = document.getElementById('modal-content');
    
    content.style.transform = 'scale(0.95)';
    content.style.opacity = '0';
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

// --- 3. LOGOUT FUNCTION ---
function handleLogout() {
    showModal();
}

function confirmLogout() {
    localStorage.removeItem(SESSION_KEY);
    document.getElementById('inp-user').value = '';
    document.getElementById('inp-pass').value = '';
    hideModal();
    setTimeout(() => {
        toggleScreen('LOGIN');
    }, 300);
}

// --- 4. FAKE SHAKE ---
window.handleFakeShake = function() {
    const box = document.getElementById('login-box');
    const pass = document.getElementById('inp-pass');
    
    box.classList.remove('shake-now');
    void box.offsetWidth; 
    box.classList.add('shake-now');
    
    pass.value = '';
    pass.focus();
};

// --- 5. SUCCESS LOGIN ---
function doLoginSuccess() {
    const btn = document.querySelector('#login-box button');
    const oldTxt = btn.innerText;
    btn.innerText = "ACCESSING...";
    btn.disabled = true;

    setTimeout(() => {
        localStorage.setItem(SESSION_KEY, 'active');
        toggleScreen('DASHBOARD');
        fetchStats(); 

        btn.innerText = oldTxt;
        btn.disabled = false;
    }, 800);
}

// --- 6. FETCH DATA ---
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
        
        // Guna waktu tempatan (Malaysia) supaya data "Hari Ini" tepat
        const now = new Date();
        const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

        const sales = orders
            .filter(x => ['PAID', 'PROCESSING', 'COMPLETED'].includes(x.status) && x.date === todayStr)
            .reduce((sum, x) => sum + parseFloat(x.total || 0), 0);

        if(document.getElementById('dash-pending')) document.getElementById('dash-pending').innerText = pending;
        if(document.getElementById('dash-products')) document.getElementById('dash-products').innerText = products.length;
        if(document.getElementById('dash-sales')) document.getElementById('dash-sales').innerText = `RM ${sales.toFixed(2)}`;

    } catch (e) { 
        console.log('Error fetching stats:', e); 
    }
}

// --- 7. REPORT MODULE ---
const REPORT = {
    openModal: () => {
        const m = document.getElementById('modal-report');
        const c = document.getElementById('report-content');
        m.style.display = 'flex';
        setTimeout(() => { c.style.opacity = '1'; c.style.transform = 'scale(1)'; }, 10);
        fetchStats();
    },
    
    closeModal: () => {
        const m = document.getElementById('modal-report');
        const c = document.getElementById('report-content');
        c.style.opacity = '0'; c.style.transform = 'scale(0.95)';
        setTimeout(() => { m.style.display = 'none'; }, 300);
    },

    toggleCustomDate: () => {
        const val = document.getElementById('rpt-range').value;
        document.getElementById('rpt-custom-box').classList.toggle('hidden', val !== 'custom');
        document.getElementById('rpt-month-box').classList.toggle('hidden', val !== 'month');
    },

    getLocalDateStr: (d) => {
        return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    },

    generate: async (type, btnElement) => {
        if(globalOrders.length === 0) {
            Swal.fire('Tiada Data', 'Tiada rekod tempahan di dalam sistem.', 'warning');
            return;
        }

        // Tunjukkan Animasi Loading pada Butang
        const originalHTML = btnElement.innerHTML;
        btnElement.innerHTML = `<i class="ri-loader-4-line animate-spin text-2xl text-purple-500 mb-1"></i><span class="text-xs font-bold text-purple-600">Proses...</span>`;
        
        // Kunci semua butang sementara proses berjalan
        const allBtns = document.querySelectorAll('#modal-report button');
        allBtns.forEach(b => b.disabled = true);

        // Sedikit delay supaya UI sempat kemaskini spinner
        await new Promise(res => setTimeout(res, 600));

        try {
            const range = document.getElementById('rpt-range').value;
            let filtered = [];
            const now = new Date();
            const todayStr = REPORT.getLocalDateStr(now);

            // Hanya ambil order yang berjaya / valid
            const validStatus = ['PAID', 'PROCESSING', 'COMPLETED'];
            let sourceData = globalOrders.filter(o => validStatus.includes(o.status));

            // Logik Tarikh (Filter)
            if(range === 'today') {
                filtered = sourceData.filter(o => o.date === todayStr);
            } else if(range === '7') {
                const limitDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
                const limitStr = REPORT.getLocalDateStr(limitDate);
                filtered = sourceData.filter(o => o.date >= limitStr);
            } else if (range === '30') {
                const limitDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
                const limitStr = REPORT.getLocalDateStr(limitDate);
                filtered = sourceData.filter(o => o.date >= limitStr);
            } else if (range === 'month') {
                const mVal = document.getElementById('rpt-month').value; // YYYY-MM
                if(!mVal) throw new Error('Sila pilih bulan laporan.');
                filtered = sourceData.filter(o => o.date.startsWith(mVal));
            } else if (range === 'custom') {
                const start = document.getElementById('rpt-start').value;
                const end = document.getElementById('rpt-end').value;
                if(!start || !end) throw new Error('Sila pilih tarikh mula dan tamat.');
                filtered = sourceData.filter(o => o.date >= start && o.date <= end);
            }

            if(filtered.length === 0) {
                Swal.fire({ toast: true, position: 'top', icon: 'info', title: 'Tiada Jualan', text: 'Tiada rekod untuk tarikh dipilih.', showConfirmButton: false, timer: 3000 });
                return; // Stop execution, it will go to 'finally' block
            }

            // Susun Data (Lama ke Baru)
            filtered.sort((a,b) => new Date(a.date) - new Date(b.date));

            // Setup Data Struktur Table
            const exportData = filtered.map((o, index) => ({
                No: index + 1,
                Tarikh: o.date,
                OrderID: `#${(o.id||'').slice(-6)}`,
                Pelanggan: o.customer_name,
                Status: o.status,
                Total: parseFloat(o.total || 0)
            }));

            const totalSales = exportData.reduce((sum, item) => sum + item.Total, 0);
            let timeLabel = range === 'today' ? todayStr : range;
            const fileName = `Laporan_Jualan_${timeLabel}_${todayStr}`;

            if (type === 'csv' || type === 'xlsx') {
                if(typeof window.XLSX === 'undefined') throw new Error('Library Excel gagal dimuat turun. Periksa internet.');
                
                // Row kosong dan Total
                exportData.push({ No: '', Tarikh: '', OrderID: '', Pelanggan: 'JUMLAH KESELURUHAN (RM)', Status: '', Total: totalSales });
                
                const ws = XLSX.utils.json_to_sheet(exportData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, "Laporan Jualan");
                
                if(type === 'csv') XLSX.writeFile(wb, `${fileName}.csv`);
                else XLSX.writeFile(wb, `${fileName}.xlsx`);
                
            } else if (type === 'pdf') {
                if(typeof window.jspdf === 'undefined') throw new Error('Library PDF gagal dimuat turun. Periksa internet.');
                
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();

                // Header PDF Custom
                doc.setFontSize(18);
                doc.setTextColor(41, 128, 185); // Blue tint
                doc.text(globalShopName.toUpperCase(), 14, 20);
                
                doc.setFontSize(11);
                doc.setTextColor(50, 50, 50);
                doc.text("Penyata Laporan Jualan", 14, 27);
                
                doc.setFontSize(9);
                doc.setTextColor(100, 100, 100);
                let dateSub = (range === 'today') ? `Tarikh Jualan: ${todayStr}` : `Saringan: ${range.toUpperCase()}`;
                doc.text(`${dateSub}  |  Dicetak pada: ${new Date().toLocaleString('ms-MY')}`, 14, 33);

                // AutoTable
                doc.autoTable({
                    startY: 40,
                    head: [['No', 'Tarikh', 'Order ID', 'Pelanggan', 'Status', 'Jumlah (RM)']],
                    body: filtered.map((o, i) => [
                        i + 1, 
                        o.date, 
                        `#${(o.id||'').slice(-6)}`, 
                        o.customer_name, 
                        o.status, 
                        parseFloat(o.total || 0).toFixed(2)
                    ]),
                    foot: [['', '', '', '', 'JUMLAH KESELURUHAN:', `RM ${totalSales.toFixed(2)}`]],
                    theme: 'grid',
                    headStyles: { fillColor: [41, 128, 185] },
                    footStyles: { fillColor: [241, 196, 15], textColor: [0,0,0], fontStyle: 'bold' },
                    styles: { fontSize: 9 }
                });

                doc.save(`${fileName}.pdf`);
            }
            
            // Pop up sukses kecil
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Laporan Berjaya Dimuat Turun!', showConfirmButton: false, timer: 2000 });

        } catch (err) {
            Swal.fire('Ralat Sistem', err.message || 'Gagal menjana laporan. Sila cuba lagi.', 'error');
        } finally {
            // Pulihkan bentuk butang dan buka semula lock
            btnElement.innerHTML = originalHTML;
            allBtns.forEach(b => b.disabled = false);
        }
    }
};

// --- 8. INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    const secret = document.getElementById('secret-key');
    const btnLogout = document.getElementById('btn-logout');
    const modalCancel = document.getElementById('modal-cancel');
    const modalConfirm = document.getElementById('modal-confirm');
    const modalBackdrop = document.getElementById('modal-logout');

    // Check Session
    if (localStorage.getItem(SESSION_KEY)) {
        toggleScreen('DASHBOARD');
        fetchStats(); 
    } else {
        toggleScreen('LOGIN');
    }

    // Logout Button
    if(btnLogout) {
        btnLogout.addEventListener('click', function(e) {
            e.preventDefault();
            handleLogout();
        });
    }

    // Modal Buttons
    if(modalCancel) {
        modalCancel.addEventListener('click', hideModal);
    }
    
    if(modalConfirm) {
        modalConfirm.addEventListener('click', confirmLogout);
    }

    // Click outside modal to close
    if(modalBackdrop) {
        modalBackdrop.addEventListener('click', function(e) {
            if(e.target === modalBackdrop) {
                hideModal();
            }
        });
    }
    
    // Close Report Modal on outside click
    const reportBackdrop = document.getElementById('modal-report');
    if(reportBackdrop) {
        reportBackdrop.addEventListener('click', function(e) {
            if(e.target === reportBackdrop) REPORT.closeModal();
        });
    }

    // Secret Double Click (Bypass Login)
    if(secret) {
        secret.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            doLoginSuccess();
        });
        secret.addEventListener('mousedown', (e) => { 
            if (e.detail > 1) e.preventDefault(); 
        });
    }
});
