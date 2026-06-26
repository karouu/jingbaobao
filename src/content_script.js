// 京价保
import 'weui';
import weui from './shim/weui.js';

import '../static/style/content.css'

function guardRuntimeMessages() {
  const runtime = chrome.runtime
  if (runtime.sendMessage.__jjbGuarded) return
  const sendMessage = runtime.sendMessage.bind(runtime)
  try {
    runtime.sendMessage = function (...args) {
      if (!runtime.id) return
      for (let index = args.length - 1; index >= 0; index -= 1) {
        if (typeof args[index] !== 'function') continue
        const callback = args[index]
        args[index] = function (...callbackArgs) {
          if (runtime.lastError) return
          callback(...callbackArgs)
        }
        break
      }
      try {
        const result = sendMessage(...args)
        return result && typeof result.catch === 'function' ? result.catch(() => undefined) : result
      } catch (error) {
        if (!/Extension context invalidated/i.test(error.message || String(error))) throw error
      }
    }
    runtime.sendMessage.__jjbGuarded = true
  } catch (error) { }
}

guardRuntimeMessages()

var observeDOM = (function () {
  var MutationObserver = window.MutationObserver || window.WebKitMutationObserver
  return function (obj, callback) {
    // define a new observer
    var obs = new MutationObserver(function (mutations, observer) {
      if (mutations[0].addedNodes.length || mutations[0].removedNodes.length) {
        callback(observer);
      }
    });
    // have the observer observe foo for changes in children
    obs.observe(obj, { childList: true, subtree: true });
  };
})();

function mockClick(element) {
  var dispatchMouseEvent = function (target, var_args) {
    var e = document.createEvent("MouseEvents");
    e.initEvent.apply(e, Array.prototype.slice.call(arguments, 1));
    target.dispatchEvent(e);
  };
  if (element) {
    dispatchMouseEvent(element, 'mouseover', true, true);
    dispatchMouseEvent(element, 'mousedown', true, true);
    dispatchMouseEvent(element, 'click', true, true);
    dispatchMouseEvent(element, 'mouseup', true, true);
  }
}


// 申请价保
function apply(applyBtn, priceInfo, setting) {
  let order_price = applyBtn.attr('order_price')
  let product_name = applyBtn.attr('product_name')
  let applyId = applyBtn.attr('id')
  // 是否暂停价保
  if (!applyId || setting.suspendedApplyIds.indexOf(applyId) > -1) {
    // console.log('价保暂停', applyId)
    return
  }
  // 获取上次申请价保的价格
  getSetting('last_apply_price' + applyId, (lastApply) => {
    let lastApplyPrice = lastApply ? lastApply.price : localStorage.getItem('jjb_order_' + applyId)
    if (priceInfo.price > 0 && priceInfo.price < order_price && (order_price - priceInfo.price) > setting.pro_min) {
      if (lastApplyPrice && Number(lastApplyPrice) - priceInfo.price <= setting.pro_min) {
        // console.log('Pass: ' + product_name + '当前价格上次已经申请过了:', priceInfo.price, ' Vs ', lastApplyPrice)
        return
      }
      // 如果禁止了自动申请
      if (setting.prompt_only) {
        localStorage.setItem('jjb_order_' + applyId, priceInfo.price)
        chrome.runtime.sendMessage({
          action: "setVariable",
          key: 'last_apply_price' + applyId,
          value: {
            price: priceInfo.price,
            submitted: false,
            time: new Date()
          }
        }, function (response) {
        });
        chrome.runtime.sendMessage({
          action: "priceProtectionNotice",
          task: {
            id: "1"
          },
          log: true,
          batch: 'jiabao',
          title: '报告老板，发现价格保护机会！',
          product_name: product_name,
          content: '购买价：' + order_price + ' 现价：' + priceInfo.price + '，请手动提交价保申请。'
        }, function (response) {
        });
      } else {
        // 申请
        simulateClick(applyBtn, true)
        setTimeout(() => {
          let resultId = "applyResult_" + applyId.substr(8)
          if (applyBtn.hasClass("disable-apply") || $("#" + resultId).is(":visible")) {
            localStorage.setItem('jjb_order_' + applyId, priceInfo.price)
            chrome.runtime.sendMessage({
              action: "setVariable",
              key: 'last_apply_price' + applyId,
              value: {
                price: priceInfo.price,
                submitted: true,
                time: new Date()
              }
            }, function (response) {
            });
            chrome.runtime.sendMessage({
              action: "priceProtectionNotice",
              title: '报告老板，发现价格保护机会！',
              product_name: product_name,
              task: {
                id: "1"
              },
              log: true,
              batch: 'jiabao',
              content: '购买价：' + order_price + ' 现价：' + priceInfo.price + '，已经自动提交价保申请，正在等待申请结果。'
            }, function (response) {
            });
          }

          let resultElement = document.getElementById(resultId)
          if (resultElement) {
            let reported = false
            let reportApplyResult = function (observer) {
              let resultText = $("#" + resultId).text()
              if (!reported && resultText && resultText.indexOf("预计") < 0 && resultText.indexOf("繁忙") < 0) {
                reported = true
                if (observer) observer.disconnect()
                chrome.runtime.sendMessage({
                  action: "priceProtectionNotice",
                  title: "报告老板，价保申请有结果了",
                  task: { id: "1" },
                  log: true,
                  batch: 'jiabao',
                  status: resultText.indexOf('成功') > -1 ? 'success' : 'failed',
                  product_name: product_name,
                  content: "价保结果：" + resultText
                })
              }
            }
            observeDOM(resultElement, reportApplyResult)
            reportApplyResult()
          } else {
            chrome.runtime.sendMessage({
              action: 'priceProtectionNotice',
              title: '价保申请状态未确认',
              task: { id: '1' },
              log: true,
              batch: 'jiabao',
              status: 'failed',
              product_name: product_name,
              content: '提交后未找到京东价保结果区域，请前往价保页面确认申请状态'
            })
          }
        }, 1500);
      }
    }
  });
}


