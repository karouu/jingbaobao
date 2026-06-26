<template>
  <div>
    <div class="main-app">
      <settings
        :login-state="loginState"
        @show-login="showLoginState = true"
      ></settings>
      <div class="contents">
        <div class="weui-navbar">
            <div
              :class="
                `weui-navbar__item ${
                  contentType == 'orders' ? 'weui-bar__item_on' : ''
                }`
              "
              @click="switchContentType('orders')"
            >
            <div class="nav-item">
              最近订单
              <a
                href="https://order.jd.com/center/list.action"
                target="_blank"
                data-tippy-placement="top-start"
                class="tippy"
                data-tippy-content="打开京东订单列表"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  style="margin-bottom: -1px"
                >
                  <path
                    fill="#fff"
                    stroke="#888"
                    d="M1.5 4.518h5.982V10.5H1.5z"
                  ></path>
                  <path
                    d="M5.765 1H11v5.39L9.427 7.937l-1.31-1.31L5.393 9.35l-2.69-2.688 2.81-2.808L4.2 2.544z"
                    fill="#888"
                  ></path>
                  <path
                    d="M9.995 2.004l.022 4.885L8.2 5.07 5.32 7.95 4.09 6.723l2.882-2.88-1.85-1.852z"
                    fill="#fff"
                  ></path>
                </svg>
              </a>
            </div>
            </div>
            <div
              :class="
                `weui-navbar__item ${
                  contentType == 'messages' ? 'weui-bar__item_on' : ''
                }`
              "
              @click="switchContentType('messages')"
            >
            <div class="nav-item">
              最近通知
              <span class="weui-badge" v-if="unreadCount > 0">{{
                unreadCount
              }}</span>
            </div>
            </div>
          </div>
        <div class="weui-tab">
          <div class="weui-tab__panel">
            <div
              id="orders"
              v-show="contentType == 'orders'"
              class="weui-cells contents-box orders"
            >
              <ul v-if="orders && orders.length > 0">
                <li
                  v-for="order in orders"
                  :key="order.id"
                  v-show="
                    (order.promotionInfo &&
                      hiddenPromotionIds.indexOf(order.id) < 0) ||
                      (order.goods && order.goods.length > 0)
                  "
                >
                  <div class="order_time">
                    <span v-show="order.displayTime"
                      >下单时间： {{ order.displayTime }}</span
                    >
                    <span v-show="order.promotionInfo">{{
                      order.promotionInfo
                    }}</span>
                    <span
                      v-if="order.promotionInfo"
                      v-tippy
                      title="不感兴趣"
                      class="dismiss"
                      @click="dismiss(order)"
                      >&times;</span
                    >
                    <span
                      v-else
                      v-show="order.id"
                      v-tippy
                      :title="
                        hiddenOrderIds.indexOf(order.id) > -1
                          ? '显示订单'
                          : '隐藏订单'
                      "
                      :class="
                        hiddenOrderIds.indexOf(order.id) > -1
                          ? 'show-order'
                          : 'hide-order'
                      "
                      @click="toggleOrder(order)"
                    ></span>
                  </div>
                  <div class="weui-cell promotion" v-if="order.promotionInfo">
                    <div class="weui-cell__bd">
                      <div class="good_title">
                        <a
                        :href="`${order.link}`"
                        target="_blank">
                        <img
                          v-if="order.img"
                          :src="`https:${order.img}`"
                          @error.once="backup_picture($event)"
                          class="promotion_title backup_picture"
                          :alt="order.title"
                        />
                        </a>
                        <a :href="`${order.link}`" target="_blank">{{
                          order.title
                        }}</a>
                        <p class="description">{{ order.description }}</p>
                      </div>
                    </div>
                    <div class="weui-cell__ft">
                      <span class="promotion_price">{{ order.priceInfo }}</span>
                      <a
                        :href="`${order.link}`"
                        target="_blank"
                        class="buy-btn weui-btn weui-btn_mini weui-btn_primary"
                        >{{ order.buttonText }}</a
                      >
                    </div>
                  </div>
                  <div
                    v-for="(good, index) in order.goods"
                    :key="index"
                    :class="`order-good ${good.suspended}`"
                    v-show="hiddenOrderIds.indexOf(order.id) > -1 ? false : true"
                  >
                    <div
                      class="weui-cell good"
                      v-if="good && good.order_price > 0"
                    >
                      <div class="weui-cell__bd">
                        <div class="good_title">
                          <div class="good_img">
                            <img
                              v-if="good.img"
                              :src="`https:${good.img}`"
                              @error.once="backup_picture($event)"
                              class="backup_picture"
                              :alt="good.name"
                            />
                            <div class="monitoring">
                              <span
                                v-if="good.suspended"
                                @click="toggleSuspend(order, good, index)"
                                class="resume"
                                v-tippy
                                title="恢复价保"
                              ></span>
                              <span
                                v-else
                                class="suspend"
                                @click="toggleSuspend(order, good, index)"
                                v-tippy
                                title="停止价保"
                              ></span>
                            </div>
                          </div>
                          <p v-if="good.sku">
                            <a
                              :href="`https://item.jd.com/${good.sku}.html`"
                              target="_blank"
                              >{{ good.name }}</a
                            >
                            <span class="count" v-if="good.quantity"
                              >&times; {{ good.quantity }}</span
                            >
                          </p>
                        </div>
                      </div>
                      <div class="weui-cell__ft">
                        <span class="order_price">￥{{ good.order_price }}</span>
                        <div class="sku_price" v-if="skuPriceList[good.sku]">
                          <span
                            class="new_price down"
                            v-if="good.order_price > skuPriceList[good.sku].price"
                            >￥{{ skuPriceList[good.sku].price }}</span
                          >
                          <span
                            class="new_price up"
                            v-else-if="
                              good.order_price < skuPriceList[good.sku].price
                            "
                            >￥{{ skuPriceList[good.sku].price }}</span
                          >
                          <span class="new_price" v-else
                            >￥{{ skuPriceList[good.sku].price }}</span
                          >
                        </div>
                      </div>
                    </div>
                    <p
                      :class="`log ${log.status}`"
                      v-for="(log, index) in good.logs"
                      :key="index"
                    >
                      {{ log.message }}
                    </p>
                  </div>
                </li>
                <p class="text-tips">
                  <a
                    href="https://blog.jjb.im/price-protection-policy.html"
                    target="_block"
                    v-tippy
                    title="点击了解京东价格保护政策"
                    >只显示在价保有效期内且下单金额大于0的订单</a
                  >
                </p>
              </ul>
              <div class="no_order" v-else>
                <div v-if="loadingOrder">
                  <h4>正在加载最近订单</h4>
                </div>
                <div v-else>
                  <h4>暂时还没有监控到订单</h4>
                  <p class="tips">只显示尚在价保有效期的订单</p>
                </div>
              </div>
            </div>
            <div
              id="messages"
              v-show="contentType == 'messages'"
              class="weui-cells contents-box messages"
            >
              <div class="messages-top">
                <div class="messages-header message-type">
                  <div role="radiogroup" class="el-radio-group">
                    <label
                      role="radio"
                      tabindex="-1"
                      :class="`el-radio-button el-radio-button--mini ${selectedTab == 'checkin_notice' ? 'is-active' : ''}`"
                    >
                      <input
                        type="radio"
                        v-model="selectedTab"
                        tabindex="-1"
                        class="el-radio-button__orig-radio"
                        value="checkin_notice"
                      />
                      <span class="el-radio-button__inner">签到记录</span>
                    </label>
                    <label
                      role="radio"
                      aria-disabled="true"
                      tabindex="-1"
                      :class="`el-radio-button el-radio-button--mini ${selectedTab == 'priceProtectionNotice' ? 'is-active' : ''}`"
                    >
                      <input
                        type="radio"
                        v-model="selectedTab"
                        tabindex="-1"
                        class="el-radio-button__orig-radio"
                        value="priceProtectionNotice"
                      />
                      <span class="el-radio-button__inner">价保记录</span>
                    </label>
                  </div>
                </div>
              </div>
              <div class="message-items" v-if="filteredMessages && filteredMessages.length > 0">
                <li v-for="(message, index) in filteredMessages" :key="index">
                  <div
                    :class="`weui-panel__bd message-item type-${message.type} status-${message.status || 'success'}`"
                  >
                    <div class="weui-media-box weui-media-box_text">
                      <h4 class="weui-media-box__title message">
                        <i
                          :class="
                            `${message.type} ${message.batch} ${message.unit}`
                          "
                        ></i>
                        {{ message.title }}
                      </h4>
                      <div class="product-box" v-if="message.content.priceCut">
                        <div class="good_title">
                          <div class="good_img">
                            <img
                              v-if="message.content.product"
                              :src="`https:${message.content.product.img}`"
                              @error.once="backup_picture($event)"
                              class="backup_picture"
                              :alt="message.content.product.name"
                            />
                          </div>
                          <p v-if="message.content.product">
                            <a
                              :href="`https://item.jd.com/${message.content.product.sku}.html`"
                              target="_blank"
                              >{{ message.content.product.name }}</a>
                          </p>
                        </div>
                        <p>
                          <span class="price-cut">{{
                            message.content.priceCut
                          }}</span>
                          <span class="new-price"><a href="https://cart.jd.com/" target="_black">当前价格：{{ message.content.newPrice }}</a></span>
                        </p>
                      </div>
                      <p v-else class="weui-media-box__desc">
                        {{ message.content }}
                      </p>
                      <ul class="weui-media-box__info">
                        <li class="weui-media-box__info__meta">
                          时间: {{ message.time }}
                        </li>
                      </ul>
                    </div>
                  </div>
                </li>
              </div>
              <div class="no_message empty-state" v-else>
                <strong>{{ emptyMessageText }}</strong>
                <span>{{ emptyMessageHint }}</span>
              </div>
            </div>

          </div>
        </div>
        <div class="bottom">
            <a
              id="pricePro"
              class="weui-tabbar__item"
              v-tippy
              title="打开京东价格保护页面"
            >
              <img
                src="../../static/image/money.png"
                alt=""
                class="weui-tabbar__icon"
              />
              <p class="weui-tabbar__label">价保页面</p>
            </a>
            <a
              class="showChangelog weui-tabbar__item"
              @click="showChangelog"
              v-tippy
              :title="`当前版本：${currentVersion}，查看京价保最近更新记录`"
              style="position: relative;"
            >
              <img
                src="../../static/image/update.png"
                alt=""
                class="weui-tabbar__icon"
              />
              <p class="weui-tabbar__label">
                最近更新
                <span
                  class="weui-badge weui-badge_dot"
                  style="position: absolute;top: 0;right: 4em;"
                  v-if="newChangelog"
                ></span>
                <span
                  class="weui-badge"
                  style="position: absolute;top: -.4em;right: 2em;"
                  v-if="newVersion"
                  >有新版</span
                >
              </p>
            </a>
            <a
              id="openGithub"
              class="weui-tabbar__item"
              href="https://github.com/sunoj/jjb"
              v-tippy
              title="点击查看本插件的全部代码"
              target="_blank"
            >
              <img
                src="../../static/image/github.png"
                alt=""
                class="weui-tabbar__icon"
              />
              <p class="weui-tabbar__label">源代码</p>
            </a>
        </div>
      </div>
    </div>

    <div class="dialogs">
      <guide v-if="showGuide" :login-state="loginState"></guide>
      <login-notice
        v-if="showLoginState"
        :state="loginState"
        @close="showLoginState = false"
      ></login-notice>
      <popup v-if="showPopup" @close="showPopup = false"></popup>
      <we-dialog
        v-if="dialog && showDialog"
        @close="showDialog = false"
        :title="dialog.title"
        :content="dialog.content"
        :className="dialog.className"
        :buttons="dialog.buttons"
      ></we-dialog>

    </div>
  </div>
