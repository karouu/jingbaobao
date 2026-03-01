import { DateTime } from 'luxon'
import { getLoginState } from './account'
import { getSetting, readableTime } from './utils'
import { getTaskUsageImmediately, getTodayMessagesByTaskIdImmediately } from './db'

const priceProUrl = "https://msitepp-fm.jd.com/rest/priceprophone/priceProPhoneMenu"
const frequencyOptionText = {
  '2h': "每2小时",
  '5h': "每5小时",
  'daily': "每天",
  'never': "从不"
}
const mapFrequency = {
  '2h': 2 * 60,
  '5h': 5 * 60,
  'daily': 24 * 60,
  'never': 99999
}

const tasks = [
  {
    id: '1',
    src: {
      m: "https://msitepp-fm.jd.com/rest/priceprophone/priceProPhoneMenu",
      pc: "https://pcsitepp-fm.jd.com/rest/pricepro/priceapply"
    },
    title: '价格保护',
    description: "价格保护只显示京东系统尚在价保有效期内的商品",
    mode: 'iframe',
    type: ['pc', 'm'],
    frequencyOption: ['2h', '5h', 'daily', 'never'],
    frequency: '5h',
    location: {
      host: ['pcsitepp-fm.jd.com', 'msitepp-fm.jd.com']
    },
    rateLimit: {
      weekly: 55,
      daily: 10,
      hour: 2
    }
  },
  {
    id: '15',
    src: {
      pc: 'https://a.jd.com',
    },
    url: 'https://a.jd.com',
    title: '全品类券',
    description: "每天尝试领取全品类券（29减2/105减5/500减20/1000减30）",
    schedule: [10, 12, 14, 16, 18, 20, 22],
    mode: 'iframe',
    location: {
      host: ['a.jd.com'],
      pathname: ['/']
    },
    type: ['pc'],
    frequencyOption: ['5h', 'daily', 'never'],
    frequency: '5h',
    rateLimit: {
      weekly: 55,
      daily: 10,
      hour: 2
    }
  },
  {
    id: '16',
    src: {
      m: 'https://m.jr.jd.com/btyingxiao/marketing/html/index.html',
    },
    title: '白条免息红包',
    description: "大部分情况获得京豆，也有可能白条券",
    key: "baitiao",
    checkin: true,
    mode: 'iframe',
    type: ['m'],
    frequencyOption: ['daily', 'never'],
    frequency: 'daily',
    rateLimit: {
      weekly: 32,
      daily: 4,
      hour: 2
    }
  },
  {
    id: '22',
    src: {
      m: 'https://member.jr.jd.com/gcmall/',
    },
    key: "gcmall",
    checkin: true,
    title: '领取金融金币',
    description: "领取京东金融各种返金币",
    mode: 'iframe',
    type: ['m'],
    frequencyOption: ['daily', 'never'],
    frequency: 'daily',
    location: {
      host: ['member.jr.jd.com'],
      pathname: ['/gcmall/']
    },
    rateLimit: {
      weekly: 14,
      daily: 3,
      hour: 2
    }
  },
  {
    id: '32',
    src: {
      pc: 'https://cart.jd.com',
    },
    url: 'https://cart.jd.com',
    title: '购物车降价提醒',
    description: "在购物车商品发生降价时提醒（将商品加入购物放几天京东有机会会定向降价）",
    mode: 'iframe',
    location: {
      host: ['cart.jd.com'],
      pathname: ['/']
    },
    type: ['pc'],
    frequencyOption: ['2h', '5h', 'daily', 'never'],
    frequency: '2h',
    rateLimit: {
      weekly: 55,
      daily: 10,
      hour: 2
    }
  },
]

// 根据登录状态选择任务模式
let findTaskPlatform = function (task) {
  let loginState = getLoginState()

  return task.type.find((platform) => loginState[platform].state == 'alive')
}

