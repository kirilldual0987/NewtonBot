// === NewtonBot (Beta) – DeepSeek с мышлением, без поиска ===
// Ключ API хранится в base64 (обфускация от поверхностного просмотра)
const _enc = "YzJrLU56QTBNVEF4TldVMU1qVXlOR1ZqTm1GbU1tTm5OR0U1TURZMFpqSXdZek09";
// Пароль для XOR расшифровки не используется, это просто base64
const DEEPSEEK_API_KEY = atob(_enc);  // Расшифровка на лету

const MODEL = 'deepseek-reasoner';   // Всегда максимальная модель с мышлением
const SYSTEM_PROMPT = `Ты — NewtonBot, эксперт мирового уровня. Ты обязан всегда задействовать скрытое логическое мышление (reasoning). Отвечай развёрнуто, точно, с примерами.`;

document.addEventListener('DOMContentLoaded', () => {
  const chatWindow = document.getElementById('chat-window');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('user-input');
  const themeSelect = document.getElementById('theme-select');

  // ======== Темы ========
  const savedTheme = localStorage.getItem('newtonbot-theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeSelect.value = savedTheme;
  themeSelect.addEventListener('change', (e) => {
    const theme = e.target.value;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('newtonbot-theme', theme);
  });

  let messages = []; // История диалога

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = input.value.trim();
    if (!content) return;

    addMessage('user', content);
    messages.push({ role: 'user', content });
    input.value = '';
    const submitBtn = form.querySelector('button');
    submitBtn.disabled = true;

    // Показываем пузырь с индикатором ожидания
    const botMsgEl = addMessage('bot', 'Initializing, please wait...');
    const bubble = botMsgEl.querySelector('.bubble');

    try {
      // Сборка запроса к API
      const apiMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages   // вся история
      ];

      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: MODEL,
          messages: apiMessages,
          stream: true,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText);
      }

      // Стриминг с фильтрацией reasoning
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
            // Пропускаем reasoning_content, показываем только content
            if (delta.content) {
              if (firstChunk) {
                bubble.textContent = '';          // убираем "Initializing..."
                firstChunk = false;
              }
              fullAnswer += delta.content;
              bubble.textContent = fullAnswer;
              chatWindow.scrollTop = chatWindow.scrollHeight;
            }
          } catch (e) {}
        }
      }

      if (fullAnswer) {
        messages.push({ role: 'assistant', content: fullAnswer });
      } else {
        bubble.textContent = 'Ответ пуст, попробуйте переформулировать запрос.';
      }
    } catch (err) {
      bubble.textContent = '⚠️ Ошибка соединения или API. Попробуйте позже.';
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
