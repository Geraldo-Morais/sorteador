const currentUserEl = document.getElementById("currentUser");
const logoutBtn = document.getElementById("logoutBtn");
const statusText = document.getElementById("statusText");
const progress = document.getElementById("progress");
const progressText = document.getElementById("progressText");
const drawBtn = document.getElementById("drawBtn");
const drawError = document.getElementById("drawError");
const resultSection = document.getElementById("resultSection");
const resultName = document.getElementById("resultName");
const resetBtn = document.getElementById("resetBtn");
const completedWrap = document.getElementById("completedWrap");
const completedList = document.getElementById("completedList");

function fetchWithTimeout(resource, options = {}) {
    const { timeout = 15000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    return fetch(resource, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(id));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

logoutBtn.addEventListener("click", () => {
    clearToken();
    window.location.href = "./";
});

async function loadMe() {
    try {
        if (!API_BASE_URL) throw new Error("API_BASE_URL não configurada");
        // Redireciona se já concluiu geral
        try {
            const st = await fetch(`${API_BASE_URL}?path=status`).then(r => r.json());
            if (st && st.total && st.done >= st.total) {
                window.location.href = './final.html';
                return;
            }
        } catch { }
        const token = getToken();
        if (!token) throw new Error("Sessão inválida");
        const url = `${API_BASE_URL}?path=me&Authorization=${encodeURIComponent('Bearer ' + token)}`;
        const resRaw = await fetch(url, { method: "GET" });
        const me = await resRaw.json();
        if (!resRaw.ok || me.error) throw new Error(me.error || `Erro ${resRaw.status}`);
        currentUserEl.textContent = me.username || "";
        if (me.assignedTo) {
            statusText.textContent = `Você realizou seu sorteio em ${new Date(me.assignedAt).toLocaleString()}`;
            resultSection.classList.remove("hidden");
            resultName.textContent = me.assignedTo;
            drawBtn.disabled = true;
            drawBtn.textContent = "Sorteio já realizado";
        } else {
            statusText.textContent = "Você ainda não realizou seu sorteio.";
        }

        // Carregar progresso geral e habilitar reset se admin (GERALDO)
        await loadStatus(me.username);
    } catch (err) {
        // token inválido ou expirado
        clearToken();
        window.location.href = "./";
    }
}

async function loadStatus(username) {
    try {
        const resRaw = await fetch(`${API_BASE_URL}?path=status`, { method: "GET" });
        const st = await resRaw.json();
        if (st && typeof st.total === 'number') {
            progress.classList.remove("hidden");
            progressText.textContent = `Progresso: ${st.done}/${st.total} concluídos`;
        }
        if (username === 'GERALDO') {
            resetBtn.classList.remove("hidden");
            await loadCompletedList();
        }
    } catch { }
}

async function loadCompletedList() {
    try {
        const res = await fetch(`${API_BASE_URL}?path=progress`, { method: 'GET' });
        const data = await res.json();
        if (Array.isArray(data.doneNames)) {
            completedWrap.classList.remove('hidden');
            completedList.innerHTML = '';
            data.doneNames.forEach(n => {
                const li = document.createElement('li');
                li.textContent = n;
                completedList.appendChild(li);
            });
        }
    } catch { }
}

drawBtn.addEventListener("click", async () => {
    drawError.textContent = "";
    drawBtn.disabled = true;
    drawBtn.textContent = "Sorteando...";
    try {
        if (!API_BASE_URL) throw new Error("API_BASE_URL não configurada");
        const token = getToken();
        let resRaw = await fetchWithTimeout(`${API_BASE_URL}?path=draw`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
            body: new URLSearchParams({ token: `Bearer ${token}` })
        });
        // Retry rápido em caso de 429 (limite Apps Script) ou abort (frio)
        if (resRaw.status === 429 || resRaw.type === 'opaqueredirect') {
            await sleep(800);
            resRaw = await fetchWithTimeout(`${API_BASE_URL}?path=draw`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                body: new URLSearchParams({ token: `Bearer ${token}` }),
                timeout: 20000
            });
        }
        const res = await resRaw.json();
        if (!resRaw.ok || res.error) throw new Error(res.error || `Erro ${resRaw.status}`);
        resultSection.classList.remove("hidden");
        resultName.textContent = res.assignedTo;
        statusText.textContent = `Você realizou seu sorteio em ${new Date(res.assignedAt).toLocaleString()}`;
        drawBtn.textContent = "Sorteio realizado";
    } catch (err) {
        drawError.textContent = err.message || "Erro ao sortear";
        drawBtn.disabled = false;
        drawBtn.textContent = "Fazer meu sorteio";
    }
});

resetBtn?.addEventListener("click", async () => {
    try {
        const token = getToken();
        if (!token) throw new Error("Sessão inválida");
        resetBtn.disabled = true;
        resetBtn.textContent = "Resetando...";
        const resRaw = await fetch(`${API_BASE_URL}?path=reset`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
            body: new URLSearchParams({ token: `Bearer ${token}` })
        });
        const res = await resRaw.json();
        if (res.error) throw new Error(res.error);
        // Recarregar tela
        window.location.reload();
    } catch (e) {
        drawError.textContent = e.message || "Falha ao resetar";
        resetBtn.disabled = false;
        resetBtn.textContent = "Resetar sorteio (admin)";
    }
});

loadMe();


