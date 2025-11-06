const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.textContent = "";

    const formData = new FormData(loginForm);
    const username = (formData.get("username") || "").toString().trim();
    const password = (formData.get("password") || "").toString();

    try {
        // Se todos já concluíram, redireciona para a página final
        try {
            const st = await fetch(`${API_BASE_URL}?path=status`).then(r => r.json());
            if (st && st.total && st.done >= st.total) {
                window.location.href = './final.html';
                return;
            }
        } catch { }
        if (!API_BASE_URL) throw new Error("API_BASE_URL não configurada");
        const resRaw = await fetch(`${API_BASE_URL}?path=login`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
            body: new URLSearchParams({ username, password })
        });
        const res = await resRaw.json();
        if (!resRaw.ok || res.error) throw new Error(res.error || `Erro ${resRaw.status}`);
        saveToken(res.token);
        window.location.href = "./draw.html";
    } catch (err) {
        loginError.textContent = err.message || "Falha no login";
    }
});


