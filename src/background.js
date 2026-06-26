$ = window.$ = window.jQuery = require('jquery')
import * as _ from "lodash"
import Logline from 'logline'
import { DateTime } from 'luxon'
import { priceProUrl, mapFrequency, getTask, getTasks } from './tasks'
import { rand, getSetting, saveSetting, macId } from './utils'
import { getLoginState } from './account'

import { findGood, findOrder, updateOrders, newMessage, updateMessages, cleanupDeprecatedTaskData, addTaskLog, findAndUpdateTaskResult } from './db'

Logline.using(Logline.PROTOCOL.INDEXEDDB)

import moneyIcon from '../static/image/money.png';
import beanIcon from '../static/image/bean.png';

let logger = {}
let autoLoginQuota = {}
let mLoginUrl = "https://home.m.jd.com/myJd/newhome.action"
let priceProPage = null
let currentTask = null

$.ajaxSetup({
  headers: { 'x-machine-id': macId() }
});

// ============================================================================
// Chrome API Wrappers
// ============================================================================

const chromeAction = {
  getBadgeText: (details, callback) => {
    chrome.runtime.sendMessage({ type: 'CHROME_ACTION', method: 'getBadgeText', args: [details] }, (response) => {
      if (callback && response) callback(response.result);
    });
  },
  setBadgeText: (details) => {
    chrome.runtime.sendMessage({ type: 'CHROME_ACTION', method: 'setBadgeText', args: [details] });
  },
  setBadgeBackgroundColor: (details) => {
    chrome.runtime.sendMessage({ type: 'CHROME_ACTION', method: 'setBadgeBackgroundColor', args: [details] });
  },
  setTitle: (details) => {
    chrome.runtime.sendMessage({ type: 'CHROME_ACTION', method: 'setTitle', args: [details] });
  },
  setIcon: (details) => {
    chrome.runtime.sendMessage({ type: 'CHROME_ACTION', method: 'setIcon', args: [details] });
  }
};

const chromeAlarms = {
  create: (name, alarmInfo) => {
    chrome.runtime.sendMessage({ type: 'CHROME_ALARMS', method: 'create', args: [name, alarmInfo] });
  },
  get: (name, callback) => {
    chrome.runtime.sendMessage({ type: 'CHROME_ALARMS', method: 'get', args: [name] }, (response) => {
      if (callback && response) callback(response.result);
    });
  },
  clearAll: () => {
    chrome.runtime.sendMessage({ type: 'CHROME_ALARMS', method: 'clearAll', args: [] });
  },
  clear: (name) => {
    chrome.runtime.sendMessage({ type: 'CHROME_ALARMS', method: 'clear', args: [name] });
  }
};

const chromeTabs = {
  create: (createProperties, callback) => {
    chrome.runtime.sendMessage({ type: 'CHROME_TABS', method: 'create', args: [createProperties] }, (response) => {
      if (callback && response) callback(response.result);
    });
  },
  get: (tabId, callback) => {
    chrome.runtime.sendMessage({ type: 'CHROME_TABS', method: 'get', args: [tabId] }, (response) => {
      if (callback && response) callback(response.result);
    });
  },
  remove: (tabIds) => {
    chrome.runtime.sendMessage({ type: 'CHROME_TABS', method: 'remove', args: [tabIds] });
  },
  update: (tabId, updateProperties, callback) => {
    chrome.runtime.sendMessage({ type: 'CHROME_TABS', method: 'update', args: [tabId, updateProperties] }, (response) => {
      if (callback && response) callback(response.result);
    });
  },
  query: (queryInfo, callback) => {
    chrome.runtime.sendMessage({ type: 'CHROME_TABS', method: 'query', args: [queryInfo] }, (response) => {
      if (callback && response) callback(response.result);
    });
  },
  sendMessage: (tabId, message, options, callback) => {
    chrome.runtime.sendMessage({ type: 'CHROME_TABS', method: 'sendMessage', args: [tabId, message, options] }, (response) => {
      if (callback && response) callback(response.result);
    });
  }
};

const chromeWindows = {
  create: (createData, callback) => {
    chrome.runtime.sendMessage({ type: 'CHROME_WINDOWS', method: 'create', args: [createData] }, (response) => {
      if (callback && response) callback(response.result);
    });
  },
  update: (windowId, updateInfo) => {
    chrome.runtime.sendMessage({ type: 'CHROME_WINDOWS', method: 'update', args: [windowId, updateInfo] });
  }
};

const chromeNotifications = {
  create: (notificationId, options) => {
    chrome.runtime.sendMessage({ type: 'CHROME_NOTIFICATIONS', method: 'create', args: [notificationId, options] });
  }
};

const chromeRuntimeReload = () => {
  chrome.runtime.sendMessage({ type: 'CHROME_RUNTIME_RELOAD' });
};

// ============================================================================
// Logic
// ============================================================================

function handleAlarm(alarm) {
  log('background', "onAlarm", alarm)
  let taskId = alarm.name.split('_').length > 1 ? alarm.name.split('_')[1] : null
  switch (true) {
    case alarm.name.startsWith('runScheduleJob'):
      runJob(taskId)
      break;
    case alarm.name.startsWith('runJob'):
      runJob(taskId)
      break;
    case alarm.name.startsWith('verifyTask'):
      verifyTaskResult(taskId)
      break;
    case alarm.name == 'cycleTask':
      findJobs()
      runJob()
      updateIcon()
      break;
    case alarm.name.startsWith('clearIframe'):
      resetIframe(taskId || 'iframe')
      break;
    case alarm.name.startsWith('destroyIframe'):
      const el = document.getElementById(taskId);
      if (el) el.remove();
      break;
    case alarm.name.startsWith('closeTab'):
      const tabId = Number(taskId)
      if (!Number.isInteger(tabId)) break
      chromeTabs.get(tabId, (tab) => {
        if (tab) chromeTabs.remove(tab.id)
      })
      break;
    case alarm.name == 'reload':
      chromeRuntimeReload()
      chromeAlarms.clearAll()
      Logline.keep(3);
      break;
  }
}