// 提取优惠信息
function seekPromInfo(platform) {
  let urlInfo, sku
  let promotions = []
  if (platform == 'pc') {
    urlInfo = /(https|http):\/\/item.jd.com\/([0-9]*).html/g.exec(window.location.href);
    if (!urlInfo) return
    sku = urlInfo[2]

    $(".prom-gift-list .prom-gift-item").each(function (index, giftDom) {
      let number, img, description, link
      number = $(giftDom).find(".gift-number").text()
      if ($(giftDom).find("a")) {
        link = $(giftDom).find("a").attr("href")
        img = $(giftDom).find(".gift-img").attr("src")
        description = $(giftDom).find("a").attr("title")
      }
      promotions.push({
        typeName: "赠品",
        number,
        img,
        description,
        link
      })
    })
    $(".p-promotions .prom-item").each(function (index, promDom) {
      let typeName, code, description, link
      typeName = $(promDom).find(".hl_red_bg").text()
      code = $(promDom).data("code")
      description = $(promDom).find(".hl_red").text()
      if ($(promDom).find("a")) {
        link = $(promDom).find("a").attr("href")
      }
      promotions.push({
        typeName,
        code,
        description,
        link
      })
    })
  } else {
    urlInfo = /(https|http):\/\/(item.m.jd.com|mitem.jd.hk)\/product\/([0-9]*).html/g.exec(window.location.href);
    if (!urlInfo) return
    sku = urlInfo[3]
    $(".mod_discount .detail_prom .prom_item").each(function (index, promDom) {
      let typeName, code, description, link
      typeName = $(promDom).find(".hl_red_bg").text()
      code = $(promDom).find(".de_tag").data("code")
      description = $(promDom).find(".de_span").text()
      if ($(promDom).find("a")) {
        link = $(promDom).find("a").attr("href")
      }
      promotions.push({
        typeName,
        code,
        description,
        link
      })
    })
  }

  // 通知促销
  chrome.runtime.sendMessage({
    action: 'promotions',
    sku,
    promotions
  }, function (response) {
  });
}

// 提取价格信息
function seekPriceInfo(platform) {
  let urlInfo, sku, price, normal_price, presale_price, plus_price, pingou_price, spec_price, orgin_price, skuName, earnest_price
  // 顺便获取促销
  seekPromInfo(platform)
  if (platform == 'pc') {
    urlInfo = /(https|http):\/\/item.jd.com\/([0-9]*).html/g.exec(window.location.href);
    if (!urlInfo) return null
    skuName = $(".sku-name").text() ? $(".sku-name").text().trim() : null
    sku = urlInfo[2]
    // 需要对预售定金进行区分
    if ($('span.p-price').length > 1) {
      $('span.p-price').each(function (index, priceDom) {
        if ($(priceDom).hasClass('J-earnest')) {
          earnest_price = $(priceDom).find('.price').text() ? $(priceDom).find('.price').text().replace(/[^0-9\.-]+/g, "") : null
        } else {
          normal_price = $(priceDom).find('.price').text() ? $(priceDom).find('.price').text().replace(/[^0-9\.-]+/g, "") : null
        }
      })
    } else {
      normal_price = ($('span.p-price .price').text() ? $('span.p-price .price').text().replace(/[^0-9\.-]+/g, "") : null) || ($('#jd-price').text() ? $('#jd-price').text().replace(/[^0-9\.-]+/g, "") : null)
    }

    presale_price = $('.J-presale-price').text() ? $('.J-presale-price').text() : null

    plus_price = $('.p-price-plus .price').text() ? $('.p-price-plus .price').text().replace(/[^0-9\.-]+/g, "") : null
    pingou_price = null
    if ($('#pingou-banner-new') && $('#pingou-banner-new').length > 0 && ($('#pingou-banner-new').css('display') !== 'none')) {
      pingou_price = ($(".btn-pingou span").first().text() ? $(".btn-pingou span").first().text().replace(/[^0-9\.-]+/g, "") : null) || normal_price
      normal_price = $("#InitCartUrl span").text() ? $("#InitCartUrl span").text().replace(/[^0-9\.-]+/g, "") : price
    }
    price = normal_price || presale_price
  } else {
    urlInfo = /(https|http):\/\/item.m.jd.com\/product\/([0-9]*).html/g.exec(window.location.href);
    if (!urlInfo) return null
    sku = urlInfo[2]
    skuName = $("#itemName").text() ? $("#itemName").text().trim() : null

    normal_price = ($('#priceSaleChoice').text() ? $('#priceSaleChoice').text().replace(/[^0-9\.-]+/g, "") : null) || $('#jdPrice').val() || ($('#specJdPrice').text() ? $('#specJdPrice').text().replace(/[^0-9\.-]+/g, "") : null)

    spec_price = ($('#priceSale').text() && $('#priceSale').height() > 0 ? $('#priceSale').text().replace(/[^0-9\.-]+/g, "") : null) || $('#spec_price').text() && $('#spec_price').height() > 0 || ($('#specPrice').text() ? $('#specPrice').text().replace(/[^0-9\.-]+/g, "") : null)

    plus_price = ($('.vip_price #priceSaleChoice1').text() ? $('.vip_price #priceSaleChoice1').text().replace(/[^0-9\.-]+/g, "") : null) || $('#specPlusPrice').text()

    orgin_price = ($("#orginBuyBtn span").text() ? $("#orginBuyBtn span").text().replace(/[^0-9\.-]+/g, "") : null) || ($("#ysOriPrice").text() ? $("#ysOriPrice").text().replace(/[^0-9\.-]+/g, "") : null)

    price = normal_price || spec_price || orgin_price

    pingou_price = $('#tuanDecoration .price_warp .price').text() ? $('#tuanDecoration .price_warp .price').text().replace(/[^0-9\.-]+/g, "") : null
  }

  let priceInfo = {
    name: skuName,
    sku: sku,
    normal_price: price ? Number(price) : null,
    plus_price: plus_price ? Number(plus_price) : null,
    pingou_price: pingou_price ? Number(pingou_price) : null
  }



  // 通知价格
  chrome.runtime.sendMessage({
    action: 'productPrice',
    ...priceInfo
  }, function (response) {
  });

  return priceInfo
}

// 查找订单并对比
function findOrderBySkuAndApply(priceInfo, setting) {

  $(".applyBtn").each(function () {
    let skuId = $(this).attr('sku')
    let applyId = $(this).attr('id')
    if (skuId && skuId == priceInfo.sku) {
      apply($(this), priceInfo, setting)
    }
    if (setting.suspendedApplyIds.indexOf(applyId) > -1) {
      $(this).text("已暂停")
      $(this).addClass("disable-apply")
      $(this).removeAttr("onclick")
      $(this).removeAttr("report-eventid")
      $(this).removeAttr("id")
    }
  });
}

