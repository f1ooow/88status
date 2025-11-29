/**
 * Service Worker
 * Chrome 扩展后台服务（Manifest V3）
 *
 * @author Half open flowers
 */

import { scheduler } from '@core/services/Scheduler';
import { resetService } from '@core/services/ResetService';
import { apiClient } from '@core/services/APIClient';
import { StorageService } from '@storage/StorageService';
import { Logger } from '@utils/logger';
import type { MessageResponse } from '@/types';

// ==================== 生命周期事件 ====================

/**
 * 扩展安装事件
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  await Logger.info('SERVICE_WORKER', `扩展已安装: ${details.reason}`);

  if (details.reason === 'install') {
    // 首次安装
    await handleFirstInstall();
  } else if (details.reason === 'update') {
    // 更新
    await handleUpdate(details.previousVersion);
  }

  // 初始化调度器
  await scheduler.initialize();
});

/**
 * Service Worker 启动事件
 */
chrome.runtime.onStartup.addListener(async () => {
  await Logger.info('SERVICE_WORKER', 'Service Worker 启动');

  // 重新初始化调度器
  await scheduler.initialize();
});

/**
 * 首次安装处理
 */
async function handleFirstInstall(): Promise<void> {
  await Logger.success('SERVICE_WORKER', '欢迎使用 88code 自动重置助手！');

  // 打开 Options 页面
  await chrome.runtime.openOptionsPage();
}

/**
 * 更新处理
 */
async function handleUpdate(previousVersion?: string): Promise<void> {
  await Logger.info('SERVICE_WORKER', `从版本 ${previousVersion ?? '未知'} 更新`);

  // 这里可以处理版本迁移逻辑
}

// ==================== Alarm 事件 ====================

/**
 * Alarm 触发事件
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  await scheduler.handleAlarm(alarm);
});

// ==================== 消息处理 ====================

/**
 * 消息监听
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 异步处理消息
  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        success: false,
        error: {
          code: 'MESSAGE_HANDLER_ERROR',
          message: error instanceof Error ? error.message : String(error),
        },
        timestamp: Date.now(),
      });
    });

  // 返回 true 表示异步响应
  return true;
});

/**
 * 处理消息
 */