// Listen for forwarded messages from Service Worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type && (
    message.type === 'UPDATE_CONTEXT_MENU' ||
    message.type === 'CHROME_RUNTIME_RELOAD' ||
    message.type.startsWith('CHROME_')
  )) {
    return false;
  }

  // If the message is forwarded from the Service Worker, use the original sender
  const msg = message.originalSender ? { ...message, ...message.originalSender } : message;
  const originalSender = message.originalSender || sender;

  // Handle internal events (Alarms, Notifications) - No response expected by SW usually
  if (message.type === 'ALARM_TRIGGERED') {
    handleAlarm(message.alarm);
    return false;
  } else if (message.type === 'NOTIFICATION_CLICKED') {
    handleNotificationClick(message.notificationId);
    return false;
  } else if (message.type === 'NOTIFICATION_BUTTON_CLICKED') {
    handleNotificationButtonClick(message.notificationId, message.buttonIndex);
    return false;
  }

  if (message.target !== 'offscreen') {
    return false;
  }

  // Handle Legacy Actions (Response EXPECTED)
  if (!msg.action) {
    msg.action = msg.text
  }

  let task
  let loginState = getLoginState()
  let hourInYear = DateTime.local().toFormat("oHH")

  // Helper to send response safely
  const done = (res) => {
    try {
      sendResponse(res || { result: "ok" });
    } catch (e) {
      console.error("sendResponse failed", e);
    }
  };

  (async () => {
    try {
      switch (msg.action) {
        // 获取移动页商品价格
        case 'getProductPrice':
          let url = `https://item.m.jd.com/product/${msg.sku}.html`
          priceProPage = originalSender

          setTimeout(() => {
            openByIframe(url, 'temporary')
          }, rand(5) * 1000);

          done({
            working: true
          })
          break;
        // 通知商品价格
        case 'productPrice':
          let is_plus = (getSetting('is_plus') ? getSetting('is_plus') == 'checked' : false) || (getSetting('jjb_plus') == 'Y')
          let disable_pricechart = (getSetting('disable_pricechart') ? getSetting('disable_pricechart') == 'checked' : false)
          let priceInfo = {
            sku: msg.sku,
            name: msg.name,
            price: is_plus ? (msg.plus_price || msg.normal_price) : msg.normal_price,
            normal_price: msg.normal_price,
            plus_price: msg.plus_price,
            pingou_price: msg.pingou_price
          }
          // 当前有价保页面
          if (priceProPage) {
            console.log('existence PriceProPage:', priceProPage)
            if (priceProPage.tab) {
              chromeTabs.sendMessage(priceProPage.tab.id, Object.assign({
                action: 'productPrice',
                setting: getPriceProtectionSetting(),
              }, priceInfo), {}, function (response) {
                console.log('send productPrice to tabs response', response)
              })
            } else if (priceProPage.id) {
              document.getElementById('iframe').contentWindow.postMessage(Object.assign({
                action: 'productPrice',
                setting: getPriceProtectionSetting(),
              }, priceInfo), '*');
            }
          }
          // 价格追踪
          savePrice(priceInfo)
          if (!disable_pricechart && priceInfo.sku) {
            reportPrice(priceInfo)
          }
          done(priceInfo)
          break;
        // 促销信息
        case 'promotions':
          reportPromotions(msg)
          done({ result: "promotions_reported" })
          break;
        // 保存登录状态
        case 'saveLoginState':
          saveLoginState(msg)
          done(msg)
          break;
        // 获取登录状态
        case 'getLoginState':
          done(loginState)
          break;
        case 'getPriceProtectionSetting':
          let priceProtectionSetting = getPriceProtectionSetting()
          done(priceProtectionSetting)
          break;
        // 记住账号
        case 'saveAccount':
          if (msg.content.username && msg.content.password) {
            saveSetting('jjb_account', msg.content);
          }
          done({ result: "account_saved" })
          break;
        // 自动登录
        case 'autoLogin':
          if (autoLoginQuota[hourInYear]) {
            autoLoginQuota[hourInYear][msg.type] = 0
          } else {
            autoLoginQuota[hourInYear] = {
              [msg.type]: 0
            }
          }
          done(autoLoginQuota[hourInYear])
          break;
        // 保存变量值
        case 'setVariable':
          localStorage.setItem(msg.key, JSON.stringify(msg.value));
          done({ result: "variable_set" })
          break;
        // 获取设置
        case 'getSetting':
          let setting = getSetting(msg.content)
          let temporarySetting = localStorage.getItem('temporary_' + msg.content)
          // 如果存在临时设置
          if (temporarySetting) {
            // 临时设置5分钟失效
            setTimeout(() => {
              localStorage.removeItem('temporary_' + msg.content)
            }, 60 * 5 * 1000);
            done(temporarySetting)
          } else {
            done(setting)
          }
          break;
        // 获取页面参数
        case 'getPageSetting':
          let matchedTasks = findTasksByLocation(msg.location)
          done({
            tasks: matchedTasks
          })
          break;
        case 'beanCheckinPageResult':
          task = getTask(msg.taskId)
          done(await recordBeanCheckinPageResult(task, msg.payload || {}))
          break;
        case 'taskRunResult':
          task = getTask(msg.taskId)
          done(await recordTaskRunResult(task, msg.payload || {}))
          break;
        case 'getAccount':
          let account = getSetting('jjb_account', null)
          let loginTypeState = getSetting('jjb_login-state_' + msg.type, {})
          // 如果有 loginTypeState
          if (account && loginTypeState && loginTypeState.time) {
            loginTypeState.displayTime = DateTime.fromISO(loginTypeState.time).setLocale('zh-cn').toFormat('f')
            account.loginState = loginTypeState
          }
          // 如果有自动登录次数配额限制
          if (account && autoLoginQuota[hourInYear]) {
            account.autoLoginQuota = autoLoginQuota[hourInYear][msg.type]
          }
          done(account)
          break;
        case 'openLogin':
          openLoginPage(loginState)
          done({ result: "login_opened" })
          break;
        case 'openUrlAsMoblie':
          openWebPageAsMobile(msg.url)
          done({ result: "mobile_page_opened" })
          break;
        case 'openPricePro':
          chromeTabs.create({
            url: "https://pcsitepp-fm.jd.com/"
          })
          done({ result: "price_pro_opened" })
          break;
        // 登录失败
        case 'loginFailed':
          // 保存状态
          saveLoginState(msg)
          done({ result: "failed_logged" }) // Send response early
          if (getSetting("mute_login-failed", false)) break;
          let lastNoticeLoginFailedAt = getSetting('lastNoticeLoginFailedAt', null)
          if (lastNoticeLoginFailedAt && DateTime.local().hasSame(DateTime.fromISO(lastNoticeLoginFailedAt), 'day')) break;
          saveSetting('lastNoticeLoginFailedAt', DateTime.local().toISO())
          let loginErrMsg = (msg.type == 'pc' ? 'PC网页版' : '移动网页版') + "自动登录失败：" + msg.content
          if (msg.notice) {
            sendChromeNotification(new Date().getTime().toString() + "_login-failed_" + msg.type, {
              type: "basic",
              title: loginErrMsg,
              message: "请点击本通知手动完成登录",
              iconUrl: 'static/image/128.png',
              buttons: [
                {
                  "title": "现在登录"
                },
                {
                  "title": "不再提醒"
                }
              ]
            })
          }
          break;
        case 'option':
          localStorage.setItem('jjb_' + msg.title, msg.content);
          done({ result: "option_saved" })
          break;
        // 获取任务
        case 'getTask':
          task = getTask(msg.taskId)
          done(task)
          break;
        // 手动运行任务
        case 'runTask':
          task = getTask(msg.taskId)
          if (!task || task.unavailable || task.deprecated || task.new) {
            done({
              result: "failed",
              message: task && task.pause_description ? task.pause_description : "任务不可用"
            })
            break;
          }
          // set 临时运行
          localStorage.setItem(`temporary_job${task.id}_frequency`, 'onetime');
          runJob(task.id, true)
          if (!msg.hideNotice) {
            sendChromeNotification(new Date().getTime().toString(), {
              type: "basic",
              title: "正在重新运行" + task.title,
              message: "任务运行大约需要2分钟，如果有情况我再叫你（请勿连续运行）",
              iconUrl: 'static/image/128.png'
            })
          }
          done({
            result: "success"
          })
          break;
        case 'priceProtectionNotice':
          var play_audio = getSetting('play_audio')
          var hide_good = getSetting('hide_good')
          if (play_audio && play_audio == 'checked' || msg.test) {
            var myAudio = new Audio();
            myAudio.src = "static/audio/price_protection.ogg";
            myAudio.play();
          }
          if (!hide_good || hide_good != 'checked') {
            msg.content = (msg.product_name ? msg.product_name.substr(0, 22) : '') + msg.content
          }
          if (!msg.silent) {
            sendChromeNotification(new Date().getTime().toString() + '_' + msg.batch, {
              type: "basic",
              title: msg.title,
              message: msg.content,
              iconUrl: moneyIcon
            })
          }
          done({ result: "notice_sent" })
          break;
        case 'checkin_notice':
          var mute_checkin = getSetting('mute_checkin')
          if (mute_checkin && mute_checkin == 'checked' && !msg.test) {
            console.log('checkin', msg)
          } else {
            var play_audio = getSetting('play_audio')
            if (play_audio && play_audio == 'checked' || msg.test) {
              var myAudio = new Audio();
              if (msg.reward == "bean") {
                myAudio.src = "static/audio/beans.ogg";
              }
              if (myAudio.src) {
                myAudio.play();
              }
            }
            sendChromeNotification(new Date().getTime().toString() + '_' + msg.batch, {
              type: "basic",
              title: msg.title,
              message: msg.content,
              iconUrl: beanIcon
            })
          }
          done({ result: "checkin_notice_handled" })
          break;
        // 运行状态
        case 'runStatus':
          task = getTask(msg.task.id)
          localStorage.setItem('job' + task.id + '_lasttime', new Date().getTime())
          saveLoginState({
            content: task.title + "成功运行",
            state: "alive",
            type: msg.mode || task.type[0]
          })
          // 如果任务周期小于10小时，且不是计划任务，则安排下一次运行
          if (mapFrequency[task.frequency] < 600 && !task.schedule) {
            chromeAlarms.create('runJob_' + task.id, {
              delayInMinutes: mapFrequency[task.frequency]
            })
          }
          done({
            result: true
          })
          break;
        case 'create_tab':
          var content = JSON.parse(msg.content)
          chromeTabs.create({
            index: content.index,
            url: content.url,
            active: content.active == 'true',
            pinned: content.pinned == 'true'
          }, function (tab) {
            chromeTabs.update(tab.id, {
              muted: true
            }, function (result) {
              log('background', "muted tab", result)
            })
            chromeAlarms.create('closeTab_' + tab.id, { delayInMinutes: 1 })
          })
          done({ result: "tab_created" })
          break;
        // 发现新订单
        case 'findOrder':
          await new Promise(resolve => setTimeout(resolve, 50));
          await findOrder(msg.orderId, msg.order);
          done({ result: "order_found" })
          break;
        // 新的订单商品
        case 'findGood':
          await new Promise(resolve => setTimeout(resolve, 500));
          await findGood(msg.orderId, msg.good);
          await new Promise(resolve => setTimeout(resolve, 1000));
          await updateOrders();
          done({ result: "good_found" })
          break;
        // 查询商品列表
        case 'getOrders':
          await new Promise(resolve => setTimeout(resolve, 50));
          await updateOrders();
          done({ result: "orders_updated" })
          break;
        // 查询价格历史
        case 'getPriceChart':
          await new Promise(resolve => setTimeout(resolve, 50));
          await getPriceChart(msg.sku, msg.days, originalSender);
          done({ result: "price_chart_requested" })
          break;
        // 查询消息列表
        case 'getMessages':
          await new Promise(resolve => setTimeout(resolve, 50));
          let messages = await updateMessages();
          saveSetting('lastOpenPopupAt', DateTime.local().toISO())
          done({ result: "messages_updated", messages: messages })
          break;
        case 'clearUnread':
          updateUnreadCount(-999)
          done({ result: "unread_cleared" })
          break;
        case 'myTab':
          done({
            tab: originalSender.tab
          });
          break;
        default:
          console.log("Received %o from %o, frame", msg, originalSender.tab, originalSender.frameId);
          // Always send a response even for unknown actions to prevent timeout
          done({ result: "unknown_action", action: msg.action })
      }
    } catch (error) {
      console.error("Error processing message:", error);
      done({ error: error.toString() });
    }
  })();

  // 更新图标
  updateIcon()
  // task log
  if (msg.log && msg.task) {
    setTimeout(async () => {
      await findAndUpdateTaskResult(msg.task.id, {
        action: msg.action,
        title: msg.title,
        content: msg.content,
        timestamp: Date.now()
      })
    }, 50);
  }
  // 保存消息
  switch (msg.action) {
    case 'notice':
    case 'priceProtectionNotice':
    case 'checkin_notice':
      if (msg.test) {
        break;
      }
      // 如果是单次任务完成的通知
      if (msg.task && msg.task.onetimeKey) {
        saveSetting(`task_onetime_${msg.task.onetimeKey}`, {
          time: new Date(),
          message: msg.message
        })
      }
      let message = {
        taskId: msg.task ? msg.task.id : null,
        type: msg.type || msg.action || msg.text,
        batch: msg.batch, // 批次，通常是优惠券的属性
        reward: msg.reward, // 奖励的类型
        unit: msg.unit || msg.reward || msg.batch, // 奖励的单位
        value: msg.value, // 奖励的数量
        status: msg.status,
        title: msg.title,
        content: msg.content,
        timestamp: Date.now()
      }
      let messageType = msg.type || msg.action || msg.text
      let checkinBatch = msg.batch || (msg.task && msg.task.key)
      let uuid = messageType == 'checkin_notice' && checkinBatch
        ? `checkin:${checkinBatch}:${DateTime.local().toISODate()}`
        : (msg.uuid || Date.now())
      if (messageType == 'checkin_notice' && !message.batch) {
        message.batch = checkinBatch
      }
      setTimeout(async () => {
        let savedMessage = await newMessage(uuid, message);
        if (savedMessage.created) updateUnreadCount(1)
      }, 50);
      setTimeout(async () => {
        await updateMessages()
      }, 3000);
      break;
  }
  if (msg.action != 'saveAccount') {
    log('message', msg.text, msg);
  }
  return true
});

