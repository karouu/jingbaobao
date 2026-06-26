import Dexie from 'dexie';
import { readableTime, getSetting, saveSetting } from './utils'
import { DateTime } from 'luxon'

//
// Declare Database
//
const db = new Dexie("orders");

db.version(1).stores({ orders: "++id,timestamp" });
db.version(1).stores({ messages: "++id,type,timestamp" });

db.version(2).stores({
  orders: "++id,timestamp",
  messages: "++id,type,timestamp",
});

db.version(3).stores({
  orders: "++id,timestamp",
  messages: "++id,type,timestamp",
  taskLogs: "++id,taskId,timestamp",
});

async function findGood(orderId, good) {
  await db.orders.where('id').equals(orderId).modify(order => {
    if (!order.goods) order.goods = [];

    let hasGood = order.goods.some((item) => {
      return item &&
        item.sku == good.sku &&
        item.name == good.name &&
        Number(item.order_price) == Number(good.order_price) &&
        Number(item.quantity || 1) == Number(good.quantity || 1)
    });

    if (!hasGood) {
      order.goods.push(good);
    }
  });
}

function uniqueGoods(goods) {
  if (!goods || goods.length < 1) return []

  return goods.reduce((result, good) => {
    if (!good) return result

    let key = [
      good.sku || '',
      good.name || '',
      Number(good.order_price || 0),
      Number(good.quantity || 1)
    ].join('|')

    if (!result.keys.includes(key)) {
      result.keys.push(key)
      result.goods.push(good)
    }

    return result
  }, { keys: [], goods: [] }).goods
}

async function findOrder(orderId, data) {
  let order = await db.orders.where('id').equals(orderId).toArray();
  data.goods = uniqueGoods(data.goods)
  if (order && order.length > 0) {
    return await db.orders.where('id').equals(orderId).modify((order) => {
      Object.assign(order, data)
      order.goods = uniqueGoods(order.goods)
    })
  }
  let orderInfo = Object.assign(data, {
    id: orderId,
  })
  return await db.orders.add(orderInfo);
}

async function updateOrders() {
  let orders = await db.orders.where('timestamp').above(Date.now() - 60*60*1000*24*45).reverse().sortBy('timestamp')

  if (orders && orders.length > 0) {
    orders = orders.map((order) => {
      order.goods = uniqueGoods(order.goods)
      return order
    }).filter(order => order.goods && order.goods.length > 0);
  }
  saveSetting('jjb_orders', orders)
  chrome.runtime.sendMessage({
    action: "orders_updated",
    orders: orders
  });
}

async function newMessage(messageId, data) {
  let existingMessage = await db.messages.get(messageId)
  let messageInfo = Object.assign(data, {
    id: messageId,
  })
  await db.messages.put(messageInfo);
  return {
    id: messageId,
    created: !existingMessage
  }
}

async function updateMessages() {
  // 最多只展示最近 30 天的消息
  let last30Day = Date.now() - 60*60*1000*24*30;
  let messages = await db.messages.where('timestamp').above(last30Day).reverse().sortBy('timestamp')
  saveSetting('jjb_messages', messages)
  chrome.runtime.sendMessage({
    action: "messages_updated",
    messages: messages
  });
  return messages;
}

async function cleanupDeprecatedTaskData() {
  const deprecatedTaskIds = new Set(['2', '5', '14', '15', '16', '22', '23'])
  const deprecatedTypes = new Set(['coupon', 'couponReceived', 'goldCoinReceived', 'beanReceived'])
  const deprecatedBatches = new Set(['baitiao', 'gcmall'])
  await db.messages.filter(message => (
    deprecatedTaskIds.has(String(message.taskId)) ||
    deprecatedTypes.has(message.type) ||
    deprecatedBatches.has(message.batch)
  )).delete()
  await db.taskLogs.filter(log => deprecatedTaskIds.has(String(log.taskId))).delete()
}

async function getTodayMessagesByTaskId(taskId) {
  let now = new Date();
  let startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()) / 1
  let messages = await db.messages.where('timestamp').above(startOfDay).reverse().sortBy('timestamp')
  let todayMessages = messages.filter((message) => {
    return message.taskId == taskId
  })
  saveSetting(`temporary:task-messages:${taskId}:${startOfDay}`, todayMessages)
}

async function addTaskLog(task) {
  const timestamp = Date.now()
  const log = await db.taskLogs.add({
    id: timestamp,
    taskId: task.id,
    timestamp: timestamp,
    mode: task.mode,
    results: []
  });

}

async function findAndUpdateTaskResult(taskId, result) {
  let last5Minute = Date.now() - 60*5*1000;
  const lastRunLog = (await db.taskLogs.where('timestamp').above(last5Minute).reverse().sortBy('timestamp')).find((log) => {
    return log.taskId == taskId
  })

  if (lastRunLog) {
    await db.taskLogs.where('id').equals(lastRunLog.id).modify(log => {
      log.results.push(result);
    });
  }
}

async function getTaskLog(taskId, days = 7) {
  let lastWeek = Date.now() - 60*60*1000*24*days;
  const taskLogs = await db.taskLogs.where('timestamp').above(lastWeek).filter((log) => {
    return log.taskId == taskId
  }).reverse().sortBy('timestamp')
  return taskLogs.map((log) => {
    log.displayTime = readableTime(DateTime.fromMillis(log.timestamp));
    return log
  })
}

async function countTaskLog(taskId, hours = 1) {
  let lastHours = Date.now() - 60*60*1000*hours;
  return await db.taskLogs.where('timestamp').above(lastHours).filter((log) => {
    return log.taskId == taskId
  }).count()
}

async function getTaskUsageAndSave(taskId) {
  const actualUsage = {
    hour: await countTaskLog(taskId, 1) || 0,
    daily: await countTaskLog(taskId, 24) || 0,
    weekly: await countTaskLog(taskId, 24*7) || 0,
  }
  saveSetting(`task-usage:${taskId}`, actualUsage)
}

function getTaskUsageImmediately(taskId) {
  const usage = getSetting(`task-usage:${taskId}`, {
    hour: 0,
    daily: 0,
    weekly: 0
  })
  getTaskUsageAndSave(taskId)
  return usage
}

function getTodayMessagesByTaskIdImmediately(taskId) {
  let now = new Date();
  let startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()) / 1
  const messages = getSetting(`temporary:task-messages:${taskId}:${startOfDay}`, [])
  getTodayMessagesByTaskId(taskId)
  return messages
}

export {
  findGood,
  findOrder,
  updateOrders,
  newMessage,
  updateMessages,
  cleanupDeprecatedTaskData,
  addTaskLog,
  getTaskLog,
  findAndUpdateTaskResult,
  getTaskUsageImmediately,
  getTodayMessagesByTaskIdImmediately
};
