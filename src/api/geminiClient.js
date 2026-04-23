// ============================================================
// Gemini API Client - Google's Most Advanced AI
// ============================================================
// Using Gemini 3 Flash - Google's most advanced model (Dec 2024)
// Docs: https://ai.google.dev/gemini-api/docs/gemini-3

const GEMINI_API_KEY = 'AIzaSyA0lotlm14iEBFlR0v9The5VXOB3vWOQ4A';

// Gemini 3 Models (official names from Google docs):
// - gemini-3-flash-preview (free tier available, fast)
// - gemini-3-pro-preview (more capable, paid only)
const GEMINI_MODEL = 'gemini-3-flash-preview';

const getApiUrl = (model) => 
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

// ============================================================
// Main function to call Gemini API
// ============================================================
// Helper: Fetch with timeout
const fetchWithTimeout = async (url, options, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  }
};

export const callGemini = async (messages, options = {}) => {
  // Try Gemini 3 first, then fallback to older models
  const modelsToTry = [
    'gemini-3-flash-preview',  // Gemini 3 - the best!
    'gemini-2.0-flash-exp',    // Fallback
  ];
  
  let lastError = null;
  
  for (const model of modelsToTry) {
    try {
      console.log(`🤖 Trying Gemini model: ${model}`);
      
      // Convert OpenAI-style messages to Gemini format
      const geminiMessages = convertToGeminiFormat(messages);
      
      console.log('📤 Sending to Gemini...');
      
      const response = await fetchWithTimeout(
        `${getApiUrl(model)}?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: geminiMessages,
            generationConfig: {
              temperature: options.temperature ?? 0.4,
              maxOutputTokens: options.maxTokens || 800, // Reduced for faster response
              topP: 0.8,
              topK: 40,
            },
            safetySettings: [
              {
                category: 'HARM_CATEGORY_HARASSMENT',
                threshold: 'BLOCK_NONE',
              },
              {
                category: 'HARM_CATEGORY_HATE_SPEECH',
                threshold: 'BLOCK_NONE',
              },
              {
                category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                threshold: 'BLOCK_NONE',
              },
              {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                threshold: 'BLOCK_NONE',
              },
            ],
          }),
        },
        12000 // 12 second timeout per model
      );

      console.log(`📥 Gemini response status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`❌ Gemini API error (${model}):`, response.status, JSON.stringify(errorData));
        lastError = new Error(`Gemini API error: ${response.status} - ${JSON.stringify(errorData)}`);
        continue; // Try next model
      }

      const data = await response.json();
      
      console.log('📥 Gemini raw response:', JSON.stringify(data).substring(0, 300));
      
      // Extract text from Gemini response
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        console.error('⚠️ No text in Gemini response:', JSON.stringify(data));
        lastError = new Error('No response from Gemini');
        continue; // Try next model
      }

      console.log(`✅ Gemini (${model}) response:`, text.substring(0, 100));
      return text;
      
    } catch (error) {
      console.error(`❌ Gemini (${model}) error:`, error.message);
      lastError = error;
      continue; // Try next model
    }
  }
  
  // All models failed
  console.error('❌ All Gemini models failed');
  throw lastError || new Error('All Gemini models failed');
};

// ============================================================
// Convert OpenAI message format to Gemini format
// ============================================================
const convertToGeminiFormat = (messages) => {
  const geminiContents = [];
  let systemPrompt = '';

  for (const msg of messages) {
    if (msg.role === 'system') {
      // Gemini doesn't have a system role, prepend to first user message
      systemPrompt = msg.content + '\n\n';
    } else if (msg.role === 'user') {
      geminiContents.push({
        role: 'user',
        parts: [{ text: systemPrompt + msg.content }],
      });
      systemPrompt = ''; // Only add system prompt once
    } else if (msg.role === 'assistant') {
      geminiContents.push({
        role: 'model',
        parts: [{ text: msg.content }],
      });
    }
  }

  // If no user message but we have system prompt, add it as user message
  if (systemPrompt && geminiContents.length === 0) {
    geminiContents.push({
      role: 'user',
      parts: [{ text: systemPrompt }],
    });
  }

  return geminiContents;
};

// ============================================================
// Simple chat function
// ============================================================
export const chatWithGemini = async (userMessage, systemPrompt = '', conversationHistory = []) => {
  const messages = [];
  
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  
  // Add conversation history
  for (const msg of conversationHistory) {
    messages.push({
      role: msg.isBot ? 'assistant' : 'user',
      content: msg.text || msg.content || '',
    });
  }
  
  // Add current user message
  messages.push({ role: 'user', content: userMessage });
  
  return await callGemini(messages);
};

// ============================================================
// Export for use in other modules
// ============================================================
export default {
  callGemini,
  chatWithGemini,
  GEMINI_MODEL,
};