async function dealProduct(product, orderInfo, setting) {

  let pro_logs = []
  let product_name = product.find('.p-name a').text() || product.find('.item-name .name').text()
  let orderPriceDom = product.find('.price-count .price').text() ? product.find('.price-count .price') : product.find('.item-opt .price')
  let order_price = Number(orderPriceDom.text().replace(/[^0-9\.-]+/g, ""))

  let applyBtn = product.find('.item-opt .apply').text() ? product.find('.item-opt .apply') : product.find('.btn a')
  let orderId = applyBtn.attr('id') ? applyBtn.attr('id').split('_') : null

  if (!orderId || orderId.length < 3) {
    // console.log('找不到 orderId')
    return
  }

  let orderCountDom = product.find('.price-count .count').text() ? product.find('.price-count .count') : product.find('.item-name .count')
  let order_quantity = Number(orderCountDom.text().trim().replace(/[^0-9\.-]+/g, ""))

  let order_pro_logs = product.find('.show-detail').text() ? product.find('.show-detail p') : product.next().next().find('.item-jb')

  let product_img = product.find('a img').attr('src') ? product.find('a img').attr('src') : product.find('.img img').attr('src')

  if (order_price < 0.01) {
    // console.log('忽略免费的商品')
    return
  }

  if (order_pro_logs && order_pro_logs.length > 0) {
    order_pro_logs.each(function () {
      let logElement = $(this)
      let log = logElement.text().trim().replace('查看退款详情', '').replace('查看申请记录', '').replace('查看详细规则', '')
      if (log && log.indexOf("成功") > -1 || logElement.hasClass("jb-has-succ")) {
        pro_logs.push({
          status: "success",
          message: log
        })
      } else {
        pro_logs.push({
          status: "failed",
          message: log
        })
      }
    });
  }
  // 请求价格
  chrome.runtime.sendMessage({
    action: "getProductPrice",
    sku: orderId[2],
    setting: setting
  }, function (response) {
  });
  let goodInfo = {
    sku: orderId[2],
    name: product_name,
    img: product_img,
    order_price: order_price,
    logs: pro_logs,
    quantity: order_quantity
  }
  chrome.runtime.sendMessage({
    action: "findGood",
    task: {
      id: "1"
    },
    log: true,
    title: `发现有效的订单：${product_name} 下单价格：${order_price}`,
    orderId: orderInfo.id,
    good: goodInfo
  }, function (response) {
  });

  // 记录订单信息
  applyBtn.addClass('applyBtn')
  applyBtn.attr('sku', orderId[2])
  applyBtn.attr('order_price', order_price)
  applyBtn.attr('product_name', product_name)
}

async function dealOrder(order, validProducts, setting) {


  let order_time_text = order.find('span.time').text() || order.find('.title span').last().text().trim().split('：')[1]
  let order_time;
  if (order_time_text) {
    order_time = new Date(order_time_text)
  } else {
    order_time = new Date() // fallback
  }

  let order_id = order.find('span.order').text() ? order.find('span.order').text().replace(/[^0-9\.-]+/g, "") : (order.find('.title .order-code').text() ? order.find('.title .order-code').text().trim().split('：')[1] : null)

  if (!order_id) {
    console.warn('Cannot find order ID block, skipping');
    return;
  }

  let orderInfo = {
    id: order_id,
    timestamp: order_time.getTime(),
    goods: []
  }
  chrome.runtime.sendMessage({
    action: "findOrder",
    task: {
      id: "1"
    },
    log: true,
    title: `发现有效的订单：${order_id} 商品数:${validProducts.length} 下单时间：${order_time}`,
    orderId: order_id,
    order: orderInfo
  }, function (response) {
  });

  let time = 500
  validProducts.map(function (productElement) {
    setTimeout(async () => {
      try {
        await dealProduct($(productElement), orderInfo, setting)
      } catch (error) {
        console.error('Error dealing with product:', error)
      }
    }, time);
    time += 2000;
  })
}

function normalizeText(text) {
  return (text || '').replace(/\s+/g, ' ').trim()
}

function parseMoney(text) {
  let matches = normalizeText(text).match(/-?\d+(?:,\d{3})*(?:\.\d+)?/g)
  let value = matches && matches.length > 0 ? matches[matches.length - 1].replace(/,/g, '') : ''
  return value ? Number(value) : null
}

function parseOrderTime(text) {
  let normalized = normalizeText(text).match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:\s+\d{1,2}:\d{1,2}(?::\d{1,2})?)?/)
  if (!normalized) return Date.now()
  let parsed = new Date(normalized[0].replace(/-/g, '/'))
  return Number.isNaN(parsed.getTime()) ? Date.now() : parsed.getTime()
}

function extractSkuFromUrl(url) {
  let match = /(item\.jd\.com\/|item\.m\.jd\.com\/product\/|mitem\.jd\.hk\/product\/)(\d+)/.exec(url || '')
  return match ? match[2] : null
}

function normalizeImageUrl(url) {
  if (!url) return null
  return url.replace(/^https?:/, '')
}

function extractOrderCenterGood(goodElement, fallbackPrice) {
  let good = $(goodElement)
  let link = good.find('.p-name a[href], .goods-msg a[href], a[href*="item.jd.com"], a[href*="item.m.jd.com"], a[href*="mitem.jd.hk"]').first()
  let sku = extractSkuFromUrl(link.attr('href'))
  let name = normalizeText(link.text()) || normalizeText(good.find('.p-name, .goods-msg, .name').first().text())
  let image = good.find('.p-img img, img').first().attr('src') || good.find('.p-img img, img').first().attr('data-lazy-img')
  let quantity = parseMoney(good.find('.goods-number, .p-num, .quantity').first().text()) || 1
  let price = parseMoney(good.find('.p-price, .price, .goods-price').first().text()) || fallbackPrice

  if (!sku || !name || !price || price < 0.01) return null

  return {
    sku,
    name,
    img: normalizeImageUrl(image),
    order_price: price,
    logs: [],
    quantity
  }
}

function extractOrderCenterOrder(orderElement) {
  let order = $(orderElement)
  let orderIdText = normalizeText(order.find('.number, .order-num, .order-code').first().text()) || order.attr('id')
  let orderId = orderIdText ? orderIdText.replace(/[^0-9]+/g, '') : null
  if (!orderId) return null

  let timestamp = parseOrderTime(order.find('.dealtime, .time, .order-time').first().text())
  let fallbackPrice = parseMoney(order.find('.amount .ftx-13, .amount, .order-price, .price').last().text())
  let goodNodes = order.find('.goods-item, .goods-list .item, .tr-bd .goods').toArray()
  if (goodNodes.length < 1) {
    goodNodes = order.find('a[href*="item.jd.com"], a[href*="item.m.jd.com"], a[href*="mitem.jd.hk"]').closest('td, .goods, .goods-item, .item').toArray()
  }

  let goods = []
  goodNodes.forEach((goodNode) => {
    let good = extractOrderCenterGood(goodNode, fallbackPrice)
    if (good && !goods.find(item => item.sku == good.sku && item.name == good.name)) {
      goods.push(good)
    }
  })

  if (goods.length < 1) return null

  return {
    id: orderId,
    timestamp,
    goods
  }
}

