import React, { useState, useEffect } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const API_KEYS_STORAGE_KEY = 'storyExpanderApiKeys';

export interface ApiKeys {
  openai: string;
  claude: string;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [apiKeys, setApiKeys] = useState<ApiKeys>({ openai: '', claude: '' });
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [showPassword, setShowPassword] = useState<{ openai: boolean; claude: boolean }>({
    openai: false,
    claude: false,
  });

  useEffect(() => {
    // Load API keys from localStorage when modal opens
    if (isOpen) {
      const stored = localStorage.getItem(API_KEYS_STORAGE_KEY);
      if (stored) {
        try {
          setApiKeys(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse stored API keys:', e);
        }
      }
      setSaveMessage('');
    }
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem(API_KEYS_STORAGE_KEY, JSON.stringify(apiKeys));
    setSaveMessage('Settings saved successfully!');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleReset = () => {
    if (
      window.confirm(
        'Are you sure you want to clear all API keys? This cannot be undone.'
      )
    ) {
      localStorage.removeItem(API_KEYS_STORAGE_KEY);
      setApiKeys({ openai: '', claude: '' });
      setSaveMessage('API keys cleared.');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 font-bold text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-6">
          {/* OpenAI API Key */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              OpenAI API Key
            </label>
            <div className="relative">
              <input
                type={showPassword.openai ? 'text' : 'password'}
                value={apiKeys.openai}
                onChange={(e) =>
                  setApiKeys({ ...apiKeys, openai: e.target.value })
                }
                placeholder="sk-..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() =>
                  setShowPassword({ ...showPassword, openai: !showPassword.openai })
                }
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword.openai ? '🙈' : '👁️'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Get your key from{' '}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                OpenAI Dashboard
              </a>
            </p>
          </div>

          {/* Claude API Key */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Anthropic (Claude) API Key
            </label>
            <div className="relative">
              <input
                type={showPassword.claude ? 'text' : 'password'}
                value={apiKeys.claude}
                onChange={(e) =>
                  setApiKeys({ ...apiKeys, claude: e.target.value })
                }
                placeholder="sk-ant-..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() =>
                  setShowPassword({ ...showPassword, claude: !showPassword.claude })
                }
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword.claude ? '🙈' : '👁️'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Get your key from{' '}
              <a
                href="https://console.anthropic.com/account/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                Anthropic Console
              </a>
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              ℹ️ Your API keys are stored locally in your browser and never sent
              to any server except your backend. They enhance your experience by
              allowing custom models.
            </p>
          </div>

          {/* Save Message */}
          {saveMessage && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800">{saveMessage}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              Save Settings
            </button>
            <button
              onClick={handleReset}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              Clear Keys
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export { API_KEYS_STORAGE_KEY };
export default SettingsModal;
