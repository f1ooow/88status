/**
 * Options Page Script - Minimal UI
 */

export {};

// DOM 元素
const tabs = document.querySelectorAll('.tab') as NodeListOf<HTMLButtonElement>;
const tabContents = document.querySelectorAll('.tab-content');

const apiForm = document.getElementById('apiForm') as HTMLFormElement;
const accountNameInput = document.getElementById('accountName') as HTMLInputElement;
const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
const testConnectionBtn = document.getElementById('testConnectionBtn') as HTMLButtonElement;
const apiAlert = document.getElementById('apiAlert') as HTMLElement;

const scheduleForm = document.getElementById('scheduleForm') as HTMLFormElement;
const firstResetTimeInput = document.getElementById('firstResetTime') as HTMLInputElement;
const secondResetTimeInput = document.getElementById('secondResetTime') as HTMLInputElement;
const autoResetEnabledCheckbox = document.getElementById('autoResetEnabled') as HTMLInputElement;
const notificationsEnabledCheckbox = document.getElementById('notificationsEnabled') as HTMLInputElement;
const scheduleAlert = document.getElementById('scheduleAlert') as HTMLElement;

const refreshLogsBtn = document.getElementById('refreshLogsBtn') as HTMLButtonElement;
const clearLogsBtn = document.getElementById('clearLogsBtn') as HTMLButtonElement;
const logsContainer = document.getElementById('logsContainer') as HTMLElement;

const accountList = document.getElementById('accountList') as HTMLElement;

// 工具函数
const sendMessage = async <T>(type: string, payload?: unknown): Promise<T> => {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response || !response.success) {
        reject(new Error(response?.error?.message || 'Unknown error'));
        return;
      }

      resolve(response.data as T);
    });
  });
};

const showAlert = (element: HTMLElement, message: string, type: 'success' | 'error' | 'warning'): void => {
  element.textContent = message;
  element.className = `alert ${type}`;
  element.classList.remove('hidden');

  setTimeout(() => {
    element.classList.add('hidden');
  }, 3000);
};

const formatTimestamp = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('zh-CN');
};

// Tab 切换
tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const tabId = tab.getAttribute('data-tab');

    tabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');

    tabContents.forEach((content) => {
      content.classList.remove('active');
      if (content.id === `${tabId}Tab`) {
        content.classList.add('active');
      }
    });

    if (tabId === 'logs') {
      loadLogs().catch(console.error);
    }
  });
});

// API 配置
apiForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const accountName = accountNameInput.value.trim();
  const apiKey = apiKeyInput.value.trim();

  if (!accountName || !apiKey) {
    showAlert(apiAlert, 'Please fill all fields', 'error');
    return;
  }

  try {
    await sendMessage('SAVE_API_KEY', { accountName, apiKey });
    showAlert(apiAlert, 'API key saved successfully', 'success');
    apiForm.reset();
    loadAccountList().catch(console.error);
  } catch (error) {
    showAlert(apiAlert, error instanceof Error ? error.message : 'Save failed', 'error');
  }
});

testConnectionBtn.addEventListener('click', async () => {
  try {
    const result = await sendMessage<{ connected: boolean }>('TEST_CONNECTION');

    if (result.connected) {
      showAlert(apiAlert, 'Connection successful!', 'success');
    } else {
      showAlert(apiAlert, 'Connection failed', 'error');
    }
  } catch (error) {
    showAlert(apiAlert, error instanceof Error ? error.message : 'Test failed', 'error');
  }
});

// 账号列表
const loadAccountList = async (): Promise<void> => {
  accountList.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const accounts = await sendMessage<Array<{
      id: string;
      name: string;
      apiKey: string;
      email: string;
      enabled: boolean;
      createdAt: number;
      lastUpdated: number;
    }>>('GET_ACCOUNTS');

    if (accounts.length === 0) {
      accountList.innerHTML = '<div class="loading">No accounts yet</div>';
      return;
    }

    accountList.innerHTML = '';
    accounts.forEach((account) => {
      const item = createAccountItem(account);
      accountList.appendChild(item);
    });
  } catch (error) {
    accountList.innerHTML = '<div class="loading">Failed to load</div>';
    console.error('Load accounts failed:', error);
  }
};