// Functions

function saveJobStack(jobStack) {
  jobStack = _.uniq(jobStack)
  localStorage.setItem('jobStack', JSON.stringify(jobStack));
}

function findTasksByLocation(location) {
  let taskList = getTasks()
  let locationTask = taskList.filter(task => task.location && Object.keys(task.location).length > 0)
  let matchedTasks = []
  locationTask.forEach((task) => {
    if (Object.keys(task.location).every((key) => task.location[key].indexOf(location[key]) > -1)) {
      matchedTasks.push(task)
    }
  })
  return matchedTasks
}

function scheduleJob(task) {
  let hour = DateTime.local().hour;
  for (var i = 0, len = task.schedule.length; i < len; i++) {
    let scheduledHour = task.schedule[i]
    if (scheduledHour > hour) {
      let scheduledTime = DateTime.local().set({
        hour: scheduledHour,
        minute: rand(2) - 1,
        second: rand(55)
      }).valueOf()
      chromeAlarms.create('runScheduleJob_' + task.id, {
        when: scheduledTime
      })
      log('background', "schedule job created", {
        job: task,
        time: scheduledHour,
        when: scheduledTime
      })
      break;
    }
  }
}

function pushJob(task, jobStack) {
  if (task.schedule) {
    chromeAlarms.get('runScheduleJob_' + task.id, function (alarm) {
      if (!alarm || alarm.scheduledTime < Date.now()) {
        return scheduleJob(task)
      } else {
        console.log("job already scheduled ", alarm)
      }
    })
    return jobStack
  } else {
    jobStack.push(task.id)
  }
  return jobStack
}

