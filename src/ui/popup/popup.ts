/**
 * Popup Script - Minimal UI
 */

export {};

// DOM 元素
const statusIndicator = document.getElementById('statusIndicator') as HTMLElement;
const statusText = document.getElementById('statusText') as HTMLElement;
const usageLoading = document.getElementById('usageLoading') as HTMLElement;
const usageContent = document.getElementById('usageContent') as HTMLElement;
const usageContent2 = document.getElementById('usageContent2') as HTMLElement;
const usageError = document.getElementById('usageError') as HTMLElement;
const errorMessage = document.getElementById('errorMessage') as HTMLElement;

const gaugePercentage = document.getElementById('gaugePercentage') as HTMLElement;
const usedValue = document.getElementById('usedValue') as HTMLElement;
const remainingValue = document.getElementById('remainingValue') as HTMLElement;
const resetTimesText = document.getElementById('resetTimesText') as HTMLElement;

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
  usageContent.classList.add('hidden');
  usageContent2.classList.add('hidden');
  usageError.classList.add('hidden');
};

const showError = (message: string): void => {
  usageLoading.classList.add('hidden');
  usageContent.classList.add('hidden');
  usageContent2.classList.add('hidden');
  usageError.classList.remove('hidden');
  errorMessage.textContent = message;
};

const updateUsageDisplay = (usage: {
  totalQuotaGb?: number;
  usedGb?: number;
  remainingGb?: number;
  usagePercentage?: number;
}): void => {
  console.log('[Popup] updateUsageDisplay 被调用，参数:', usage);

  usageLoading.classList.add('hidden');
  usageError.classList.add('hidden');
  usageContent.classList.remove('hidden');
  usageContent2.classList.remove('hidden');

  const percentage = Math.min(Math.max(usage.usagePercentage ?? 0, 0), 100);
  const usedText = formatCredits(usage.usedGb);
  const remainingText = formatCredits(usage.remainingGb);

  console.log('[Popup] 格式化后的值:', {
    percentage: percentage.toFixed(1) + '%',
    usedText,
    remainingText,
    usedGb: usage.usedGb,
    remainingGb: usage.remainingGb,
  });

  gaugePercentage.textContent = Number.isNaN(percentage) ? '--%' : `${percentage.toFixed(1)}%`;
  usedValue.textContent = usedText;
  remainingValue.textContent = remainingText;

  console.log('[Popup] DOM 更新完成');
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

const updateResetTimes = (times?: number): void => {
  const actualTimes = times ?? 2;
  resetTimesText.textContent = `${actualTimes}/2`;
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

    const usage = await sendMessage<{
      totalQuotaGb?: number;
      usedGb?: number;
      remainingGb?: number;
      usagePercentage?: number;
      apiError?: boolean;
      errorMessage?: string;
    } | null>('GET_USAGE');

    console.log('[Popup] 收到用量数据:', usage);

    // 情况1：未配置 API Key（返回 null）
    if (!usage) {
      console.warn('[Popup] 用量数据为空，未配置 API Key');
      showError('Please add API key in Settings');
      return;
    }

    // 情况2：API 调用失败（余额不足、网络错误等），但仍显示数据
    if (usage.apiError) {
      console.warn('[Popup] API 调用失败，但仍显示界面:', usage.errorMessage);
      // 显示 0 值，让用户知道当前状态
      updateUsageDisplay({
        totalQuotaGb: 0,
        usedGb: 0,
        remainingGb: 0,
        usagePercentage: 100, // 显示 100% 表示已用完
      });
      // 可以选择在界面上显示一个温馨提示，但不阻止插件打开
      // showError(`Temporary error: ${usage.errorMessage}`);
      return;
    }

    // 情况3：正常获取数据
    updateUsageDisplay(usage);
  } catch (error) {
    console.error('[Popup] 获取用量失败:', error);
    // 即使出错，也显示基本界面，不要完全阻止用户使用
    updateUsageDisplay({
      totalQuotaGb: 0,
      usedGb: 0,
      remainingGb: 0,
      usagePercentage: 0,
    });
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
    updateResetTimes(status.resetTimes);
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
    const usage = await sendMessage<{
      totalQuotaGb?: number;
      usedGb?: number;
      remainingGb?: number;
      usagePercentage?: number;
    } | null>('GET_USAGE');

    // 如果有余额且余额 > $1，弹出确认对话框
    if (usage && usage.remainingGb && usage.remainingGb > 1) {
      const remainingText = formatCredits(usage.remainingGb);
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
