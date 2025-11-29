/**
 * Popup Script - Minimal UI
 */

export {};

// DOM 元素
const statusIndicator = document.getElementById('statusIndicator') as HTMLElement;
const statusText = document.getElementById('statusText') as HTMLElement;
const usageLoading = document.getElementById('usageLoading') as HTMLElement;
const usageError = document.getElementById('usageError') as HTMLElement;
const errorMessage = document.getElementById('errorMessage') as HTMLElement;

// PAYGO 区域
const paygoSection = document.getElementById('paygoSection') as HTMLElement;
const paygoPlanName = document.getElementById('paygoPlanName') as HTMLElement;
const paygoBalance = document.getElementById('paygoBalance') as HTMLElement;

// MONTHLY 区域
const monthlySection = document.getElementById('monthlySection') as HTMLElement;
const monthlyPlanName = document.getElementById('monthlyPlanName') as HTMLElement;
const monthlyUsed = document.getElementById('monthlyUsed') as HTMLElement;
const monthlyRemaining = document.getElementById('monthlyRemaining') as HTMLElement;
const monthlyPercentage = document.getElementById('monthlyPercentage') as HTMLElement;
const monthlyResetTimes = document.getElementById('monthlyResetTimes') as HTMLElement;

const resetBtn = document.getElementById('resetBtn') as HTMLButtonElement;
const btnContent = resetBtn.querySelector('.btn-content') as HTMLElement;
const btnLoading = resetBtn.querySelector('.btn-loading') as HTMLElement;

const settingsBtn = document.getElementById('settingsBtn') as HTMLButtonElement;
const nextResetTime = document.getElementById('nextResetTime') as HTMLElement;

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

