// === NewtonBot (Beta) – DeepSeek через CORS-прокси ===
const KEY_BASE64 = "c2stNzA0YTAxNWU1MjUyNGVjNmFmMmNjNGE5MDY0YjIwYzM=";
const DEEPSEEK_API_KEY = atob(KEY_BASE64);
const CORS_PROXY = 'https://corsproxy.io/?';   // публичный CORS-прокси

document.addEventListener('DOMContentLoaded', () => {
  const chatWindow = document.getElementById('chat-window');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('user-input');
  const themeSelect = document.getElementById('theme-select');

  // Темы
  const savedTheme = localStorage.getItem('newtonbot-theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeSelect.value = savedTheme;
  themeSelect.addEventListener('change', (e) => {
    const theme = e.target.value;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('newtonbot-theme', theme);
  });

  let messages = []; // история диалога

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = input.value.trim();
    if (!content) return;

    addMessage('user', content);
    messages.push({ role: 'user', content });
    input.value = '';
    const submitBtn = form.querySelector('button');
    submitBtn.disabled = true;

    const botMsgEl = addMessage('bot', 'Initializing, please wait...');
    const bubble = botMsgEl.querySelector('.bubble');

    try {
      const apiMessages = [
        { role: 'system', content: 'Ты — NewtonBot, эксперт мирового уровня. Всегда используй глубокое мышление. Отвечай развёрнуто.' },
        ...messages
      ];

      // Запрос через CORS-прокси (добавляем url к DeepSeek API)
      const targetUrl = 'https://api.deepseek.com/v1/chat/completions';
      const response = await fetch(CORS_PROXY + encodeURIComponent(targetUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          'X-Requested-With': 'XMLHttpRequest'  // иногда прокси требует
        },
        body: JSON.stringify({
          model: 'deepseek-reasoner',
          messages: apiMessages,
          stream: true,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      // Стриминг, фильтруем reasoning
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullAnswer = '';
      let firstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (let line of lines) {
          line = line.trim();
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            if (!delta) continue;
            if (delta.content) {
              if (firstChunk) {
                bubble.textContent = '';
                firstChunk = false;
              }
              fullAnswer += delta.content;
              bubble.textContent = fullAnswer;
              chatWindow.scrollTop = chatWindow.scrollHeight;
            }
          } catch {}
        }
      }

      if (fullAnswer) {
        messages.push({ role: 'assistant', content: fullAnswer });
      } else {
        bubble.textContent = 'Ответ пуст. Попробуйте другой запрос.';
      }
    } catch (err) {
      bubble.textContent = '⚠️ Ошибка соединения. Попробуйте позже.';
      console.error(err);
    } finally {
      submitBtn.disabled = false;
    }
  });

  function addMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = role === 'user' ? '👤' : '🧠';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;
    msgDiv.appendChild(avatar);
    msgDiv.appendChild(bubble);
    chatWindow.appendChild(msgDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return msgDiv;
  }
});