async function handleMessage(
  message: { type: string; payload?: unknown },
  sender: chrome.runtime.MessageSender,
): Promise<MessageResponse> {
  await Logger.info('MESSAGE_RECEIVED', `收到消息: ${message.type}`, undefined, {
    from: sender.tab?.id ? `Tab ${sender.tab.id}` : 'Extension',
  });

  try {
    switch (message.type) {
      // ==================== 查询类 ====================

      case 'GET_USAGE': {
        const accounts = await StorageService.getAccounts();
        if (accounts.length === 0) {
          return createSuccessResponse(null);
        }

        const firstAccount = accounts[0];
        if (!firstAccount) {
          return createSuccessResponse(null);
        }

        try {
          // 获取完整的订阅列表
          const subscriptions = await apiClient.getSubscriptions(firstAccount.apiKey);

          console.log('[DEBUG] 获取到订阅列表:', subscriptions.map(sub => ({
            id: sub.id,
            name: sub.subscriptionPlan?.subscriptionName,
            planType: sub.subscriptionPlan?.planType,
            isActive: sub.isActive,
            currentCredits: sub.currentCredits,
            creditLimit: sub.subscriptionPlan?.creditLimit,
            resetTimes: sub.resetTimes,
          })));

          // 筛选 MONTHLY 订阅（非FREE付费套餐）
          const monthlySubscriptions = subscriptions.filter(
            (sub) => sub.subscriptionPlan?.planType === 'MONTHLY' &&
                     sub.isActive &&
                     !sub.subscriptionPlan?.subscriptionName?.toUpperCase().includes('FREE'),
          );

          // 筛选 PAY_PER_USE 订阅
          const paygoSubscriptions = subscriptions.filter(
            (sub) => sub.subscriptionPlan?.planType === 'PAY_PER_USE' && sub.isActive,
          );

          const result: {
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
          } = {};

          // 处理 MONTHLY 订阅
          const monthlyData = monthlySubscriptions[0];
          if (monthlyData) {
            const remainingCredits = monthlyData.currentCredits ?? 0;
            const totalCredits = monthlyData.subscriptionPlan?.creditLimit ?? 0;
            const usedCredits = Math.max(0, totalCredits - remainingCredits);
            const usagePercentage = totalCredits > 0 ? (usedCredits / totalCredits) * 100 : 0;

            result.monthly = {
              subscriptionName: monthlyData.subscriptionPlan?.subscriptionName || 'PLUS',
              totalQuotaGb: totalCredits,
              usedGb: usedCredits,
              remainingGb: remainingCredits,
              usagePercentage,
              resetTimes: monthlyData.resetTimes ?? 0,
            };

            console.log('[DEBUG] MONTHLY 数据:', result.monthly);
          }

          // 处理 PAY_PER_USE 订阅
          const paygoData = paygoSubscriptions[0];
          if (paygoData) {
            result.paygo = {
              subscriptionName: paygoData.subscriptionPlan?.subscriptionName || 'PAYGO',
              remainingGb: paygoData.currentCredits ?? 0,
            };

            console.log('[DEBUG] PAYGO 数据:', result.paygo);
          }

          // 如果既没有 MONTHLY 也没有 PAYGO，返回 null
          if (!result.monthly && !result.paygo) {
            console.warn('[DEBUG] 没有找到可用的订阅');
            return createSuccessResponse(null);
          }

          return createSuccessResponse(result);
        } catch (error) {
          console.error('[GET_USAGE] API 调用失败:', error);
          await Logger.warning('GET_USAGE', 'API 调用失败', undefined, {
            error: error instanceof Error ? error.message : String(error),
          });

          // 返回 API 错误标记
          return createSuccessResponse({
            apiError: true,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      case 'GET_ACCOUNTS': {
        const accounts = await StorageService.getAccounts();
        return createSuccessResponse(accounts);
      }

      case 'GET_LOGS': {
        const payload = message.payload as { limit?: number } | undefined;
        const logs = await Logger.getLogs(payload?.limit);
        return createSuccessResponse(logs);
      }

      case 'GET_CONFIG': {
        const config = await StorageService.getScheduleConfig();
        const preferences = await StorageService.getUserPreferences();
        return createSuccessResponse({ config, preferences });
      }

      case 'GET_STATUS': {
        const nextTimes = await scheduler.getNextScheduledTime();
        const accounts = await StorageService.getAccounts();

        // 计算下一次重置时间，需要考虑 resetTimes
        const now = Date.now();
        let nextScheduledReset: number | null = null;
        let resetTimes = 2; // 默认值
        let isOnCooldown = false;
        let nextAvailableTime: number | null = null;

        // 获取剩余刷新次数和冷却信息
        if (accounts.length > 0 && accounts[0]) {
          try {
            const subscriptions = await apiClient.getSubscriptions(accounts[0].apiKey);
            // 筛选激活的 MONTHLY 订阅
            const monthlySubscriptions = subscriptions.filter(
              (sub) => sub.subscriptionPlan?.planType === 'MONTHLY' && sub.isActive,
            );
            // 优先级：非FREE付费套餐 > FREE套餐
            const monthlySubscription = monthlySubscriptions.find(
              (sub) => !sub.subscriptionPlan?.subscriptionName?.toUpperCase().includes('FREE'),
            ) || monthlySubscriptions[0];
            if (monthlySubscription) {
              resetTimes = monthlySubscription.resetTimes ?? 0;

              // 检查冷却时间
              if (monthlySubscription.lastCreditReset) {
                const lastResetTime = new Date(monthlySubscription.lastCreditReset).getTime();
                const cooldownPeriod = 5 * 60 * 60 * 1000; // 5小时
                const timeSinceLastReset = now - lastResetTime;

                if (timeSinceLastReset < cooldownPeriod) {
                  isOnCooldown = true;
                  nextAvailableTime = lastResetTime + cooldownPeriod;
                }
              }
            }
          } catch (error) {
            // 获取失败，使用默认值
            console.error('[GET_STATUS] 获取订阅信息失败:', error);
          }
        }

        // 根据 resetTimes 决定下次刷新时间
        let nextResetType: 'first' | 'second' | null = null;

        if (nextTimes.firstReset && nextTimes.secondReset) {
          const firstDiff = nextTimes.firstReset - now;
          const secondDiff = nextTimes.secondReset - now;

          if (resetTimes >= 2) {
            // 有 2 次机会，18:50 和 23:55 都可以，取最近的
            if (firstDiff > 0 && secondDiff > 0) {
              if (firstDiff < secondDiff) {
                nextScheduledReset = nextTimes.firstReset;
                nextResetType = 'first';
              } else {
                nextScheduledReset = nextTimes.secondReset;
                nextResetType = 'second';
              }
            } else if (firstDiff > 0) {
              nextScheduledReset = nextTimes.firstReset;
              nextResetType = 'first';
            } else if (secondDiff > 0) {
              nextScheduledReset = nextTimes.secondReset;
              nextResetType = 'second';
            }
          } else if (resetTimes >= 1) {
            // 只剩 1 次机会，18:50 会跳过，只能等 23:55
            if (secondDiff > 0) {
              nextScheduledReset = nextTimes.secondReset;
              nextResetType = 'second';
            }
          }
          // resetTimes = 0，不设置 nextScheduledReset，返回 null
        } else {
          // 只有一个，就用那个（但也要检查 resetTimes）
          nextScheduledReset = nextTimes.firstReset ?? nextTimes.secondReset;
          nextResetType = nextTimes.firstReset ? 'first' : 'second';
        }

        return createSuccessResponse({
          connected: accounts.length > 0,
          nextScheduledReset,
          nextResetType, // 返回是第一次还是第二次
          accountCount: accounts.length,
          resetTimes, // 返回剩余刷新次数
          isOnCooldown, // 是否在冷却中
          nextAvailableTime, // 下次可用时间
        });
      }

      // ==================== 操作类 ====================

      case 'EXECUTE_RESET': {
        const payload = message.payload as { manual?: boolean } | undefined;
        const manual = payload?.manual ?? false;

        if (manual) {
          const result = await scheduler.triggerManualReset();
          return createSuccessResponse(result);
        }
        const accounts = await StorageService.getAccounts();
        if (accounts.length > 0 && accounts[0]) {
          const result = await resetService.executeReset(accounts[0], false, 'MANUAL');
          return createSuccessResponse({
            success: result.status === 'SUCCESS',
            message: result.summary,
            results: [result],
          });
        }

        return createErrorResponse('NO_ACCOUNTS', '没有可用的账号');
      }

      case 'SAVE_API_KEY': {
        const payload = message.payload as { apiKey: string; accountName: string };

        // 检查是否已存在相同的 API 密钥
        const existingAccounts = await StorageService.getAccounts();
        const duplicateAccount = existingAccounts.find(
          (acc) => acc.apiKey === payload.apiKey,
        );

        if (duplicateAccount) {
          return createErrorResponse(
            'DUPLICATE_API_KEY',
            `此 API 密钥已存在于账号"${duplicateAccount.name}"中，无法重复添加`,
          );
        }

        // 创建新账号
        const account = {
          id: crypto.randomUUID(),
          name: payload.accountName,
          apiKey: payload.apiKey,
          email: '',
          enabled: true,
          createdAt: Date.now(),
          lastUpdated: Date.now(),
        };

        await StorageService.addAccount(account);
        await Logger.info('ACCOUNT_ADDED', `新增账号: ${payload.accountName}`);
        return createSuccessResponse({ success: true });
      }

      case 'UPDATE_ACCOUNT': {
        const payload = message.payload as { accountId: string; enabled?: boolean };
        await StorageService.updateAccount(payload.accountId, {
          enabled: payload.enabled,
        });
        await Logger.info('ACCOUNT_UPDATED', `更新账号: ${payload.accountId}`);
        return createSuccessResponse({ success: true });
      }

      case 'DELETE_ACCOUNT': {
        const payload = message.payload as { accountId: string };
        await StorageService.deleteAccount(payload.accountId);
        await Logger.info('ACCOUNT_DELETED', `删除账号: ${payload.accountId}`);
        return createSuccessResponse({ success: true });
      }

      case 'UPDATE_CONFIG': {
        const payload = message.payload as {
          scheduleConfig?: unknown;
          preferences?: unknown;
        };

        if (payload.scheduleConfig) {
          await StorageService.saveScheduleConfig(payload.scheduleConfig as never);
          await scheduler.initialize();
        }

        if (payload.preferences) {
          await StorageService.saveUserPreferences(payload.preferences as never);
        }

        return createSuccessResponse({ success: true });
      }

      case 'CLEAR_LOGS': {
        await Logger.clearLogs();
        return createSuccessResponse({ success: true });
      }

      case 'TEST_CONNECTION': {
        const accounts = await StorageService.getAccounts();
        if (accounts.length === 0 || !accounts[0]) {
          return createErrorResponse('NO_ACCOUNT', '没有配置的账号');
        }

        const connected = await apiClient.testConnection(accounts[0].apiKey);
        return createSuccessResponse({ connected });
      }

      default:
        return createErrorResponse('UNKNOWN_MESSAGE_TYPE', `未知消息类型: ${message.type}`);
    }
  } catch (error) {
    await Logger.error('MESSAGE_ERROR', `处理消息失败: ${message.type}`, undefined, {
      error: error instanceof Error ? error.message : String(error),
    });

    return createErrorResponse(
      'MESSAGE_PROCESSING_ERROR',
      error instanceof Error ? error.message : '处理消息时发生错误',
    );
  }
}

// ==================== 工具函数 ====================

/**
 * 创建成功响应
 */
function createSuccessResponse<T>(data: T): MessageResponse<T> {
  return {
    success: true,
    data,
    timestamp: Date.now(),
  };
}

/**
 * 创建错误响应
 */
function createErrorResponse(code: string, message: string): MessageResponse {
  return {
    success: false,
    error: {
      code,
      message,
    },
    timestamp: Date.now(),
  };
}

// ==================== 全局错误处理 ====================

/**
 * 捕获未处理的错误
 */
self.addEventListener('error', (event) => {
  Logger.error('UNHANDLED_ERROR', '未处理的错误', undefined, {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  }).catch(() => {
    // 忽略日志错误
  });
});

/**
 * 捕获未处理的 Promise 拒绝
 */
self.addEventListener('unhandledrejection', (event) => {
  Logger.error('UNHANDLED_REJECTION', '未处理的 Promise 拒绝', undefined, {
    reason: event.reason instanceof Error ? event.reason.message : String(event.reason),
  }).catch(() => {
    // 忽略日志错误
  });
});

// ==================== 启动日志 ====================

Logger.success('SERVICE_WORKER', '88code 自动重置助手后台服务已启动').catch(() => {
  // 忽略日志错误
});