function syncOrderCenterOrders() {
  if (window.__jjbOrderCenterSyncing) return
  window.__jjbOrderCenterSyncing = true

  setTimeout(() => {
    let orderNodes = $('.order-tb, tbody[id^="tb-"], .order-list .order, .order-item').toArray()
    let orders = []

    orderNodes.forEach((orderNode) => {
      let order = extractOrderCenterOrder(orderNode)
      if (order && !orders.find(item => item.id == order.id)) {
        orders.push(order)
      }
    })

    orders.forEach((order, orderIndex) => {
      setTimeout(() => {
        chrome.runtime.sendMessage({
          action: "findOrder",
          task: { id: "order-center" },
          orderId: order.id,
          order: {
            id: order.id,
            timestamp: order.timestamp,
            goods: []
          }
        }, function () {
          order.goods.forEach((good, goodIndex) => {
            setTimeout(() => {
              chrome.runtime.sendMessage({
                action: "findGood",
                task: { id: "order-center" },
                orderId: order.id,
                good
              }, function () {
              });
            }, goodIndex * 80)
          })
        });
      }, orderIndex * 200)
    })

    if (orders.length > 0) {
      localStorage.setItem('jjb_last_order_center_sync', new Date().getTime());
      weui.toast(`已同步${orders.length}个订单`, 1200);
    }

    setTimeout(() => {
      window.__jjbOrderCenterSyncing = false
    }, 2000)
  }, 500)
}

async function getAllOrders(mode, setting) {

  // 移动价保
  if ($("#dataList0 li").length > 0) {

    let time = 0
    $("#dataList0 li").each(function () {
      let orderElement = $(this)

      const validProducts = orderElement.find('.product-item').toArray().filter((product) => {
        let proResult = $(product).next().next();
        if (proResult.find('#overTime').text() && proResult.find('#overTime').text().length > 0 || (proResult.find('.item-jb').text() && proResult.find('.item-jb').text().indexOf("未开通价保服务") > -1)) {
          // console.log('排除无效商品', $(product).find(".item-name").text())
          return false
        }
        return !$(product).find('.apply').hasClass('disable-apply')
      })

      if (validProducts.length < 1) return



      setTimeout(async () => {
        try {
          await dealOrder(orderElement, validProducts, setting)
        } catch (error) {
          console.error('Error dealing with mode m order:', error)
        }
      }, time);
      time += 3000;
    });
  }
  // PC价保
  if ($("#dataList .tr-th").length > 0) {
    let time = 0

    $("#dataList .tr-th").each(function () {
      let orderDom = $(this).clone()
      let product = $(this).next()
      let products = [product]
      while (product.next().hasClass('co-th')) {
        product = product.next()
        products.push(product)
      }
      // 排除已经超过价保周期的商品
      const validProducts = products.filter((product) => {
        if (product.find('#overTime') && product.find('#overTime').text().length > 0 || (product.find('.show-detail') && product.find('.show-detail').text().indexOf("未开通价保服务") > -1)) {
          // console.log('排除无效商品', product.find(".p-name").text())
          return false
        }
        return true
      })

      if (validProducts.length < 1) return


      setTimeout(async () => {
        try {
          await dealOrder(orderDom, validProducts, setting)
        } catch (error) {
          console.error(error)
        }
      }, time);
      time += 1000;
    });
  }

  localStorage.setItem('jjb_last_check', new Date().getTime());
}



function runStatus(task, parameters) {
  chrome.runtime.sendMessage(Object.assign({
    action: "runStatus",
    task: task,
    timestamp: Date.now(),
    log: true
  }, parameters))
}

// 32：购物车降价
function priceCutNotice(task) {
  if (!task || task.frequency == 'never' || window.top !== window) return
  weui.toast('京价保运行中', 1000)
  runStatus(task)
  let attempts = 0
  let finished = false
  const reportResult = function (status, content) {
    if (finished) return
    finished = true
    chrome.runtime.sendMessage({
      action: 'taskRunResult',
      taskId: task.id,
      payload: { status, content }
    })
  }
  const inspectCart = function () {
    if (finished) return
    attempts += 1
    const pageText = ($('body').text() || '').replace(/\s+/g, '')
    if (/(请登录|账号登录|登录后同步)/.test(pageText)) {
      reportResult('failed', '购物车页面未登录，请登录京东后重新运行任务')
      return
    }
    const items = $('.item-list .item-item, .cart-item, [class*="cart-item-"]')
    const cartReady = items.length > 0 || /(购物车空空如也|购物车还是空的|暂无商品)/.test(pageText)
    if (cartReady) {
      let priceCutCount = 0
      const reportedKeys = new Set()
      items.each(function () {
        const item = $(this)
        const itemText = (item.text() || '').replace(/\s+/g, '')
        if (itemText.indexOf('降价') < 0) return
        const sku = item.attr('skuId') || item.attr('data-sku') || item.attr('data-skuid')
        const productName = item.find('.p-name, [class*="name"]').first().text().trim()
        const productKey = sku || item.attr('id') || productName
        if (!productKey || reportedKeys.has(productKey)) return
        reportedKeys.add(productKey)
        const priceCut = item.find('.pro-tiny-tip, [class*="reduce"], [class*="discount"]').first().text().trim() || '商品价格已降低'
        const productPrice = item.find('.p-price strong, [class*="price"] strong').first().text().trim()
        const productImg = item.find('.p-img img, img').first().attr('src')
        const lastPriceCut = localStorage.getItem('jjb-cart-price-cut:' + productKey)
        if (lastPriceCut == priceCut) return
        localStorage.setItem('jjb-cart-price-cut:' + productKey, priceCut)
        priceCutCount += 1
        chrome.runtime.sendMessage({
          action: 'notice',
          type: 'priceCut',
          task: task,
          log: true,
          title: '发现购物车商品降价',
          content: {
            product: { img: productImg, name: productName, sku: sku },
            priceCut: priceCut,
            newPrice: productPrice
          }
        })
      })
      reportResult('success', priceCutCount > 0 ? `购物车检查完成，发现${priceCutCount}件新的降价商品` : `购物车检查完成，检查了${items.length}件商品，未发现新的降价`)
      return
    }
    if (attempts >= 20) {
      reportResult('failed', '未识别到购物车商品列表，页面可能尚未加载完成或结构已调整')
      return
    }
    window.setTimeout(inspectCart, 750)
  }
  inspectCart()
}


// 生鲜价保模式
function modifyRefundType(mode = "m") {
  getSetting('refund_type', (setting) => {
    if (!setting || setting == "") setting = "1"
    if (mode == "pc") {
      $("select.modifyRefundType").each(function (index) {
        if ($(this).val() == setting) return
        setTimeout(() => {
          $(this).val(setting)
          $(this)[0].dispatchEvent(new Event('change', { bubbles: true }))
        }, 1000 * index);
      });
    }
    if (mode == "m") {
      $("a.type-modify").each(function (index) {
        setTimeout(() => {
          simulateClick($(this))
          setTimeout(() => {
            $(".type-wrapper .list .item").each(function () {
              if ($(this).attr("value") == setting) {
                if ($(this).hasClass("selected")) return
                simulateClick($(this))
                setTimeout(() => {
                  simulateClick($(".type-wrapper .close-modfiy-type"))
                }, 500);
              }
            })
          }, 1000);

        }, 5000 * index);
      });
    }
  })
}

