(function () {
  const API_HOST = "shopapi.asmrdhia.com";
  const TOKEN_KEY = "admin_token";

  // 1) Read key from URL and store
  const urlParams = new URLSearchParams(window.location.search);
  const key = urlParams.get("key");
  if (key) {
    localStorage.setItem(TOKEN_KEY, key);
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  function isTargetUrl(url) {
    return typeof url === "string" && url.includes(API_HOST);
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function handleAuthFail() {
    // optional: avoid infinite loop
    localStorage.removeItem(TOKEN_KEY);

    // Kau boleh tukar ke /p/login.html kalau ada
    // window.location.href = "/p/admin-login.html";
  }

  // 2) Fetch interceptor (supports string + Request)
  const originalFetch = window.fetch;
  window.fetch = async function (resource, config) {
    const token = getToken();

    try {
      const url = typeof resource === "string" ? resource : (resource && resource.url);
      const target = isTargetUrl(url);

      if (token && target) {
        // If resource is a Request, clone it with header injected
        if (resource instanceof Request) {
          const newHeaders = new Headers(resource.headers);
          newHeaders.set("X-Admin-Token", token);

          resource = new Request(resource, { headers: newHeaders });
        } else {
          config = config || {};
          if (config.headers instanceof Headers) {
            config.headers.set("X-Admin-Token", token);
          } else {
            config.headers = config.headers || {};
            config.headers["X-Admin-Token"] = token;
          }
        }
      }
    } catch (e) {
      // silent
    }

    const res = await originalFetch(resource, config);

    // Auto detect invalid token
    try {
      const resUrl = res?.url || "";
      if (isTargetUrl(resUrl) && (res.status === 401 || res.status === 403)) {
        handleAuthFail();
      }
    } catch (e) {}

    return res;
  };

  // 3) XHR interceptor (domain-filtered)
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  const originalXhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._url = url;
    return originalXhrOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    const token = getToken();
    if (token && this._url && isTargetUrl(this._url)) {
      try {
        this.setRequestHeader("X-Admin-Token", token);
      } catch (e) {}
    }

    this.addEventListener("load", () => {
      try {
        if (this.status === 401 || this.status === 403) handleAuthFail();
      } catch (e) {}
    });

    return originalXhrSend.call(this, body);
  };
})();