function findJobs(platform) {
  let jobStack = getSetting('jobStack', [])
  let taskList = getTasks(platform)

  taskList.forEach(function (task) {
    if (task.suspended || task.deprecated || task.pause) {
      return console.log(task.title, '任务已暂停', task)
    }
    if (task.checked) {
      return console.log(task.title, '任务已完成')
    }
    switch (task.frequency) {
      case '2h':
        // 如果从没运行过，或者上次运行已经过去超过2小时，那么需要运行
        if (!task.last_run_at || (DateTime.local() > DateTime.fromMillis(task.last_run_at).plus({ hours: 2 }))) {
          jobStack = pushJob(task, jobStack)
        }
        break;
      case '5h':
        // 如果从没运行过，或者上次运行已经过去超过5小时，那么需要运行
        if (!task.last_run_at || (DateTime.local() > DateTime.fromMillis(task.last_run_at).plus({ hours: 5 }))) {
          jobStack = pushJob(task, jobStack)
        }
        break;
      case 'daily':
        // 如果从没运行过，或者上次运行不在今天，或者是签到任务但未完成
        if (!task.last_run_at || !(DateTime.local().hasSame(DateTime.fromMillis(task.last_run_at), 'day')) || (task.checkin && !task.checked)) {
          jobStack = pushJob(task, jobStack)
        }
        break;
      default:
        console.log('ok, never run ', task.title)
    }
  });
  saveJobStack(jobStack)
}