</template>

<script>
import * as _ from "lodash";
import tippy from "tippy.js";

import "weui";
import "../../static/style/popup.css";

import { DateTime } from "luxon";
import { getLoginState } from "../account";
import {
  getSetting,
  versionCompare,
  readableTime,
  saveSetting,
} from "../utils";
import { stateText } from "../variables";

function tippyElement(el) {
  setTimeout(() => {
    let title = el.getAttribute("title");
    if (title) {
      if (el._tippy) {
        el._tippy.setContent(title);
      } else {
        tippy(el, {
          content: title,
        });
      }
    }
  }, 50);
}

import loginNotice from "./login-notice.vue";
import settings from "./settings.vue";
import guide from "./guide.vue";
import popup from "./popup.vue";
import weDialog from "./we-dialog.vue";

function uniqueGoods(goods) {
  if (!goods || goods.length < 1) return [];

  return goods.reduce(
    function(result, good) {
      if (!good) return result;

      let key = [
        good.sku || "",
        good.name || "",
        Number(good.order_price || 0),
        Number(good.quantity || 1),
      ].join("|");

      if (result.keys.indexOf(key) < 0) {
        result.keys.push(key);
        result.goods.push(good);
      }

      return result;
    },
    { keys: [], goods: [] }
  ).goods;
}

