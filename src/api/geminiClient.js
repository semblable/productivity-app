const getEnvApiKey = () => {
  console.log('Environment variables:', {
    REACT_APP_GEMINI_API_KEY: process.env.REACT_APP_GEMINI_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
    allReactAppVars: Object.keys(process.env).filter(key => key.startsWith('REACT_APP_'))
  });
  return process.env.REACT_APP_GEMINI_API_KEY;
};

const safeJSONParse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    // try to extract JSON between first '[' or '{' and last ']' or '}'
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start !== -1 && end !== -1) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {}
    }
    return null;
  }
};

const normalizeTree = (nodes=[]) => nodes.map(n => {
  const text = n.text || n.name || '';
  const children = normalizeTree(n.children || n.subtasks || []);
  return { text, children };
});

export const generateTasks = async (noteContent, depth, { enhance = false, maxRetries = 2, model = 'gemini-2.5-flash-preview-05-20' } = {}) => {
  const apiKey = getEnvApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key not found. Please set VITE_GEMINI_API_KEY or REACT_APP_GEMINI_API_KEY');
  }

  const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  let systemPrompt = 'You are an expert study-plan assistant. Convert the following markdown note into a JSON array of tasks with nested subtasks. Each object MUST have a "text" property (string) and an optional "children" array. Keep tasks short (<=120 chars). Output ONLY JSON.';
  if (enhance) {
    systemPrompt += ' Provide granular, highly-detailed subtasks whenever possible. For example, replace "Brush teeth" with tasks like "Apply toothpaste", "Brush for two minutes", "Rinse mouth".';
  }

  const userPrompt = depth != null ?
    `NOTE:\n"""\n${noteContent}\n"""\nDEPTH: ${depth}` :
    `NOTE:\n"""\n${noteContent}\n"""`;

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      candidateCount: 1,
      maxOutputTokens: 8192,
    },
    system_instruction: {
      role: 'system',
      parts: [{ text: systemPrompt }]
    },
  };

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log('Making request to:', ENDPOINT);
      console.log('Request body:', JSON.stringify(requestBody, null, 2));

      const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('Response status:', res.status);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.log('Error response:', errorText);
        lastError = new Error(`Gemini API error: ${res.status} - ${errorText}`);
        continue;
      }

      const data = await res.json();
      console.log('Response data:', data);
      
      const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (!responseText) {
        lastError = new Error('No response text from Gemini');
        continue;
      }

      console.log('Raw response text:', responseText);

      const json = safeJSONParse(responseText.trim());
      if (json && Array.isArray(json) && json.length > 0) {
        return normalizeTree(json);
      }

      // Empty or invalid JSON, ask again
      requestBody.contents.push({
        role: 'user',
        parts: [{ text: 'The previous answer was empty or invalid. Please output a non-empty JSON array of tasks.' }],
      });
    } catch (error) {
      console.error('Request failed:', error);
      lastError = error;
    }
  }

  throw lastError || new Error('Failed to parse Gemini response');
};

export const generateSubTasks = async (taskTitle, { maxRetries = 2, model = 'gemini-2.5-flash' } = {}) => {
  const apiKey = getEnvApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key not found. Please set VITE_GEMINI_API_KEY or REACT_APP_GEMINI_API_KEY');
  }

  const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const systemPrompt = `You are a productivity assistant. Break the following task into 5-7 specific, sequential sub-tasks. Return a JSON list of strings only, with no other formatting. For example: ["Step 1", "Step 2", "Step 3"]`;

  const userPrompt = `Task: "${taskTitle}"`;

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      candidateCount: 1,
      maxOutputTokens: 16000,
      response_mime_type: "application/json",
    },
    system_instruction: {
      role: 'system',
      parts: [{ text: systemPrompt }]
    },
  };

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errorText = await res.text();
        lastError = new Error(`Gemini API error: ${res.status} - ${errorText}`);
        continue;
      }

      const data = await res.json();
      const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      if (!responseText) {
        lastError = new Error('No response text from Gemini');
        continue;
      }

      const json = safeJSONParse(responseText.trim());
      if (json && Array.isArray(json) && json.length > 0 && json.every(item => typeof item === 'string')) {
        return json;
      }

      lastError = new Error('Received invalid JSON or empty array from Gemini.');
      // Optional: Add more specific re-prompting if needed
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      lastError = error;
    }
  }

  throw lastError || new Error('Failed to generate sub-tasks after multiple retries.');
}; 