let getTask = function (taskId, currentPlatform) {
  let taskParameters = getSetting('task-parameters', [])
  let taskSettings = getSetting(`task-${taskId}:settings`, {})
  let parameters = (Array.isArray(taskParameters) && taskParameters.length > 0) ? taskParameters.find(t => t.id == taskId.toString()) : {}
  let task = Object.assign({}, {
    rateLimit: {
      weekly: 21,
      daily: 5,
      hour: 2
    }
  }, tasks.find(t => t.id == taskId.toString()), parameters, taskSettings)
  let taskStatus = {}
  taskStatus.platform = findTaskPlatform(task);
  taskStatus.frequency = getSetting(`job${taskId}_frequency`, task.frequency)
  taskStatus.usage = getTaskUsageImmediately(taskId)
  taskStatus.last_run_at = localStorage.getItem(`job${task.id}_lasttime`) ? parseInt(localStorage.getItem(`job${task.id}_lasttime`)) : null
  taskStatus.last_run_description = taskStatus.last_run_at ? "上次运行： " + readableTime(DateTime.fromMillis(Number(taskStatus.last_run_at))) : "从未执行";

  // 如果是签到任务，则读取签到状态
  if (task.checkin) {
    let checkinRecord = getSetting(`jjb_checkin_${task.key}`, null)
    if (checkinRecord && checkinRecord.date == DateTime.local().toFormat("o")) {
      taskStatus.checked = true
      taskStatus.checkin_description = "完成于：" + readableTime(DateTime.fromISO(checkinRecord.time)) + (checkinRecord.value ? "，领到：" + checkinRecord.value : "");
    }
  }

  // 如果是单次任务，则读取完成状态
  if (task.onetimeKey) {
    let onetimeRecord = getSetting(`task_onetime_${task.onetimeKey}`, null)
    if (onetimeRecord) {
      taskStatus.checked = true
      taskStatus.checkin_description = `完成于：${readableTime(DateTime.fromISO(onetimeRecord.time))} ${onetimeRecord.message}`
    }
  }

  // 如果是每日任务，则读取当日运行结果
  if (!task.checkin && !task.onetimeKey && task.frequency == 'daily') {
    task.messages = getTodayMessagesByTaskIdImmediately(task.id)
    if (task.messages.length > 0) {
      let lastDone = task.messages[0]
      taskStatus.checked = true
      taskStatus.checkin_description = "最近一次完成于：" + readableTime(DateTime.fromMillis(lastDone.timestamp)) + (lastDone.value ? "，领到：" + lastDone.value : "") + (lastDone.reward ? ({ goldCoin: "金币", bean: "京豆", coin: "钢镚" }[lastDone.reward] || "") : "");
    }
  }

  // 如果限定平台
  if (currentPlatform) {
    if (task.type && task.type.indexOf(currentPlatform) < 0) {
      taskStatus.unavailable = true
    }
  }
  // 选择运行平台
  if (!task.url) {
    taskStatus.url = taskStatus.platform ? task.src[taskStatus.platform] : task.src[task.type[0]];
  }
  // 如果任务无可运行平台
  if (!taskStatus.platform) {
    taskStatus.suspended = true;
    taskStatus.platform = task.type[0];
  }
  // 如果超出限制
  if ((task.rateLimit.weekly && taskStatus.usage.weekly >= task.rateLimit.weekly) || taskStatus.usage.daily >= task.rateLimit.daily || taskStatus.usage.hour >= task.rateLimit.hour) {
    taskStatus.pause = true;
    taskStatus.pause_description = `超出频率限制`
  }
  // 如果是新任务
  if (task.new) {
    taskStatus.pause = true;
    taskStatus.pause_description = `新任务`
  }
  return Object.assign(task, taskStatus)
}

let getTasks = function (currentPlatform) {
  let taskList = tasks.map((task) => {
    return getTask(task.id, currentPlatform)
  })
  return taskList.filter(task => !(task.unavailable || task.deprecated));
}

export {
  priceProUrl,
  frequencyOptionText,
  mapFrequency,
  tasks,
  getTask,
  getTasks,
  findTaskPlatform
};