async function runJob(taskId, force = false) {
  // 不在凌晨阶段运行非强制任务
  if (DateTime.local().hour < 6 && !force) {
    return console.log('Silent Night')
  }
  log('background', "run job", {
    taskId,
    force
  })
  // 如果没有指定任务ID 就从任务栈里面找一个
  if (!taskId) {
    let jobStack = getSetting('jobStack', [])
    if (jobStack && jobStack.length > 0) {
      taskId = jobStack.shift();
      saveJobStack(jobStack)
    } else {
      return log('info', '好像没有什么事需要我做...')
    }
  }
  let task = getTask(taskId)

  // 如果任务已暂停
  if (task.pause && !force) {
    return log('job', task, '已被暂停')
  }

  // 如果任务已挂起或已经弃用 且不是强制执行
  if (task.deprecated) {
    return log('job', task, '任务入口已失效，不再运行')
  }
  if (task.suspended && !force) {
    return log('job', task, '由于账号未登录已暂停运行')
  }

  // 开始运行任务
  if (task.frequency != 'never' || force) {
    log('background', "run", task)
    currentTask = task
    setTimeout(() => {
      currentTask = null
    }, 3 * 60 * 1000);
    localStorage.setItem(`task-started-at:${task.id}`, Date.now())
    await addTaskLog(task)
    if (task.mode == 'tab') {
      openByTab(task)
    } else {
      openByIframe(task.url, 'job')
    }
  }
}

async function recordBeanCheckinPageResult(task, payload) {
  if (!task || task.id != '11') return { status: 'failed', content: '未找到每日京豆签到任务' }
  let status = payload.status == 'success' ? 'success' : 'failed'
  let value = Number(payload.value) > 0 ? Number(payload.value) : null
  let balance = Number(payload.balance) >= 0 ? Number(payload.balance) : null
  let beforeBalance = Number(payload.beforeBalance) >= 0 ? Number(payload.beforeBalance) : null
  let previousRecord = getSetting('jjb_checkin_bean', null)
  let valueFromPreviousRecord = false
  if (beforeBalance === null && previousRecord && previousRecord.date == DateTime.local().toISODate()) {
    const beforeBalanceMatch = String(previousRecord.beforeBalance || '').match(/[0-9]+/)
    beforeBalance = beforeBalanceMatch ? Number(beforeBalanceMatch[0]) : null
  }
  if (!value && previousRecord && previousRecord.date == DateTime.local().toISODate()) {
    value = Number(String(previousRecord.value || '').replace(/[^0-9]/g, '')) || null
    valueFromPreviousRecord = !!value
  }
  if (balance === null && previousRecord && previousRecord.date == DateTime.local().toISODate()) {
    const balanceMatch = String(previousRecord.balance || '').match(/[0-9]+/)
    balance = balanceMatch ? Number(balanceMatch[0]) : null
  }
  if (beforeBalance !== null && balance !== null && balance >= beforeBalance) {
    value = balance - beforeBalance
    valueFromPreviousRecord = false
  }
  let content = payload.content || (status == 'success' ? '每日京豆签到成功' : '我的京豆页面未返回签到结果')
  if (status == 'success') {
    let beforeText = beforeBalance !== null ? `签到前${beforeBalance}京豆` : '签到前余额未获取'
    let afterText = balance !== null ? `签到后${balance}京豆` : '签到后余额未获取'
    let receivedText = value !== null ? `${valueFromPreviousRecord ? '今日已领取' : '本次领取'}${value}京豆` : '领取数量未从页面获取'
    content = `${beforeText}，${afterText}，${receivedText}`
  }

  let now = DateTime.local()
  if (status == 'success') {
    localStorage.setItem('jjb_checkin_bean', JSON.stringify({
      date: now.toISODate(),
      time: now.toISO(),
      value: value ? `${value}京豆` : null,
      beforeBalance: beforeBalance !== null ? `${beforeBalance}京豆` : null,
      balance: balance !== null ? `${balance}京豆` : null
    }))
  }
  localStorage.setItem('job' + task.id + '_lasttime', Date.now())
  let messageId = `checkin:bean:${now.toISODate()}`
  let savedMessage = await newMessage(messageId, {
    taskId: task.id,
    type: 'checkin_notice',
    batch: 'bean',
    reward: status == 'success' ? 'bean' : null,
    unit: '京豆',
    value: value,
    beforeBalance: beforeBalance,
    balance: balance,
    status: status,
    title: status == 'success' ? '每日京豆签到完成' : '每日京豆签到未完成',
    content: content,
    timestamp: Date.now()
  })
  if (savedMessage.created) updateUnreadCount(1)
  await findAndUpdateTaskResult(task.id, {
    action: 'checkin_notice',
    title: status == 'success' ? '签到成功' : '签到失败',
    content: content,
    status: status,
    timestamp: Date.now()
  })
  await updateMessages()
  if (status == 'failed' || getSetting('mute_checkin') != 'checked') {
    sendChromeNotification(`bean-checkin_${now.toISODate()}`, {
      type: 'basic',
      title: status == 'success' ? '每日京豆签到完成' : '每日京豆签到未完成',
      message: content,
      iconUrl: beanIcon
    })
  }
  return { status, value, content }
}