export default {
  name: "App",
  directives: {
    tippy: {
      mounted: tippyElement,
      updated: tippyElement,
    }
  },
  components: { loginNotice, settings, guide, popup, weDialog },
  data() {
    return {
      messages: [],
      orders: [],
      skuPriceList: {},
      dialog: {},
      stateText: stateText,
      loadingOrder: false,
      showPopup: true,
      showDialog: false,
      showLoginState: false,
      currentVersion: process.env.VERSION,
      newChangelog:
        versionCompare(
          getSetting("changelog_version", "2.0"),
          process.env.VERSION
        ) < 0,
      hiddenOrderIds: getSetting("hiddenOrderIds", []),
      hiddenPromotionIds: getSetting("hiddenPromotionIds", []),
      selectedTab: "checkin_notice",
      contentType: "orders",
      newVersion: getSetting("newVersion", null),
      unreadCount: getSetting("unreadCount", null),
      olduser: getSetting("jjb_admission-test", false),
      showGuideAt: getSetting("showGuideAt", false),
      loginState: {
        default: true,
        description: "未能获取登录状态",
        m: {
          state: "unknown",
        },
        pc: {
          state: "unknown",
        },
      },
    };
  },
  mounted: async function() {
    // 检查版本
    setTimeout(() => {
      this.checkUpdate();
    }, 200);
    // 渲染订单
    setTimeout(() => {
      this.renderOrders();
    }, 50);

    // 渲染通知
    setTimeout(() => {
      this.renderMessages();
    }, 500);
    this.dealWithLoginState();

    // 接收消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.action) {
        case "orders_updated":
          this.renderOrders(message.orders);
          break;
        case "messages_updated":
          this.renderMessages(message.messages);
          break;
        case "loginState_updated":
          this.dealWithLoginState();
          break;
        default:
          break;
      }
    });
  },
  computed: {
    showGuide: function() {
      if (!this.olduser && !this.showGuideAt) {
        return true;
      } else {
        return false;
      }
    },
    filteredMessages: function() {
      if (!this.messages || this.messages.length < 1) return [];
      return this.messages.filter((message) => {
        return (
          !this.selectedTab ||
          this.selectedTab == message.type ||
          (this.selectedTab == "priceProtectionNotice" &&
            message.type == "notice")
        );
      });
    },
    emptyMessageText: function() {
      switch (this.selectedTab) {
        case "checkin_notice":
          return "暂时还没有签到记录";
        case "priceProtectionNotice":
          return "暂时还没有价保记录";
        default:
          return "暂时还没有通知记录";
      }
    },
    emptyMessageHint: function() {
      switch (this.selectedTab) {
        case "checkin_notice":
          return "登录状态有效时，签到任务会按设定自动运行，也可在任务设置中点击刷新立即执行";
        case "priceProtectionNotice":
          return "发现满足条件的价保机会后，处理结果会显示在这里";
        default:
          return "任务产生新结果后会自动同步到这里";
      }
    },
  },
  methods: {
    checkUpdate: async function() {
        // Update check disabled
        localStorage.removeItem("newVersion");
    },

    switchContentType: function(type) {
      this.contentType = type;
      switch (type) {
        case "messages":
          this.renderMessages();
          this.readMessages();
          break;
        case "orders":
          this.renderOrders();
          break;
        default:
          break;
      }
    },
    readMessages: function() {
      this.unreadCount = 0;
      chrome.runtime.sendMessage(
        {
          action: "clearUnread",
        },
        function(response) {
          console.log("Response: ", response);
        }
      );
    },
    getPromotions: function() {
      let promotions = getSetting("promotions", []);
      promotions = promotions.filter((promotion) => {
        const isValid = promotion.validDate
          ? DateTime.fromJSDate(new Date(promotion.validDate)) >
            DateTime.local()
          : true;
        const isStarted = promotion.startDate
          ? DateTime.fromJSDate(new Date(promotion.startDate)) <
            DateTime.local()
          : true;
        return isValid && isStarted;
      });
      return promotions;
    },
    backup_picture: function(event) {
      if (event && event.target) {
        event.target.style.display = 'none';
      }
    },
    renderMessages: function(messages) {
      if (!messages) {
        messages = getSetting("jjb_messages", []);
        chrome.runtime.sendMessage({ action: "getMessages" }, (response) => {
          if (response && response.messages) {
            this.renderMessages(response.messages);
          }
        });
      }
      const removedTaskIds = ["2", "5", "14", "15", "16", "22", "23"];
      const removedTypes = ["coupon", "couponReceived", "goldCoinReceived", "beanReceived"];
      const removedBatches = ["baitiao", "gcmall"];
      this.messages = messages.filter(function(message) {
        return !removedTaskIds.includes(String(message.taskId)) &&
          !removedTypes.includes(message.type) &&
          !removedBatches.includes(message.batch);
      }).map(function(message) {
        message.time = readableTime(
          message.timestamp
            ? DateTime.fromMillis(message.timestamp)
            : DateTime.fromISO(message.time)
        );
        return message;
      });
    },
    renderOrders: function(orders) {
      if (!orders) {
        orders = getSetting("jjb_orders", []);
        chrome.runtime.sendMessage({ action: "getOrders" });
      }
      let skuPriceList = getSetting("skuPriceList", {});
      let suspendedApplyIds = getSetting("suspendedApplyIds", []);
      if (orders) {
        orders = orders.map(function(order) {
          order.displayTime = readableTime(
            DateTime.fromMillis(order.timestamp)
          );
          order.goods = uniqueGoods(order.goods);
          order.goods = order.goods.map(function(good, index) {
            good.suspended =
              _.indexOf(
                suspendedApplyIds,
                `applyBT_${order.id}_${good.sku}_${index + 1}`
              ) > -1
                ? "suspended"
                : false;
            return good;
          });
          return order;
        });
      } else {
        orders = [];
      }
      let promotions = this.getPromotions();
      orders.splice(1, 0, ...promotions);
      this.orders = orders;
      this.skuPriceList = skuPriceList;
    },
    // 处理登录状态
    dealWithLoginState: function() {
      function getStateDescription(loginState, type) {
        return (
          stateText[loginState[type].state] +
          (loginState[type].message
            ? `（ ${loginState[type].message} 上次检查： ${readableTime(
                DateTime.fromISO(loginState[type].time)
              )} ）`
            : "")
        );
      }

      let loginState = getLoginState();
      this.loginState = loginState;

      this.loginState["pc"].description =
        "当前登录状态" + getStateDescription(loginState, "pc");

      this.loginState.description = getStateDescription(loginState, "pc")

      // 如果登录失败，那么显示提示
      if (loginState.class == "failed") {
        this.showLoginState = true;
      }
    },
    selectType: function(type) {
      this.selectedTab = type;
    },
    dismiss: function(order) {
      this.hiddenPromotionIds.push(order.id);
      saveSetting("hiddenPromotionIds", this.hiddenPromotionIds);
      this.$forceUpdate();
    },
    toggleOrder: function(order) {
      if (_.indexOf(this.hiddenOrderIds, order.id) > -1) {
        this.hiddenOrderIds = _.pull(this.hiddenOrderIds, order.id);
      } else {
        this.hiddenOrderIds.push(order.id);
      }
      saveSetting("hiddenOrderIds", this.hiddenOrderIds);
      this.$forceUpdate();
    },
    toggleSuspend: function(order, good, index) {
      // localStorage.setItem(`order_${order.id}_index_${index}`, 'suspended')
      let suspendedApplyIds = getSetting("suspendedApplyIds", []);
      let applyId = `applyBT_${order.id}_${good.sku}_${index + 1}`;
      if (_.indexOf(suspendedApplyIds, applyId) > -1) {
        suspendedApplyIds = _.pull(suspendedApplyIds, applyId);
        good.suspended = false;
      } else {
        suspendedApplyIds.push(applyId);
        good.suspended = "suspended";
      }
      localStorage.setItem(
        "suspendedApplyIds",
        JSON.stringify(suspendedApplyIds)
      );
    },
    showChangelog: function() {
      this.newChangelog = false;
      localStorage.setItem("changelog_version", this.currentVersion);
      this.dialog = {
        title: "更新记录",
        content: `
          <iframe id="changelogIframe" frameborder="0" src="" style="width: 100%;min-height: 350px;"
          ></iframe>
        `,
        className: "changelog",
        buttons: [
          {
            label: "完成",
            type: "primary",
          },
        ],
      };
      this.showDialog = true;
    },
  },
};
</script>

<style scoped>
.orders,
.messages,
.discounts {
  overflow: hidden;
  height: 100%;
}

.contents-box.orders ul {
  height: 100%;
  overflow-y: auto;
  padding-bottom: 10px;
}
.message-items {
  margin-top: 0;
  height: calc(100% - 58px);
  overflow-y: auto;
  padding: 10px 12px 12px;
  box-sizing: border-box;
}
.order-good.suspended {
  opacity: 0.5;
}
.weui-navbar.true .weui-navbar__item.weui-bar__item_on {
  background-image: linear-gradient(180deg, #09bb07, #06a90c94);
}

.messages-top{
  display: flex;
  justify-content: center;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-content);
  padding: 10px 12px;
  position: sticky;
  top: 0;
  z-index: 10;
}

.messages-header {
  height: auto;
  padding-top: 0;
  position: static;
  z-index: auto;
}

.el-radio-group {
  margin: 0 auto;
}
</style>
