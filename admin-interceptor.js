(function () {
  const urlParams = new URLSearchParams(window.location.search);
  const keyFromUrl = urlParams.get('key');

  if (keyFromUrl) {
    localStorage.setItem('admin_token', keyFromUrl);
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  const token = localStorage.getItem('admin_token');

  if (!token) {
    const promptKey = prompt("Masukkan Admin Key:");
    if (promptKey) {
      localStorage.setItem('admin_token', promptKey.trim());
      location.reload();
    }
  }

  const originalFetch = window.fetch;
  window.fetch = async function (resource, config) {
    const storedToken = localStorage.getItem('admin_token');
    if (storedToken) {
      config = config || {};
      config.headers = config.headers || {};
      config.headers['X-Admin-Token'] = storedToken;
    }
    return originalFetch(resource, config);
  };

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this._url = url;
    return origOpen.apply(this, arguments);
  };

  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body) {
    const storedToken = localStorage.getItem('admin_token');
    if (storedToken && this._url && this._url.includes('shopapi.asmrdhia.com')) {
      this.setRequestHeader('X-Admin-Token', storedToken);
    }
    return origSend.call(this, body);
  };
})();