async function recordTaskRunResult(task, payload) {
  if (!task) return { status: 'failed', content: '未找到任务' }
  let status = payload.status == 'success' ? 'success' : 'failed'
  let content = payload.content || (status == 'success' ? `${task.title}运行完成` : `${task.title}运行失败`)
  let startedAt = Number(localStorage.getItem(`task-started-at:${task.id}`) || Date.now())
  let savedMessage = await newMessage(`task-run:${task.id}:${startedAt}`, {
    taskId: task.id,
    type: 'notice',
    batch: `task-${task.id}-run`,
    status: status,
    title: status == 'success' ? `${task.title}检查完成` : `${task.title}检查未完成`,
    content: content,
    timestamp: Date.now()
  })
  if (savedMessage.created) updateUnreadCount(1)
  await findAndUpdateTaskResult(task.id, {
    action: 'taskRunResult',
    title: status == 'success' ? '检查完成' : '检查失败',
    content: content,
    status: status,
    timestamp: Date.now()
  })
  await updateMessages()
  if (status == 'failed') {
    sendChromeNotification(`task-run-failed_${task.id}_${startedAt}`, {
      type: 'basic',
      title: `${task.title}检查未完成`,
      message: content,
      iconUrl: task.id == '32' ? moneyIcon : beanIcon
    })
  }
  return { status, content }
}

function savePrice(price) {
  let skuPriceList = localStorage.getItem('skuPriceList') ? JSON.parse(localStorage.getItem('skuPriceList')) : {}
  skuPriceList[price.sku] = price
  localStorage.setItem('skuPriceList', JSON.stringify(skuPriceList));
  return skuPriceList
}

function log(type, message, details) {
  if (!logger[type]) {
    logger[type] = new Logline(type)
  }
  logger[type].info(message, details)
  console.log(new Date(), type, message, details)
}

function resetIframe(domId) {
  const existing = document.getElementById(domId);
  if (existing) existing.remove();
  const iframe = document.createElement('iframe');
  iframe.id = domId;
  iframe.width = "400 px";
  iframe.height = "600 px";
  iframe.src = "";
  document.body.appendChild(iframe);
}

function openByIframe(src, type, delayTimes = 0) {
  // 加载新的任务
  let iframeId = "iframe"
  let keepMinutes = 6
  if (type == 'temporary') {
    iframeId = 'iframe' + rand(10241024)
    keepMinutes = 1
  }
  // 当前任务过多则等待
  if ($('iframe').length > 5 && delayTimes < 6) {
    setTimeout(() => {
      openByIframe(src, type, delayTimes + 1)
    }, (10 + rand(10)) * 1000);
    return console.log('too many iframe pages', src, delayTimes)
  }
  // 运行
  resetIframe(iframeId)
  $("#" + iframeId).attr('src', src)
  // 设置重置任务
  chromeAlarms.create((type == 'temporary' ? 'destroyIframe_' : 'clearIframe_') + iframeId, {
    delayInMinutes: keepMinutes
  })
}

function openByTab(task) {
  chromeTabs.create({
    url: task.url,
    active: false
  }, function (tab) {
    if (!tab || !tab.id) {
      verifyTaskResult(task.id)
      return
    }
    chromeTabs.update(tab.id, { muted: true })
    chromeAlarms.create('verifyTask_' + task.id + '_' + tab.id, { delayInMinutes: task.id == '11' ? 2 : 1 })
    chromeAlarms.create('closeTab_' + tab.id, { delayInMinutes: task.id == '1' ? 6 : 3 })
  })
}