// 1: 价格保护
function priceProtect(task) {
  if (!task || task.frequency == 'never') return

  weui.toast('京价保运行中', 3500)
  let attempts = 0
  let finished = false
  let timer = null
  let maxPageHeight = 4000 * 20
  let reportRunResult = function (status, content) {
    if (finished) return
    finished = true
    if (timer) clearTimeout(timer)
    chrome.runtime.sendMessage({
      action: 'priceProtectionNotice',
      task: task,
      log: true,
      batch: 'jiabao-run',
      status: status,
      silent: status == 'success',
      title: status == 'success' ? '价格保护检查完成' : '价格保护检查未完成',
      content: content
    })
  }
  let inspectPage = function () {
    if (finished) return
    attempts += 1
    let mode = document.getElementById('dataList') ? 'pc' : 'm'
    let mainContainer = document.getElementById('mescroll0') ? $('#mescroll0') : $(window)
    let productCount = $('.bd-product-list li, #dataList0 li, #dataList .tr-th, .co-th').length
    let pageText = ($('body').text() || '').replace(/\s+/g, '')

    mainContainer.scrollTop(maxPageHeight)
    if (productCount > 0) {
      runStatus(task, { mode: mode })
      setTimeout(() => {
        mainContainer.scrollTop(0)
        modifyRefundType(mode)
      }, 6500)
      chrome.runtime.sendMessage({
        text: 'getPriceProtectionSetting'
      }, function (response) {
        setTimeout(function () {
          try {
            getAllOrders(mode, response || {
              pro_min: 0.1,
              prompt_only: false,
              suspendedApplyIds: []
            })
            reportRunResult('success', `已读取价保页面，发现${productCount}组有效商品记录`)
          } catch (error) {
            reportRunResult('failed', `处理价保商品时发生错误：${error.message || error}`)
          }
        }, 10 * 1000)
      })
      return
    }

    if (/(暂无.*(?:订单|商品)|没有.*(?:价保|订单)|暂无可申请|无可申请)/.test(pageText)) {
      runStatus(task, { mode: mode })
      reportRunResult('success', '价保页面读取完成，当前没有可申请价保的商品')
      return
    }
    if (/(系统繁忙|加载失败|访问异常|网络异常)/.test(pageText)) {
      reportRunResult('failed', '京东价保页面加载失败，请稍后重新运行')
      return
    }
    if (attempts >= 20) {
      reportRunResult('failed', '未识别到京东价保商品列表，可能需要重新登录或页面结构已调整')
      return
    }
    timer = setTimeout(inspectPage, 2000)
  }

  inspectPage()
}



// 显示引荐来源
// showUtmSource removed
// 模拟点击
function simulateClick(dom, mouseEvent) {
  let domNode = dom.get(0)
  // console.log('simulateClick', dom, mouseEvent)
  if (mouseEvent && domNode) {
    return mockClick(domNode)
  }
  try {
    domNode.trigger("tap")
    domNode.trigger("click")
  } catch (error) {
    try {
      mockClick(domNode)
    } catch (err) {
      // console.log('fullback to mockClick', err)
    }
  }
}

function createAutoLoginElement() {
  let p = document.createElement('p');
  p.className = 'auto_login';
  p.setAttribute('data-jjb-auto-login', 'true');
  let span = document.createElement('span');
  span.className = 'jjb-login';
  span.textContent = '让京价保记住密码并自动登录';
  p.appendChild(span);
  return p;
}

function getMobileLoginButton() {
  let candidates = $(".page a.btn.J_ping, .page a.btn, .page button, .page [role='button']").filter(function () {
    let text = $(this).text().trim()
    return text.indexOf('登录') > -1
  })
  return candidates.first()
}

function mountAutoLoginElement(container, target) {
  let targetElement = target && target.length ? target : null
  if (!targetElement || container.find('[data-jjb-auto-login="true"]').length > 0) return
  targetElement.after(createAutoLoginElement())
}

// 保存账号
function saveAccount(account) {
  chrome.runtime.sendMessage({
    action: "saveAccount",
    content: account
  }, function (response) {
    // console.log('saveAccount response', response)
  });
}

// 获取账号信息
function getAccount(type) {
  // console.log("getAccount", type)
  chrome.runtime.sendMessage({
    action: "getAccount",
    type: type
  }, function (response) {
    if (response && response.username && response.password) {
      setTimeout(() => {
        autoLogin(response, type)
      }, 500);
    } else {
      chrome.runtime.sendMessage({
        action: "saveLoginState",
        state: "failed",
        message: "由于账号未保存无法自动登录",
        type: type
      }, function (response) {
      });
    }
  });
}
// 获取设置
function getSetting(name, cb) {
  chrome.runtime.sendMessage({
    text: "getSetting",
    content: name
  }, function (response) {
    cb(response)
  });
}

// 登录失败
function dealLoginFailed(type, errorMsg) {
  let loginFailedDetail = {
    text: "loginFailed",
    type: type,
    notice: true,
    content: errorMsg,
    state: "failed"
  }

  // 如果是单纯的登录页面，则不发送浏览器提醒
  if (window.innerWidth == 420 || window.location.href == "https://passport.jd.com/uc/login") {
    loginFailedDetail.notice = false
    // console.log("主动登录页面不发送浏览器消息提醒")
  }
  chrome.runtime.sendMessage(loginFailedDetail, function (response) {
  });
}

function getBase64Image(img) {
  var canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  var ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  var dataURL = canvas.toDataURL("image/png");

  return dataURL.replace(/^data:image\/(png|jpg);base64,/, "");
}

