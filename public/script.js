const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");
const sendBtn = document.getElementById("send-btn");

// Menyimpan riwayat percakapan agar sesuai format array req.body.message di index.js
let conversationHistory = [
    { role: "assistant", content: "Halo! Ada yang bisa saya bantu?" }
];

function appendMessage(role, text) {
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", role);

    const bubble = document.createElement("div");
    bubble.classList.add("bubble");
    bubble.textContent = text;

    msgDiv.appendChild(bubble);
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    return bubble;
}

chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const text = userInput.value.trim();
    if (!text) return;

    // Tampilkan pesan user ke UI dan simpan ke riwayat
    appendMessage("user", text);
    conversationHistory.push({ role: "user", content: text });

    userInput.value = "";
    userInput.disabled = true;
    sendBtn.disabled = true;

    // Buat bubble kosong untuk menampung jawaban bot secara streaming
    const botBubble = appendMessage("bot", "...");
    let botReply = "";

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: conversationHistory
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || "Gagal terhubung ke server.");
        }

        // Membaca Server-Sent Events (SSE) stream dari backend Express
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        botBubble.textContent = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop();

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith("data: ")) continue;

                const dataStr = trimmed.slice(6).trim();
                if (dataStr === "[DONE]") break;

                try {
                    const parsed = JSON.parse(dataStr);
                    if (parsed.content) {
                        botReply += parsed.content;
                        botBubble.textContent = botReply;
                        chatBox.scrollTop = chatBox.scrollHeight;
                    } else if (typeof parsed === "string") {
                        // Menangani pesan error string dari blok catch backend
                        botBubble.textContent = parsed;
                    }
                } catch (err) {
                    console.error("Error parsing stream chunk:", err);
                }
            }
        }

        if (botReply) {
            conversationHistory.push({ role: "assistant", content: botReply });
        }
    } catch (error) {
        console.error("Chat Error:", error);
        botBubble.textContent = "Terjadi kesalahan: " + error.message;
    } finally {
        userInput.disabled = false;
        sendBtn.disabled = false;
        userInput.focus();
    }
});