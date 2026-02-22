function toggleMenu(){
  var sidebar = document.getElementById("sidebar-column");
  if(sidebar) {
    sidebar.classList.toggle("active");
    document.body.style.overflow = sidebar.classList.contains("active") ? "hidden" : "auto";
  }
}

document.addEventListener("DOMContentLoaded", async function() {
    try {
        const res = await fetch("https://shopapi.asmrdhia.com?action=get_shop_settings&_t=" + Date.now());
        const json = await res.json();
        if (json.status === 'success' && json.data && json.data.shop_name) {
            const shopName = json.data.shop_name; 
            const displayTitle = shopName + " Blog"; 
            
            const mobileTitle = document.getElementById('dynamic-mobile-title');
            const sidebarTitle = document.getElementById('dynamic-sidebar-title');
            
            if (mobileTitle) mobileTitle.innerText = displayTitle;
            if (sidebarTitle) sidebarTitle.innerText = displayTitle;
        }
    } catch (e) {
        console.log("Gagal memuatkan nama kedai untuk blog.", e);
    }
});