// 自动登录
function autoLogin(account, type) {
  if (account.autoLoginQuota && account.autoLoginQuota < 1) {
    // console.log('当前时段无可用自动登录配额，暂不运行自动登录', type)
    return
  }
  weui.toast('京价保正在自动登录', 1000);
  function login(type) {
    chrome.runtime.sendMessage({
      action: "autoLogin",
      type: type
    }, function (response) {
    });
    setTimeout(() => {
      if (type == 'pc') {
        simulateClick($(".login-btn a"), true)
      } else {
        simulateClick(getMobileLoginButton(), true)
      }
    }, 1200);
  }

  // PC 网页登录
  if (type == 'pc') {
    // 自动补全填入
    $("#loginname").val(account.username)
    $("#nloginpwd").val(account.password)
    // 监控验证结果
    let authcodeDom = document.getElementById("s-authcode")
    if (authcodeDom) {
      observeDOM(authcodeDom, function () {
        let resultText = $("#s-authcode .authcode-btn").text()
        if (resultText && resultText == "验证成功") {
          login('pc')
        }
      });
    }
    // 如果此前已经登录失败
    if (account.loginState && account.loginState.state == 'failed') {
      $(".tips-inner .cont-wrapper p").text('由于在' + account.loginState.displayTime + '自动登录失败（原因：' + account.loginState.message + '），京价保暂停自动登录').css('color', '#f73535').css('font-size', '14px')
      $(".login-wrap .tips-wrapper").hide()
      $("#content .tips-wrapper").css('background', '#fff97a')
    } else {
      // 如果显示需要验证
      if ($("#s-authcode").height() > 0) {
        dealLoginFailed("pc", "需要完成登录验证")
      } else {
        setTimeout(function () {
          login('pc')
        }, 1500)
        // 是否需要滑动验证
        setTimeout(function () {
          let slideMsg = $(".JDJRV-suspend-slide .JDJRV-lable-refresh").text()
          if (slideMsg && slideMsg.length > 0) {
            dealLoginFailed("pc", "需要完成登录验证")
          }
        }, 3000)
        // 监控登录失败
        setTimeout(function () {
          let errorMsg = $('.login-box .msg-error').text()
          if (errorMsg && errorMsg.length > 0) {
            dealLoginFailed("pc", errorMsg)
          }
        }, 4000)
      }
    }
    // 手机登录
  } else {
    $("#username").val(account.username)
    $("#pwd").val(account.password)
    $("#username")[0].dispatchEvent(new Event('input', { bubbles: true }))
    $("#pwd")[0].dispatchEvent(new Event('input', { bubbles: true }))
    getMobileLoginButton().addClass("btn-active")
    // 自动登录
    function mLogin() {
      setTimeout(function () {
        if ($("#username").val() && $("#pwd").val()) {
          login('m')
          // 是否需要滑动验证
          observeDOM(document.body, function (observer) {
            let captchaMsg = $("#captcha_dom .captcha_header").text()
            if (captchaMsg && captchaMsg.length > 0) {
              if (observer) observer.disconnect();
              dealLoginFailed("m", "需要完成登录验证")
            }
          })
          // 监控失败提示
          setTimeout(function () {
            let errorMsg = $(".notice").text() ? $(".notice").text().trim() : null
            if (errorMsg && errorMsg.length > 0) {
              dealLoginFailed("m", errorMsg)
            }
          }, 2000)
        } else {
          // console.log("missing username or password", $("#username").val(), $("#password").val())
        }
      }, 500)
    }
    // 如果需要验证码
    // 如果需要验证码，直接调用登录（用户手动输入验证码后点击的）或者提示用户
    // Since we removed captcha solving, we assume user handles it or we try login.
    // If code box is visible, user needs to input it.
    if ($("#input-code").height() > 0) {
      // Cannot fill captcha automatically
      console.log("Captcha required, please fill manually.");
    } else {
      mLogin()
    }
  }
}


// 登录页
function dealLoginPage() {
  // 手机版登录页
  if ($(".quick-btn").length > 0 && $("#username").length > 0) {
    // 切换登录模式
    simulateClick($(".planBLogin"), true)

    getAccount('m')
    mountAutoLoginElement($('.page'), $(".page .notice").last())
    // 点击让京价保自动登录
    $('.page').off('click.jjbLogin').on('click.jjbLogin', '.jjb-login', function (e) {
      window.event ? window.event.returnValue = false : e.preventDefault();
      let username = $("#username").val()
      let password = $("#pwd").val()
      // 保存账号和密码
      if (username && password) {
        saveAccount({
          username: username,
          password: password
        })
      }
      simulateClick(getMobileLoginButton(), true)
    })
    return
  };
  // PC版登录页
  if ($(".login-tab-r").length > 0 && $("#loginname").length > 0) {
    // 切换到账号登录
    simulateClick($(".login-tab-r a"), true)
    // 获取账号
    getAccount('pc')
    mountAutoLoginElement($('.login-box'), $("#formlogin"))
    $('.login-box').off('click.jjbLogin').on('click.jjbLogin', '.jjb-login', function (e) {
      window.event ? window.event.returnValue = false : e.preventDefault();
      var username = $("#loginname").val()
      var password = $("#nloginpwd").val()
      // 保存账号和密码
      if (username && password) {
        saveAccount({
          username: username,
          password: password
        })
      }
      simulateClick($(".login-btn a"), true)
    })
  };
}