async function verifyTaskResult(taskId) {
  let task = getTask(taskId)
  if (!task) return
  if (task.id == '1') {
    let startedAt = Number(localStorage.getItem('task-started-at:1') || Date.now())
    let cachedMessages = getSetting('jjb_messages', [])
    let hasResult = cachedMessages.some(message => (
      message.taskId == '1' &&
      message.batch == 'jiabao-run' &&
      message.timestamp >= startedAt
    ))
    if (hasResult) return
    let savedMessage = await newMessage(`price-run:${startedAt}`, {
      taskId: '1',
      type: 'priceProtectionNotice',
      batch: 'jiabao-run',
      status: 'failed',
      title: '价格保护检查未完成',
      content: '价保页面未返回检查结果，请检查京东登录状态后重新运行',
      timestamp: Date.now()
    })
    if (savedMessage.created) updateUnreadCount(1)
    await updateMessages()
    sendChromeNotification(`price-run-failed_${startedAt}`, {
      type: 'basic',
      title: '价格保护检查未完成',
      message: '请检查京东登录状态后重新运行',
      iconUrl: moneyIcon
    })
    return
  }
  if (task.id == '32') {
    let startedAt = Number(localStorage.getItem('task-started-at:32') || Date.now())
    let cachedMessages = getSetting('jjb_messages', [])
    let hasResult = cachedMessages.some(message => (
      message.taskId == '32' &&
      message.batch == 'task-32-run' &&
      message.timestamp >= startedAt
    ))
    if (!hasResult) {
      await recordTaskRunResult(task, {
        status: 'failed',
        content: '购物车页面未返回检查结果，请检查京东登录状态后重新运行'
      })
    }
    return
  }
  if (!task.checkin || task.checked) return
  let today = DateTime.local().toISODate()
  let messageId = `checkin:${task.key}:${today}`
  let cachedMessages = getSetting('jjb_messages', [])
  if (cachedMessages.some(message => message.id == messageId && message.status == 'success')) return
  let savedMessage = await newMessage(messageId, {
    taskId: task.id,
    type: 'checkin_notice',
    batch: task.key,
    unit: task.key == 'bean' ? '京豆' : task.key,
    status: 'failed',
    title: task.title + '未完成',
    content: '任务页面未返回签到结果，请检查京东登录状态后重新运行',
    timestamp: Date.now()
  })
  if (savedMessage.created) updateUnreadCount(1)
  await updateMessages()
  sendChromeNotification(`checkin-failed_${task.id}_${today}`, {
    type: 'basic',
    title: task.title + '未完成',
    message: '请检查京东登录状态后重新运行',
    iconUrl: beanIcon
  })
}

function updateUnreadCount(change = 0) {
  let lastUnreadCount = localStorage.getItem('unreadCount') || 0
  let unreadCount = parseInt(Number(lastUnreadCount) + change)
  if (unreadCount < 0) {
    unreadCount = 0
  }
  localStorage.setItem('unreadCount', unreadCount);
  if (unreadCount > 0) {
    let unreadCountText = unreadCount.toString()
    if (unreadCount > 100) {
      unreadCountText = '99+'
    }
    chromeAction.setBadgeText({ text: unreadCountText });
    chromeAction.setBadgeBackgroundColor({ color: "#4caf50" });
  } else {
    chromeAction.setBadgeText({ text: "" });
  }
}

function removeExpiredLocalStorageItems() {
  let arr = [];
  for (var i = 0; i < localStorage.length; i++) {
    if (localStorage.key(i).indexOf('temporary:') == 0) {
      arr.push(localStorage.key(i));
    }
  }

  for (var i = 0; i < arr.length; i++) {
    localStorage.removeItem(arr[i]);
  }
}

async function cleanupDeprecatedTasks() {
  if (getSetting('deprecated-task-cleanup-v1', false)) return
  const deprecatedTaskIds = new Set(['2', '5', '14', '15', '16', '22', '23'])
  const keysToRemove = []
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (
      /^job(2|5|14|15|16|22|23)(_|$)/.test(key) ||
      /^task-(2|5|14|15|16|22|23):settings$/.test(key) ||
      /^task-usage:(2|5|14|15|16|22|23)$/.test(key) ||
      /^task-started-at:(2|5|14|15|16|22|23)$/.test(key) ||
      /^temporary:task-messages:(2|5|14|15|16|22|23):/.test(key) ||
      key == 'jjb_checkin_baitiao' || key == 'jjb_checkin_gcmall' || key == 'mute_coupon'
    ) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key))
  const storedJobStack = getSetting('jobStack', [])
  const jobStack = (Array.isArray(storedJobStack) ? storedJobStack : []).filter(taskId => !deprecatedTaskIds.has(String(taskId)))
  saveJobStack(jobStack)
  const storedTaskParameters = getSetting('task-parameters', [])
  const taskParameters = (Array.isArray(storedTaskParameters) ? storedTaskParameters : []).filter(task => !deprecatedTaskIds.has(String(task.id)))
  saveSetting('task-parameters', taskParameters)
  await cleanupDeprecatedTaskData()
  await updateMessages()
  saveSetting('deprecated-task-cleanup-v1', true)
}

$(document).ready(async function () {
  currentTask = null
  log('background', "document ready", new Date())
  await cleanupDeprecatedTasks()
  // 每10分钟运行一次定时任务
  chromeAlarms.create('cycleTask', {
    periodInMinutes: 10
  })

  // 每600分钟完全重载
  chromeAlarms.create('reload', { periodInMinutes: 600 })

  // 载入后马上运行一次任务查找
  findJobs()

  // 载入显示未读数量
  updateUnreadCount()

  // 加载任务参数
  loadSettingsToLocalStorage('task-parameters')
  loadSettingsToLocalStorage('action-links')

  // 加载推荐设置
  loadRecommendSettingsToLocalStorage()

  // 移除临时缓存项（只在20点～8点运行）
  if (new Date().getHours() > 20 || new Date().getHours() < 8) {
    removeExpiredLocalStorageItems()
  }
})

function openWebPageAsMobile(url) {
  chromeWindows.create({
    width: 420,
    height: 800,
    url: url,
    type: "popup"
  });
}

function openLoginPage(loginState) {
  chromeTabs.create({
    url: "https://home.jd.com"
  })
}

function handleNotificationClick(notificationId) {
  if (notificationId.split('_').length > 0) {
    let batch = notificationId.split('_')[1]
    let type = notificationId.split('_')[2]
    if (batch && batch.length > 1) {
      switch (batch) {
      case 'bean':
        chromeTabs.create({
          url: "https://bean.jd.com/myJingBean/list"
        })
          break;
        case 'jiabao':
          chromeTabs.create({
            url: "https://pcsitepp-fm.jd.com/"
          })
          break;
        case 'login-failed':
          if (type == 'pc') {
            chromeTabs.create({
              url: "https://passport.jd.com/uc/login"
            })
          } else {
            openWebPageAsMobile(mLoginUrl)
          }
          break;
        default:
          break;
      }
    }
  }
}