const createAccountItem = (account: {
  id: string;
  name: string;
  email: string;
  enabled: boolean;
}): HTMLElement => {
  const item = document.createElement('div');
  item.className = 'account-item';

  const info = document.createElement('div');
  info.className = 'account-info';

  const name = document.createElement('div');
  name.className = 'account-name';
  name.textContent = account.name;

  const status = document.createElement('div');
  status.className = 'account-status';
  status.textContent = account.enabled ? 'Active' : 'Disabled';

  info.appendChild(name);
  info.appendChild(status);

  const actions = document.createElement('div');
  actions.className = 'account-actions';

  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'btn btn-secondary';
  toggleBtn.textContent = account.enabled ? 'Disable' : 'Enable';
  toggleBtn.onclick = () => toggleAccount(account.id, !account.enabled);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-secondary';
  deleteBtn.textContent = 'Delete';
  deleteBtn.onclick = () => deleteAccount(account.id);

  actions.appendChild(toggleBtn);
  actions.appendChild(deleteBtn);

  item.appendChild(info);
  item.appendChild(actions);

  return item;
};

const toggleAccount = async (accountId: string, enabled: boolean): Promise<void> => {
  try {
    await sendMessage('UPDATE_ACCOUNT', { accountId, enabled });
    loadAccountList().catch(console.error);
  } catch (error) {
    console.error('Toggle account failed:', error);
  }
};

const deleteAccount = async (accountId: string): Promise<void> => {
  if (!confirm('Are you sure you want to delete this account?')) {
    return;
  }

  try {
    await sendMessage('DELETE_ACCOUNT', { accountId });
    loadAccountList().catch(console.error);
  } catch (error) {
    console.error('Delete account failed:', error);
  }
};

// 定时设置
scheduleForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  try {
    await sendMessage('UPDATE_CONFIG', {
      scheduleConfig: {
        firstResetTime: firstResetTimeInput.value,
        secondResetTime: secondResetTimeInput.value,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        enabled: autoResetEnabledCheckbox.checked,
      },
      preferences: {
        enableNotifications: notificationsEnabledCheckbox.checked,
      },
    });

    showAlert(scheduleAlert, 'Settings saved successfully', 'success');
  } catch (error) {
    showAlert(scheduleAlert, error instanceof Error ? error.message : 'Save failed', 'error');
  }
});

// 日志
const loadLogs = async (): Promise<void> => {
  logsContainer.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const logs = await sendMessage<Array<{
      timestamp: number;
      level: string;
      message: string;
    }>>('GET_LOGS');

    if (logs.length === 0) {
      logsContainer.innerHTML = '<div class="loading">No logs</div>';
      return;
    }

    logsContainer.innerHTML = '';
    logs.forEach((log) => {
      const item = document.createElement('div');
      item.className = `log-item ${log.level}`;

      const time = document.createElement('span');
      time.className = 'log-time';
      time.textContent = formatTimestamp(log.timestamp);

      const message = document.createElement('span');
      message.className = 'log-message';
      message.textContent = log.message;

      item.appendChild(time);
      item.appendChild(message);
      logsContainer.appendChild(item);
    });
  } catch (error) {
    logsContainer.innerHTML = '<div class="loading">Failed to load</div>';
    console.error('Load logs failed:', error);
  }
};

refreshLogsBtn.addEventListener('click', () => {
  loadLogs().catch(console.error);
});

clearLogsBtn.addEventListener('click', async () => {
  if (!confirm('Are you sure you want to clear all logs?')) {
    return;
  }

  try {
    await sendMessage('CLEAR_LOGS');
    loadLogs().catch(console.error);
  } catch (error) {
    console.error('Clear logs failed:', error);
  }
});

// 初始化
const initialize = async (): Promise<void> => {
  try {
    // 加载账号列表
    await loadAccountList();

    // 加载配置
    const config = await sendMessage<{
      scheduleConfig: {
        firstResetTime: string;
        secondResetTime: string;
        enabled: boolean;
      };
      preferences: {
        enableNotifications: boolean;
      };
    }>('GET_CONFIG');

    firstResetTimeInput.value = config.scheduleConfig?.firstResetTime || '18:50';
    secondResetTimeInput.value = config.scheduleConfig?.secondResetTime || '23:55';
    autoResetEnabledCheckbox.checked = config.scheduleConfig?.enabled ?? true;
    notificationsEnabledCheckbox.checked = config.preferences?.enableNotifications ?? true;
  } catch (error) {
    console.error('Initialize failed:', error);
  }
};

initialize().catch(console.error);