function beanCheckin(task) {
  if (!task || task.frequency == 'never' || window.top !== window) return
  runStatus(task)
  let finished = false
  let attempts = 0
  let clicked = false
  let lastPageMarker = ''
  let initialBeanBalance = null
  const normalizeText = function (text) {
    return (text || '').replace(/\s+/g, '')
  }
  const parseBeanNumber = function (value) {
    if (typeof value == 'number' && value >= 0) return value
    const match = String(value || '').replace(/,/g, '').match(/[0-9]+/)
    return match ? Number(match[0]) : null
  }
  const getSpecificDomBeanBalance = function () {
    const selectors = [
      '.my-card-bean-num',
      '.my-card-bean-num-container .num',
      '.my-card-bean-num-container [class*="num"]',
      '[class*="my-card-bean-num"]'
    ]
    for (let index = 0; index < selectors.length; index += 1) {
      const elements = $(selectors[index]).filter(':visible').toArray()
      for (let elementIndex = 0; elementIndex < elements.length; elementIndex += 1) {
        const balance = parseBeanNumber($(elements[elementIndex]).text())
        if (balance !== null) return balance
      }
    }
    return null
  }
  const getStoredBeanBalance = function () {
    const stores = [sessionStorage, localStorage]
    for (let index = 0; index < stores.length; index += 1) {
      const store = stores[index]
      if (!store) continue
      const keys = ['overview', 'beanOverview', 'myBeanOverview']
      for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
        try {
          const raw = store.getItem(keys[keyIndex])
          if (!raw) continue
          const data = JSON.parse(raw)
          const balance = parseBeanNumber(data.balanceStr || data.balance || data.beanBalance || data.jdBean)
          if (balance !== null) return balance
        } catch (error) { }
      }
    }
    return null
  }
  const getDomBeanBalance = function () {
    const specificBalance = getSpecificDomBeanBalance()
    if (specificBalance !== null) return specificBalance
    const selectors = [
      '[class*="balance"]',
      '[class*="Balance"]',
      '[class*="bean"]',
      '[class*="Bean"]',
      '[class*="amount"]',
      '[class*="Amount"]',
      '[class*="num"]',
      '[class*="Num"]',
      '[class*="count"]',
      '[class*="Count"]'
    ].join(',')
    const patterns = [
      /(?:京豆余额|当前京豆|可用京豆|京豆总数|京豆数量|我的京豆|余额)(?:为|:|：)?([0-9,]+)/,
      /(?:余额|当前|可用)(?:[^0-9]{0,12})([0-9,]+)(?:个)?京豆/,
      /([0-9,]+)(?:个)?京豆(?:余额|可用)?/
    ]
    const candidates = $(selectors).filter(':visible').toArray()
    for (let index = 0; index < candidates.length; index += 1) {
      const marker = normalizeText([
        $(candidates[index]).text(),
        $(candidates[index]).attr('class'),
        $(candidates[index]).attr('id')
      ].filter(Boolean).join(' '))
      if (!marker || marker.length > 160 || !/(京豆|余额|当前|可用|bean)/i.test(marker)) continue
      for (let patternIndex = 0; patternIndex < patterns.length; patternIndex += 1) {
        const match = marker.match(patterns[patternIndex])
        const balance = match ? parseBeanNumber(match[1]) : null
        if (balance !== null) return balance
      }
    }
    return null
  }
  const getBeanBalance = function () {
    const domBalance = getDomBeanBalance()
    if (domBalance !== null) return domBalance
    return getStoredBeanBalance()
  }
  const getElementMarker = function (element) {
    const node = element && element.get ? element.get(0) : null
    if (!node) return ''
    return normalizeText([
      element.text(),
      element.attr('aria-label'),
      element.attr('title'),
      element.attr('class'),
      element.attr('id'),
      element.attr('href'),
      element.attr('onclick'),
      element.attr('clstag'),
      element.attr('data-click'),
      element.attr('data-event')
    ].filter(Boolean).join(' '))
  }
  const isDisabledCheckinElement = function (element, marker) {
    return element.is(':disabled, [disabled], .disabled, .disable, .disable-apply') ||
      /(已签到|已领取|明天再来|签到记录|签到日历|签到明细|规则|攻略|任务|去完成)/.test(marker)
  }
  const isCheckinEntryMarker = function (marker) {
    if (!marker) return false
    if (/(签到领?京豆|领京豆|领取京豆|立即签到|马上签到|去签到|点此签到|每日签到|做签到|打卡领|签到有礼)/.test(marker)) return true
    return /(sign|signin|checkin|qiandao|qd|bean)/i.test(marker) && /(京豆|签到|领|receive|award|bean)/i.test(marker)
  }
  const getSignRoot = function () {
    return $('#mybean-sign, #bean-sign-component, .mybean-card').filter(':visible').first()
  }
  const isBeanAlreadySigned = function () {
    const signRoot = getSignRoot()
    if (!signRoot.length) return false
    const currentNode = signRoot.find('.node.current').filter(':visible').first()
    if (currentNode.length) {
      const currentClass = String(currentNode.attr('class') || '')
      if (/(no-sign|nosign|un-sign|unsigned|continuity-no-sign)/i.test(currentClass)) return false
      if (/(sign-in|signed|finish|complete|done|success)/i.test(currentClass)) return true
    }
    return /(今日已签到|已签到|已领取|明天再来)/.test(normalizeText(signRoot.text()))
  }
  const findSdkCheckinButton = function () {
    const sdkRoot = getSignRoot()
    if (!sdkRoot.length) return $()
    const rootText = normalizeText(sdkRoot.text())
    if (!/(签到领?京豆|今天|明天|后天|连签|京豆)/.test(rootText)) return $()
    return sdkRoot.find('#bean-sign-component .btn, .btn').filter(function () {
      const element = $(this)
      if (!element.is(':visible')) return false
      if (element.is(':disabled, [disabled], .disabled, .disable')) return false
      return element.closest('#mybean-sign, #bean-sign-component, .mybean-card').length > 0
    }).first()
  }
  const clickCheckinButton = function (button) {
    const node = button && button.get ? button.get(0) : null
    if (!node) return
    try {
      node.scrollIntoView({ block: 'center', inline: 'center' })
    } catch (error) { }
    simulateClick(button, true)
    try {
      node.click()
    } catch (error) { }
  }
  const reportResult = function (status, content, value, balance, beforeBalance) {
    if (finished) return
    finished = true
    chrome.runtime.sendMessage({
      action: 'beanCheckinPageResult',
      taskId: task.id,
      payload: { status, content, value, balance, beforeBalance }
    })
  }
  const reportSuccess = function (content, value, waitForValue) {
    const expectedBalance = initialBeanBalance !== null && value ? initialBeanBalance + value : null
    let balanceAttempts = 0
    const waitForBalance = function () {
      if (finished) return
      balanceAttempts += 1
      const balance = getBeanBalance()
      const inferredValue = !value && initialBeanBalance !== null && balance !== null && balance > initialBeanBalance
        ? balance - initialBeanBalance
        : value
      const canReport = expectedBalance
        ? (balance !== null && balance >= expectedBalance)
        : (inferredValue || (!waitForValue && isBeanAlreadySigned()) || balanceAttempts >= 6)
      if (canReport) {
        reportResult('success', content, inferredValue, balance, initialBeanBalance)
        return
      }
      window.setTimeout(waitForBalance, 1000)
    }
    waitForBalance()
  }
  const findCheckinButton = function () {
    const sdkButton = findSdkCheckinButton()
    if (sdkButton.length) return sdkButton
    const candidates = $('a, button, [role="button"], [tabindex], [class*="sign"], [class*="Sign"], [class*="check"], [class*="Check"], [class*="qiandao"], [class*="bean"], div, span').filter(function () {
      const element = $(this)
      if (!element.is(':visible')) return false
      const marker = getElementMarker(element)
      if (marker.length > 600) return false
      return isCheckinEntryMarker(marker) && !isDisabledCheckinElement(element, marker)
    })
    const sorted = candidates.toArray().sort(function (left, right) {
      const leftMarker = getElementMarker($(left))
      const rightMarker = getElementMarker($(right))
      const score = function (marker, node) {
        let value = 0
        if (/(签到领?京豆|领取京豆|领京豆)/.test(marker)) value += 5
        if (/(立即签到|马上签到|去签到|点此签到|每日签到)/.test(marker)) value += 4
        if (/(button|btn|sign|checkin|qiandao|qd)/i.test(marker)) value += 2
        if (/^(A|BUTTON)$/i.test(node.tagName)) value += 2
        if (marker.length < 120) value += 1
        return value
      }
      return score(rightMarker, right) - score(leftMarker, left)
    })
    return $(sorted).first()
  }
  const inspectPage = function () {
    if (finished) return
    attempts += 1
    const pageText = normalizeText($('body').text())
    if (initialBeanBalance === null) initialBeanBalance = getBeanBalance()
    if (/我的京豆/.test(pageText)) lastPageMarker = '我的京豆页面已加载'
    if (/(签到|京豆)/.test(pageText)) lastPageMarker = '页面包含签到/京豆模块'
    const rewardMatch = pageText.match(/签到成功[^+]{0,100}\+([0-9]+)/)
    if (/(签到成功|领取成功)/.test(pageText)) {
      const value = rewardMatch ? Number(rewardMatch[1]) : null
      reportSuccess(null, value, clicked)
      return
    }
    if (isBeanAlreadySigned()) {
      const balance = getBeanBalance()
      if (clicked) {
        reportSuccess('今日京豆签到已完成', null, true)
      } else {
        reportResult('success', '今日京豆签到已完成', null, balance)
      }
      return
    }
    if (/(请先登录|登录后查看|账号登录)/.test(pageText)) {
      reportResult('failed', '我的京豆页面未登录，请登录京东后重新运行任务')
      return
    }
    const button = findCheckinButton()
    if (button.length && !clicked) {
      clicked = true
      lastPageMarker = button.closest('#mybean-sign, #bean-sign-component, .mybean-card').length > 0
        ? '已找到京豆签到SDK图片按钮'
        : `已找到签到入口：${getElementMarker(button).slice(0, 80)}`
      clickCheckinButton(button)
    }
    if (attempts >= 75) {
      reportResult(
        'failed',
        clicked ? `已点击京豆签到入口，但页面未返回签到结果，请稍后重试。${lastPageMarker}` : `我的京豆页面未找到可点击签到入口，请确认页面已登录。${lastPageMarker || '页面未出现京豆签到模块'}`
      )
      return
    }
    window.setTimeout(inspectPage, 1000)
  }
  inspectPage()
}



