const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const submitBtn = loginForm.querySelector('button[type="submit"]');

function fetchWithTimeout(resource, options = {}) {
    const { timeout = 15000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    return fetch(resource, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(id));
}

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.textContent = "";
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = "Entrando...";

    const formData = new FormData(loginForm);
    const username = (formData.get("username") || "").toString().trim();
    const password = (formData.get("password") || "").toString();

    try {
        if (!API_BASE_URL) throw new Error("API_BASE_URL não configurada");
        // 1) Login primeiro para dar feedback imediato
        const resRaw = await fetchWithTimeout(`${API_BASE_URL}?path=login`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
            body: new URLSearchParams({ username, password })
        });
        const res = await resRaw.json();
        if (!resRaw.ok || res.error) throw new Error(res.error || `Erro ${resRaw.status}`);
        saveToken(res.token);
        // 2) Checar status e decidir para onde ir
        try {
            const st = await fetchWithTimeout(`${API_BASE_URL}?path=status`, { method: 'GET' }).then(r => r.json());
            if (st && st.total && st.done >= st.total) {
                window.location.href = './final.html';
                return;
            }
        } catch { }
        window.location.href = './draw.html';
    } catch (err) {
        loginError.textContent = err.message || "Falha no login";
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        return;
    }
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
});