const formatCredits = (credits: number | undefined | null): string => {
  if (credits === undefined || credits === null || Number.isNaN(credits)) {
    return '--';
  }
  return `$${credits.toFixed(2)}`;
};

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const timeStr = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  if (date.toDateString() === now.toDateString()) {
    return `Today ${timeStr}`;
  } if (date.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow ${timeStr}`;
  }
  return `${date.toLocaleDateString('zh-CN')} ${timeStr}`;
};

// UI 更新
const showLoading = (): void => {
  usageLoading.classList.remove('hidden');
  paygoSection.classList.add('hidden');
  monthlySection.classList.add('hidden');
  usageError.classList.add('hidden');
};

const showError = (message: string): void => {
  usageLoading.classList.add('hidden');
  paygoSection.classList.add('hidden');
  monthlySection.classList.add('hidden');
  usageError.classList.remove('hidden');
  errorMessage.textContent = message;
};

const updateUsageDisplay = (data: {
  monthly?: {
    subscriptionName: string;
    totalQuotaGb: number;
    usedGb: number;
    remainingGb: number;
    usagePercentage: number;
    resetTimes: number;
  };
  paygo?: {
    subscriptionName: string;
    remainingGb: number;
  };
}): void => {
  console.log('[Popup] 更新用量显示:', data);

  usageLoading.classList.add('hidden');
  usageError.classList.add('hidden');

  // 显示 PAYGO 区域
  if (data.paygo) {
    paygoSection.classList.remove('hidden');
    paygoPlanName.textContent = data.paygo.subscriptionName || 'PAYGO';
    paygoBalance.textContent = formatCredits(data.paygo.remainingGb);
    console.log('[Popup] PAYGO 显示:', data.paygo);
  } else {
    paygoSection.classList.add('hidden');
  }

  // 显示 MONTHLY 区域
  if (data.monthly) {
    monthlySection.classList.remove('hidden');
    monthlyPlanName.textContent = data.monthly.subscriptionName || 'PLUS';
    monthlyUsed.textContent = formatCredits(data.monthly.usedGb);
    monthlyRemaining.textContent = formatCredits(data.monthly.remainingGb);

    const percentage = Math.min(Math.max(data.monthly.usagePercentage ?? 0, 0), 100);
    monthlyPercentage.textContent = `${percentage.toFixed(1)}%`;

    const resetTimes = data.monthly.resetTimes ?? 0;
    monthlyResetTimes.textContent = `${resetTimes}/2`;

    console.log('[Popup] MONTHLY 显示:', data.monthly);
  } else {
    monthlySection.classList.add('hidden');
  }
};

const updateStatus = (connected: boolean): void => {
  if (connected) {
    statusIndicator.classList.add('connected');
    statusText.textContent = 'Connected';
  } else {
    statusIndicator.classList.remove('connected');
    statusText.textContent = 'Disconnected';
  }
};

const updateNextResetTime = (
  timestamp: number | null,
  resetTimes?: number,
  resetType?: 'first' | 'second' | null,
): void => {
  // 优先检查：如果今日重置次数已用完，显示 "No resets left"
  if (resetTimes === 0) {
    nextResetTime.textContent = 'No resets left';
    return;
  }

  if (!timestamp) {
    nextResetTime.textContent = '--';
    return;
  }

  const timeStr = formatTimestamp(timestamp);
  const typeLabel = resetType === 'first' ? '1st' : resetType === 'second' ? '2nd' : '';
  nextResetTime.textContent = typeLabel ? `${typeLabel} ${timeStr}` : timeStr;
};

const updateResetButton = (
  isOnCooldown?: boolean,
  nextAvailableTime?: number | null,
  resetTimes?: number,
): void => {
  // 优先检查：如果今日重置次数已用完，显示 "No resets left"
  if (resetTimes === 0) {
    resetBtn.disabled = true;
    btnContent.textContent = 'No resets left';
    return;
  }

  if (isOnCooldown && nextAvailableTime) {
    // 冷却中：禁用按钮并显示倒计时
    resetBtn.disabled = true;

    const now = Date.now();
    const remainingMs = Math.max(0, nextAvailableTime - now);
    const hours = Math.floor(remainingMs / (60 * 60 * 1000));
    const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

    // 格式化下次可用时间
    const nextTime = new Date(nextAvailableTime);
    const timeStr = nextTime.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    btnContent.textContent = `${hours}h ${minutes}m (${timeStr})`;
  } else {
    // 正常状态：启用按钮
    resetBtn.disabled = false;
    btnContent.textContent = 'Reset';
  }
};

// 数据加载
const loadUsage = async (): Promise<void> => {
  showLoading();

  try {
    console.log('[Popup] 开始获取用量数据...');

    const data = await sendMessage<{
      monthly?: {
        subscriptionName: string;
        totalQuotaGb: number;
        usedGb: number;
        remainingGb: number;
        usagePercentage: number;
        resetTimes: number;
      };
      paygo?: {
        subscriptionName: string;
        remainingGb: number;
      };
      apiError?: boolean;
      errorMessage?: string;
    } | null>('GET_USAGE');

    console.log('[Popup] 收到用量数据:', data);

    // 情况1：未配置 API Key（返回 null）
    if (!data) {
      console.warn('[Popup] 用量数据为空，未配置 API Key');
      showError('Please add API key in Settings');
      return;
    }

    // 情况2：API 调用失败
    if (data.apiError) {
      console.warn('[Popup] API 调用失败:', data.errorMessage);
      showError(data.errorMessage || 'Failed to load');
      return;
    }

    // 情况3：正常显示数据
    if (data.monthly || data.paygo) {
      updateUsageDisplay(data);
    } else {
      console.warn('[Popup] 没有可用的订阅数据');
      showError('No active subscriptions');
    }
  } catch (error) {
    console.error('[Popup] 获取用量失败:', error);
    showError(error instanceof Error ? error.message : 'Load failed');
  }
};

const loadStatus = async (): Promise<void> => {
  try {
    const status = await sendMessage<{
      connected: boolean;
      nextScheduledReset: number | null;
      nextResetType?: 'first' | 'second' | null;
      resetTimes?: number;
      isOnCooldown?: boolean;
      nextAvailableTime?: number | null;
    }>('GET_STATUS');

    updateStatus(status.connected);
    updateNextResetTime(status.nextScheduledReset, status.resetTimes, status.nextResetType);
    updateResetButton(status.isOnCooldown, status.nextAvailableTime, status.resetTimes);
  } catch (error) {
    updateStatus(false);
  }
};

// 事件处理
resetBtn.addEventListener('click', async () => {
  if (resetBtn.disabled) return;

  console.log('[Popup] 点击重置按钮');

  try {
    // 先获取当前用量，检查是否需要确认
    const data = await sendMessage<{
      monthly?: {
        remainingGb: number;
      };
    } | null>('GET_USAGE');

    // 如果 MONTHLY 有余额且余额 > $1，弹出确认对话框
    if (data?.monthly?.remainingGb && data.monthly.remainingGb > 1) {
      const remainingText = formatCredits(data.monthly.remainingGb);
      const confirm = window.confirm(
        `You still have ${remainingText} remaining credits.\n\nAre you sure you want to reset now?`,
      );

      if (!confirm) {
        console.log('[Popup] 用户取消重置');
        return;
      }
    }
  } catch (error) {
    console.error('[Popup] 获取用量失败，继续执行重置:', error);
    // 获取失败不影响重置，继续执行
  }

  resetBtn.disabled = true;
  btnContent.classList.add('hidden');
  btnLoading.classList.remove('hidden');

  try {
    console.log('[Popup] 发送重置请求...');
    const result = await sendMessage<{ success: boolean; message: string }>('EXECUTE_RESET', { manual: true });

    console.log('[Popup] 重置结果:', result);

    if (result.success) {
      btnContent.textContent = 'Done';
      btnContent.classList.remove('hidden');
      btnLoading.classList.add('hidden');

      setTimeout(() => {
        btnContent.textContent = 'Reset';
        loadUsage();
        loadStatus();
      }, 1500);
    } else {
      btnContent.textContent = 'Failed';
      btnContent.classList.remove('hidden');
      btnLoading.classList.add('hidden');

      showError(result.message || 'Skipped');

      setTimeout(() => {
        btnContent.textContent = 'Reset';
      }, 3000);
    }
  } catch (error) {
    console.error('[Popup] 重置失败:', error);
    btnContent.textContent = 'Error';
    btnContent.classList.remove('hidden');
    btnLoading.classList.add('hidden');

    setTimeout(() => {
      btnContent.textContent = 'Reset';
    }, 2000);

    showError(error instanceof Error ? error.message : 'Failed');
  } finally {
    resetBtn.disabled = false;
  }
});

settingsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// 初始化
const initialize = async (): Promise<void> => {
  await Promise.all([
    loadUsage(),
    loadStatus(),
  ]);
};

initialize().catch((error) => {
  console.error('Init failed:', error);
  showError('Init failed');
});

// 定期刷新
setInterval(() => {
  loadUsage().catch(() => {});
}, 30000);
