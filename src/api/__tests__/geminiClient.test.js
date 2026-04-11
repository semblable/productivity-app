// Test geminiClient utility functions and API interaction

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

afterEach(() => {
  delete global.fetch;
});

const loadModule = () => {
  let mod;
  jest.isolateModules(() => {
    // Set the env var before requiring the module
    process.env.REACT_APP_GEMINI_API_KEY = 'test-api-key';
    mod = require('../geminiClient');
  });
  return mod;
};

const loadModuleWithoutKey = () => {
  let mod;
  jest.isolateModules(() => {
    delete process.env.REACT_APP_GEMINI_API_KEY;
    mod = require('../geminiClient');
  });
  return mod;
};

describe('geminiClient', () => {
  describe('generateTasks', () => {
    test('throws when no API key', async () => {
      const { generateTasks } = loadModuleWithoutKey();
      await expect(generateTasks('some content')).rejects.toThrow(/API key not found/);
    });

    test('returns normalized task tree on success', async () => {
      const responseTree = [
        { text: 'Task 1', children: [{ text: 'Subtask 1' }] },
        { text: 'Task 2', children: [] },
      ];

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: { parts: [{ text: JSON.stringify(responseTree) }] },
          }],
        }),
      });

      const { generateTasks } = loadModule();
      const result = await generateTasks('Build a house');

      expect(result).toEqual([
        { text: 'Task 1', children: [{ text: 'Subtask 1', children: [] }] },
        { text: 'Task 2', children: [] },
      ]);
    });

    test('normalizes "name" to "text" and "subtasks" to "children"', async () => {
      const responseTree = [
        { name: 'Step 1', subtasks: [{ name: 'Sub 1' }] },
      ];

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: { parts: [{ text: JSON.stringify(responseTree) }] },
          }],
        }),
      });

      const { generateTasks } = loadModule();
      const result = await generateTasks('Plan');

      expect(result[0].text).toBe('Step 1');
      expect(result[0].children[0].text).toBe('Sub 1');
    });

    test('retries on API error and throws after maxRetries', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const { generateTasks } = loadModule();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(generateTasks('content', undefined, { maxRetries: 1 }))
        .rejects.toThrow(/Gemini API error/);

      // 1 initial + 1 retry = 2 calls
      expect(global.fetch).toHaveBeenCalledTimes(2);
      consoleSpy.mockRestore();
    });

    test('handles JSON embedded in markdown code block', async () => {
      const embeddedResponse = '```json\n[{"text": "Task"}]\n```';

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: { parts: [{ text: embeddedResponse }] },
          }],
        }),
      });

      const { generateTasks } = loadModule();
      const result = await generateTasks('note');

      expect(result).toEqual([{ text: 'Task', children: [] }]);
    });

    test('passes enhance option in system prompt', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: { parts: [{ text: '[{"text": "X"}]' }] },
          }],
        }),
      });

      const { generateTasks } = loadModule();
      await generateTasks('note', undefined, { enhance: true });

      const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(requestBody.system_instruction.parts[0].text).toContain('granular');
    });
  });

  describe('generateSubTasks', () => {
    test('throws when no API key', async () => {
      const { generateSubTasks } = loadModuleWithoutKey();
      await expect(generateSubTasks('task')).rejects.toThrow(/API key not found/);
    });

    test('returns string array on success', async () => {
      const subtasks = ['Step 1', 'Step 2', 'Step 3'];

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{
            content: { parts: [{ text: JSON.stringify(subtasks) }] },
          }],
        }),
      });

      const { generateSubTasks } = loadModule();
      const result = await generateSubTasks('Build patio');

      expect(result).toEqual(subtasks);
    });

    test('retries on empty response', async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            candidates: [{ content: { parts: [{ text: '' }] } }],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            candidates: [{ content: { parts: [{ text: '["A","B"]' }] } }],
          }),
        });

      const { generateSubTasks } = loadModule();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const result = await generateSubTasks('task', { maxRetries: 1 });

      expect(result).toEqual(['A', 'B']);
      consoleSpy.mockRestore();
    });
  });
});
