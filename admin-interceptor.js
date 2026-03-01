(function () {
  const API_HOST = "shopapi.asmrdhia.com";

  // 1) Read key from URL and store
  const urlParams = new URLSearchParams(window.location.search);
  const key = urlParams.get("key");
  if (key) {
    localStorage.setItem("admin_token", key);
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  // 2) Fetch interceptor (only for your API)
  const originalFetch = window.fetch;
  window.fetch = async function (resource, config) {
    try {
      const token = localStorage.getItem("admin_token");
      const url = typeof resource === "string" ? resource : (resource?.url || "");
      const isTarget = url.includes(API_HOST);

      if (token && isTarget) {
        config = config || {};
        config.headers = config.headers || {};

        if (config.headers instanceof Headers) config.headers.set("X-Admin-Token", token);
        else config.headers["X-Admin-Token"] = token;
      }
    } catch (e) {}
    return originalFetch(resource, config);
  };

  // 3) XHR interceptor (already domain-filtered)
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  const originalXhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._url = url;
    return originalXhrOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    const token = localStorage.getItem("admin_token");
    if (token && this._url && this._url.includes(API_HOST)) {
      this.setRequestHeader("X-Admin-Token", token);
    }
    return originalXhrSend.call(this, body);
  };
})();
