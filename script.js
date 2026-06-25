// Check for saved key silently in the background
let API_KEY = localStorage.getItem("gemini_api_key");

// Function attached to the new HTML button
function setApiKey() {
    const newKey = prompt("Paste your Gemini API Key here:", API_KEY || "");
    if (newKey) {
        API_KEY = newKey.trim();
        localStorage.setItem("gemini_api_key", API_KEY);
        alert("API Key saved securely in your browser!");
    }
}

document.getElementById("userInput").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        sendMessage();
    }
});

function scrollToBottom() {
    const container = document.getElementById("chat-container");
    container.scrollTop = container.scrollHeight;
}

function parseMarkdown(text) {
    let codeBlocks = [];
    let processedText = text.replace(/```(\w*)\n([\s\S]*?)```/g, function(match, lang, code) {
        codeBlocks.push({ lang, code });
        return `%%%CODE_BLOCK_${codeBlocks.length - 1}%%%`;
    });

    processedText = processedText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    processedText = processedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    processedText = processedText.replace(/\n/g, '<br>');

    codeBlocks.forEach((block, index) => {
        const uniqueId = 'code-' + Math.random().toString(36).substr(2, 9);
        const escapedCode = block.code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const html = `
        <div class="code-container">
            <div class="code-header">
                <span>${block.lang || 'script'}</span>
                <button class="copy-btn" onclick="copyToClipboard('${uniqueId}', this)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    Copy code
                </button>
            </div>
            <pre><code id="${uniqueId}">${escapedCode}</code></pre>
        </div>`;
        processedText = processedText.replace(`%%%CODE_BLOCK_${index}%%%`, html);
    });

    return processedText;
}

function copyToClipboard(elementId, btnElement) {
    const codeText = document.getElementById(elementId).innerText;
    navigator.clipboard.writeText(codeText).then(() => {
        const originalText = btnElement.innerHTML;
        btnElement.innerHTML = `Copied!`;
        btnElement.style.color = "var(--accent-blue)";
        setTimeout(() => {
            btnElement.innerHTML = originalText;
            btnElement.style.color = "var(--text-secondary)";
        }, 2000);
    });
}