// ************
// 主体任务
// ************

var pageTaskRunning = false

function triggerTask(task) {
  switch (task.id) {
    // 1: 价格保护
    case '1':
      priceProtect(task)
      break;
    case '11':
      beanCheckin(task)
      break;
    // 32: 购物车降价
    case '32':
      priceCutNotice(task)
      break;
    default:
      break;
  }
}


function accountAlive(type, message) {
  chrome.runtime.sendMessage({
    action: "saveLoginState",
    state: "alive",
    message: message,
    type: type
  }, function (response) {
    // console.log("accountAlive ", type, message, response);
  });
}

function resaveAccount() {
  // Placeholder to prevent ReferenceError
}

function CheckDom() {
  pageTaskRunning = true
  // 转存账号
  resaveAccount()

  // 登录状态检查
  checkLoginState()

  // getPageSetting
  chrome.runtime.sendMessage({
    action: "getPageSetting",
    location: {
      host: window.location.host,
      href: window.location.href,
      hash: window.location.hash,
      origin: window.location.origin,
      pathname: window.location.pathname
    }
  }, function (response) {
    if (response && response.tasks) {
      let time = 1500
      response.tasks.forEach(task => {
        setTimeout(() => {
          triggerTask(task)
        }, time)
        time += 15000;
      });
    }
    // console.log('getPageSetting', response)
  });

  // 是否是PLUS会员
  if ($(".cw-user .fm-icon").length > 0 && $(".cw-user .fm-icon").text() == '正式会员') {
    chrome.runtime.sendMessage({
      action: "setVariable",
      key: "jjb_plus",
      value: "Y"
    }, function (response) {
    });
  }

  // 账号登录页
  setTimeout(() => {
    dealLoginPage()
  }, 500);

  // 移除遮罩
  if ($("#pcprompt-viewpc").length > 0) {
    simulateClick($("#pcprompt-viewpc"))
  }

  // 京东订单中心
  if (window.location.host == 'order.jd.com' && window.location.pathname == '/center/list.action') {
    setTimeout(syncOrderCenterOrders, 1500);
    setTimeout(syncOrderCenterOrders, 5000);
    setTimeout(syncOrderCenterOrders, 10000);
  }

  // 商品页
  if (window.location.host == 'item.jd.com') {
    setTimeout(() => {
      seekPriceInfo('pc');
    }, 1500);
  }

  // 移动商品页
  if (window.location.host == 'item.m.jd.com') {
    setTimeout(() => {
      seekPriceInfo("m");
    }, 500);
  }

  // 手机验证码
  if ($('.tip-box').length > 0 && $(".tip-box").text().indexOf("账户存在风险") > -1) {
    dealLoginFailed("pc", "需要手机验证码")
  }

  // 验证码
  if ($('.page-notice .txt-end').length > 0 && $('.page-notice .txt-end').text().indexOf("账户存在风险") > -1) {
    dealLoginFailed("m", "需要手机验证码")
  }

  // go to user page
  if (window.location != window.parent.location) {
    setTimeout(() => {
      if ($("#mCommonCart").length > 0) {
        simulateClick($("#mCommonCart"), true)
      }
      if ($("#m_common_header_shortcut_h_home").length > 0) {
        simulateClick($("#m_common_header_shortcut_h_home"), true)
      }
      if ($("#ttbar-myjd a").length > 0) {
        $("#ttbar-myjd a").attr('target', '_self')
        simulateClick($("#ttbar-myjd a"), true)
      }
    }, 2 * 60 * 1000);
  }
}

// 检查登录状态
function checkLoginState() {
  if (document.getElementById("ttbar-login") && document.getElementsByClassName("nickname")[0] && document.getElementsByClassName("nickname")[0].innerText) {
    accountAlive('pc', 'PC网页检测到用户名')
  }
  if ($("#J_user .user_show .user_logout").length > 0) {
    accountAlive('pc', 'PC网页检测到用户名')
  };
  // M 是否登录
  if (($("#mCommonMy").length > 0 && $("#mCommonMy").attr("report-eventid") == "MCommonBottom_My") || ($("#userName") && $("#userName").length > 0) || ($("#myHeader .my_header_name") && $("#myHeader .my_header_name").length > 0) || ($(".user_info .name").text() && $(".user_info .name").text().length > 0)) {
    accountAlive('m', '移动网页检测到登录')
  };
  if (location.href == "https://home.m.jd.com/myJd/newhome.action") {
    accountAlive('m', '移动网页打开个人中心')
  }
}

// 不在收银台域名下运行任何任务
if (window.location.host != 'pcashier.jd.com') {
  function onReady() {
    // console.log('京价保注入页面成功');
    checkLoginState()
    if (!pageTaskRunning) {
      setTimeout(function () {
        // console.log('京价保开始执行任务');
        CheckDom()
      }, 1200)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
}

// 消息
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  switch (message.action) {
    case 'productPrice':
      findOrderBySkuAndApply(message, message.setting)
      sendResponse({
        gotcha: message
      })
      break;
    default:
      break;
  }
});

var passiveSupported = false;
try {
  var options = Object.defineProperty({}, "passive", {
    get: function () {
      passiveSupported = true;
    }
  });

  window.addEventListener("test", null, options);
} catch (err) { }

window.addEventListener("message", function (event) {
  if (event.data && event.data.action == 'productPrice') {
    findOrderBySkuAndApply(event.data, event.data.setting)
  }
},
  passiveSupported ? { passive: true } : false
);


var nodeList = document.querySelectorAll('script');
for (var i = 0; i < nodeList.length; ++i) {
  var node = nodeList[i];
  node.src = node.src.replace("http://", "https://")
}