function handleNotificationButtonClick(notificationId, buttonIndex) {
  if (notificationId.split('_').length > 0) {
    let batch = notificationId.split('_')[1]
    let type = notificationId.split('_')[2]
    if (batch != 'login-failed') {
      return
    }

    if (buttonIndex == 1) {
      return saveSetting("mute_login-failed", true)
    }
    switch (type) {
      case 'pc':
        if (buttonIndex == 0) {
          chromeTabs.create({
            url: "https://passport.jd.com/uc/login"
          })
        }
        break;
      case 'm':
        if (buttonIndex == 0) {
          openWebPageAsMobile(mLoginUrl)
        }
        break;
      default:
      // Removed zaoshu.so link
    }
  }
}

chrome.runtime.sendMessage({
  type: 'UPDATE_CONTEXT_MENU',
  action: 'create',
  menuProperties: {
    title: "作为独立窗口打开",
    contexts: ["action"],
    id: "open-popup"
  }
});

function resetIcon() {
  chromeAction.getBadgeText({}, function (text) {
    if (text == "X" || text == " ! ") {
      chromeAction.setBadgeText({
        text: ""
      });
      chromeAction.setTitle({
        title: "京价保"
      })
    }
  })
  chromeAction.setIcon({
    path: {
      "19": "static/image/icon/jjb19x.png",
      "38": "static/image/icon/jjb38x.png"
    }
  });
}

function updateIcon() {
  let loginState = getLoginState()
  switch (loginState.class) {
    case 'alive':
      resetIcon();
      chrome.runtime.sendMessage({
        type: 'UPDATE_CONTEXT_MENU',
        action: 'remove',
        menuId: "login-notice"
      });
      break;
    case 'failed':
      chromeAction.setBadgeBackgroundColor({
        color: [190, 190, 190, 230]
      });
      chromeAction.setBadgeText({
        text: "X"
      });
      chromeAction.setTitle({
        title: "账号登录失效"
      })
      chromeAction.setIcon({
        path: {
          "19": "static/image/icon/offline19x.png",
          "38": "static/image/icon/offline38x.png"
        }
      });
      chrome.runtime.sendMessage({
        type: 'UPDATE_CONTEXT_MENU',
        action: 'remove',
        menuId: "login-notice"
      });
      chrome.runtime.sendMessage({
        type: 'UPDATE_CONTEXT_MENU',
        action: 'create',
        menuProperties: {
          id: "login-notice",
          title: "账号登录失效，点击登录",
          contexts: ["action"]
        }
      });
      break;
    case 'warning':
      let lastOpenPopupAt = getSetting('lastOpenPopupAt', null)
      if (lastOpenPopupAt && DateTime.fromJSDate(new Date(loginState.m.time)) > DateTime.fromISO(lastOpenPopupAt)) {
        chromeAction.setBadgeBackgroundColor({
          color: "#EE7E1B"
        });
        chromeAction.setBadgeText({
          text: " ! "
        });
        chromeAction.setIcon({
          path: {
            "19": "static/image/partial-offline19x.png",
            "38": "static/image/partial-offline38x.png"
          }
        });
        chrome.runtime.sendMessage({
          type: 'UPDATE_CONTEXT_MENU',
          action: 'remove',
          menuId: "login-notice"
        });
        chrome.runtime.sendMessage({
          type: 'UPDATE_CONTEXT_MENU',
          action: 'create',
          menuProperties: {
            id: "login-notice",
            title: "登录部分失效，点击登录",
            contexts: ["action"]
          }
        });
      } else {
        resetIcon();
      }
      break;
    default:
      break;
  }
}

function saveLoginState(loginState) {
  let previousState = getLoginState()
  localStorage.setItem('jjb_login-state_' + loginState.type, JSON.stringify({
    time: new Date(),
    message: loginState.content || loginState.message,
    state: loginState.state
  }));
  chrome.runtime.sendMessage({
    action: "loginState_updated",
    data: loginState
  });
  if (previousState[loginState.type].state != 'alive' && loginState.state == "alive") {
    setTimeout(() => {
      log('background', "login alive run job 1")
      if (!currentTask || currentTask.id != '1') {
        runJob('1')
      }
    }, 15000);
    setTimeout(() => {
      findJobs(loginState.type)
    }, 30000);
  }
}

function sendChromeNotification(id, content) {
  let hour = DateTime.local().hour;
  let muteNight = getSetting('mute_night', true);
  if (muteNight && hour < 6) {
    log('background', 'mute_night', content);
  } else {
    chromeNotifications.create(id, content)
    log('message', id, content);
  }
}

function getPriceProtectionSetting() {
  let pro_min = getSetting('price_pro_min', 0.1);
  let is_plus = (getSetting('is_plus') ? getSetting('is_plus') == 'checked' : false) || (getSetting('jjb_plus') == 'Y')
  let prompt_only = getSetting('prompt_only') ? getSetting('prompt_only') == 'checked' : false
  let suspendedApplyIds = getSetting("suspendedApplyIds", []);
  return {
    pro_min,
    prompt_only,
    is_plus,
    suspendedApplyIds
  }
}

function reportPrice(priceInfo) {
}

function reportPromotions(promInfo) {
}

function loadSettingsToLocalStorage(key) {
}

function loadRecommendSettingsToLocalStorage() {
}

function getPriceChart(sku, days = 30, sender) {
  chromeTabs.sendMessage(sender.tab.id, {
    type: "priceChart",
    error: "Price chart service disabled"
  });
}

Logline.keep(3);