async function sendMessage() {
    const input = document.getElementById("userInput");
    const sendBtn = document.getElementById("sendBtn");
    const text = input.value.trim();
    
    if (!text) return;

    // Prevents crashing if the user hasn't set their key yet
    if (!API_KEY) {
        alert("Please set your API Key first by clicking the 🔑 button at the top!");
        return;
    }

    input.disabled = true;
    sendBtn.disabled = true;

    const chatContainer = document.getElementById("chat-container");
    const activeModel = document.getElementById("modelSelect").value;

    chatContainer.innerHTML += `
        <div class="message-wrapper">
            <div class="user-msg">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>
    `;
    input.value = "";
    scrollToBottom();

    const thinkingId = "think-" + Math.random().toString(36).substr(2, 9);
    chatContainer.innerHTML += `
        <div class="message-wrapper" id="${thinkingId}">
            <div class="bot-msg-container">
                <div class="gemini-avatar">
                    <svg viewBox="0 0 24 24"><path d="M12 0C12 6.627 17.373 12 24 12C17.373 12 12 17.373 12 24C12 17.373 6.627 12 0 12C6.627 12 12 6.627 12 0Z"/></svg>
                </div>
                <div class="bot-msg">
                    <div class="thinking-box">
                        <div class="spinner"></div> Generating response...
                    </div>
                </div>
            </div>
        </div>
    `;
    scrollToBottom();

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent`,
            {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "x-goog-api-key": API_KEY 
                },
                body: JSON.stringify({ contents: [{ parts: [{ text: text }] }] })
            }
        );

        const data = await response.json();
        const thinkElement = document.getElementById(thinkingId);
        if (thinkElement) thinkElement.remove();

        if (!response.ok) {
            throw new Error(data.error?.message || `API rejected the request with status: ${response.status}`);
        }

        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
        const formattedReply = parseMarkdown(reply);

        chatContainer.innerHTML += `
            <div class="message-wrapper">
                <div class="bot-msg-container">
                    <div class="gemini-avatar">
                        <svg viewBox="0 0 24 24"><path d="M12 0C12 6.627 17.373 12 24 12C17.373 12 12 17.373 12 24C12 17.373 6.627 12 0 12C6.627 12 12 6.627 12 0Z"/></svg>
                    </div>
                    <div class="bot-msg">${formattedReply}</div>
                </div>
            </div>
        `;
    } catch (err) {
        const thinkElement = document.getElementById(thinkingId);
        if (thinkElement) thinkElement.remove();
        
        let errorText = err.message;
        if (errorText.includes("Failed to fetch")) {
            errorText = "Network Error: Google is blocking this key from running in a local browser (CORS policy).";
        }

        chatContainer.innerHTML += `
            <div class="message-wrapper">
                <div class="bot-msg-container">
                    <div class="gemini-avatar" style="background: #ea4335;">⚠️</div>
                    <div class="bot-msg" style="color: #f28b82; border: 1px solid #ea4335; padding: 10px; border-radius: 8px;">
                        <strong>System Error:</strong><br>${errorText}
                    </div>
                </div>
            </div>
        `;
    } finally {
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
        scrollToBottom();
    }
}

    input.disabled = true;
    sendBtn.disabled = true;

    const chatContainer = document.getElementById("chat-container");
    const activeModel = document.getElementById("modelSelect").value;

    chatContainer.innerHTML += `
        <div class="message-wrapper">
            <div class="user-msg">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        </div>
    `;
    input.value = "";
    scrollToBottom();

    const thinkingId = "think-" + Math.random().toString(36).substr(2, 9);
    chatContainer.innerHTML += `
        <div class="message-wrapper" id="${thinkingId}">
            <div class="bot-msg-container">
                <div class="gemini-avatar">
                    <svg viewBox="0 0 24 24"><path d="M12 0C12 6.627 17.373 12 24 12C17.373 12 12 17.373 12 24C12 17.373 6.627 12 0 12C6.627 12 12 6.627 12 0Z"/></svg>
                </div>
                <div class="bot-msg">
                    <div class="thinking-box">
                        <div class="spinner"></div> Generating response...
                    </div>
                </div>
            </div>
        </div>
    `;
    scrollToBottom();

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent`,
            {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "x-goog-api-key": API_KEY 
                },
                body: JSON.stringify({ contents: [{ parts: [{ text: text }] }] })
            }
        );

        const data = await response.json();
        const thinkElement = document.getElementById(thinkingId);
        if (thinkElement) thinkElement.remove();

        if (!response.ok) {
            throw new Error(data.error?.message || `API rejected the request with status: ${response.status}`);
        }

        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
        const formattedReply = parseMarkdown(reply);

        chatContainer.innerHTML += `
            <div class="message-wrapper">
                <div class="bot-msg-container">
                    <div class="gemini-avatar">
                        <svg viewBox="0 0 24 24"><path d="M12 0C12 6.627 17.373 12 24 12C17.373 12 12 17.373 12 24C12 17.373 6.627 12 0 12C6.627 12 12 6.627 12 0Z"/></svg>
                    </div>
                    <div class="bot-msg">${formattedReply}</div>
                </div>
            </div>
        `;
    } catch (err) {
        const thinkElement = document.getElementById(thinkingId);
        if (thinkElement) thinkElement.remove();
        
        let errorText = err.message;
        if (errorText.includes("Failed to fetch")) {
            errorText = "Network Error: Google is blocking this key from running in a local browser (CORS policy).";
        }

        chatContainer.innerHTML += `
            <div class="message-wrapper">
                <div class="bot-msg-container">
                    <div class="gemini-avatar" style="background: #ea4335;">⚠️</div>
                    <div class="bot-msg" style="color: #f28b82; border: 1px solid #ea4335; padding: 10px; border-radius: 8px;">
                        <strong>System Error:</strong><br>${errorText}
                    </div>
                </div>
            </div>
        `;
    } finally {
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
        scrollToBottom();
    }
}
