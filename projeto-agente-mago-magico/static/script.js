// Variável global para manter o ID da conversa entre as trocas de mensagem
let currentConversationId = null;

// Função autônoma e resiliente para formatar Markdown
function parseMarkdown(text) {
    if (!text) return '';

    // 1. Se a biblioteca marked estiver disponível, tenta usá-la
    if (typeof marked !== 'undefined') {
        try {
            if (typeof marked.parse === 'function') {
                return marked.parse(text);
            } else if (typeof marked === 'function') {
                return marked(text);
            }
        } catch (e) {
            console.warn('Erro ao processar com marked, usando formatador embutido:', e);
        }
    }

    // 2. Formatador embutido nativo (não depende de nenhum arquivo ou biblioteca externa)
    let formatted = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Cabeçalhos (###, ##, #)
    formatted = formatted.replace(/^###[ \t]+(.*)$/gm, '<h3>$1</h3>');
    formatted = formatted.replace(/^##[ \t]+(.*)$/gm, '<h2>$1</h2>');
    formatted = formatted.replace(/^#[ \t]+(.*)$/gm, '<h1>$1</h1>');

    // Negrito e Itálico combinados: ***texto***
    formatted = formatted.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');

    // Negrito: **texto**
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Itálico: *texto* ou _texto_
    formatted = formatted.replace(/(^|[^\*])\*([^\*\n]+)\*([^\*]|$)/g, '$1<em>$2</em>$3');
    formatted = formatted.replace(/(^|[^_])_([^_\n]+)_([^_]|$)/g, '$1<em>$2</em>$3');

    // Código em linha: `código`
    formatted = formatted.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    // Links: [texto](url)
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Itens de lista com marcadores (- item ou * item)
    formatted = formatted.replace(/^[ \t]*[-*][ \t]+(.*)$/gm, '<li>$1</li>');

    // Itens de lista numerados (1. item)
    formatted = formatted.replace(/^[ \t]*\d+\.[ \t]+(.*)$/gm, '<li>$1</li>');

    // Agrupa <li> adjacentes dentro de <ul>
    formatted = formatted.replace(/((?:<li>.*<\/li>[\r\n]*)+)/g, '<ul>$1</ul>');

    // Quebras de linha normais
    formatted = formatted.replace(/\n/g, '<br>');

    // Limpa <br> redundantes ao redor de listas e títulos
    formatted = formatted.replace(/<br><ul>/g, '<ul>');
    formatted = formatted.replace(/<\/ul><br>/g, '</ul>');
    formatted = formatted.replace(/<br><h([1-6])>/g, '<h$1>');
    formatted = formatted.replace(/<\/h([1-6])><br>/g, '</h$1>');

    return formatted;
}

document.addEventListener('DOMContentLoaded', () => {
    // Configura o Marked se carregado
    if (typeof marked !== 'undefined') {
        try {
            if (typeof marked.setOptions === 'function') {
                marked.setOptions({ breaks: true, gfm: true });
            } else if (typeof marked.use === 'function') {
                marked.use({ breaks: true, gfm: true });
            }
        } catch (e) {
            console.warn('Erro ao configurar marked:', e);
        }
    }

    // Formata mensagens iniciais do agente que já existam no HTML
    document.querySelectorAll('.agent-message').forEach(el => {
        el.innerHTML = parseMarkdown(el.innerText);
    });

    const sendBtn = document.getElementById('send-btn');
    const inputElement = document.getElementById('message-input');

    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    if (inputElement) {
        inputElement.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
            }
        });
    }
});

async function sendMessage() {
    const inputElement = document.getElementById('message-input');
    if (!inputElement) return;

    const messageText = inputElement.value.trim();
    if (!messageText) return;

    // 1. Exibe a mensagem no chat
    appendMessage(messageText, 'user-message');
    inputElement.value = '';

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: messageText,
                conversation_id: currentConversationId
            })
        });

        const data = await response.json();

        if (data.conversation_id) {
            currentConversationId = data.conversation_id;
        }

        if (data.response) {
            appendMessage(data.response, 'agent-message');
        } else if (data.error) {
            appendMessage("Erro no servidor: " + data.error, 'agent-message');
        }

        if (data.commander_image_url) {
            const imgElement = document.getElementById('commander-img');
            const placeholder = document.getElementById('placeholder-text');
            if (imgElement && placeholder) {
                // Altera a imagem atual para a nova carta definida/trocada
                imgElement.src = data.commander_image_url;
                imgElement.style.display = 'block';
                placeholder.style.display = 'none';
            }
        }

    } catch (error) {
        console.error("Erro na comunicação:", error);
        appendMessage("Erro ao conectar com o servidor.", 'agent-message');
    }
}

function appendMessage(text, className) {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${className}`;

    if (className.includes('agent-message')) {
        // Formata Markdown para a resposta do agente
        messageDiv.innerHTML = parseMarkdown(text);
    } else {
        // Mensagens do usuário continuam como texto puro seguro
        messageDiv.innerText = text;
    }

    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}