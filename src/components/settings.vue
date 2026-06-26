<template>
  <div class="settings">
    <div class="weui-tab">
      <div :class="`${scienceOnline} weui-navbar`">
        <div
          :class="`weui-navbar__item ${ activeTab == 'frequency_settings' ? 'weui-bar__item_on' : ''}`"
          @click="switchTab('frequency_settings')"
        >任务设置</div>
        <div
          :class="`weui-navbar__item ${ activeTab == 'preference_settings' ? 'weui-bar__item_on' : ''}`"
          @click="switchTab('preference_settings')"
        >偏好设置</div>
      </div>
      <div class="weui-tab__panel">
        <form
          id="settings"
          data-persist="garlic"
          data-domain="true"
          data-destroy="false"
          method="POST"
        >
          <div class="frequency_settings settings_box" v-show="activeTab == 'frequency_settings'">
            <div class="tasks">
              <div class="task-list-header">
                <div>
                  <strong>可执行任务</strong>
                  <span>当前仅保留价格保护、每日京豆签到、购物车降价提醒</span>
                </div>
                <em>{{ tasks.length }} 项</em>
              </div>
              <div class="task-list">
                <div class="weui-cells weui-cells_form">
                  <div
                    class="task-item"
                    v-for="task in tasks"
                    :key="task.id"
                    @mouseover="hover = task.id"
                    @mouseleave="hover = false"
                  >
                    <div class="weui-cell weui-cell_select weui-cell_select-after">
                      <div class="weui-cell__bd job-m">
                        <span :title="task.description" v-tippy>
                          <a
                            v-if="task.platform == 'm'"
                            @click="openMobilePage(task.url)"
                          >{{task.title}}</a>
                          <a v-else :href="task.baseUrl || task.url" target="_blank">{{task.title}}</a>
                        </span>
                        <span
                          v-show="task.suspended && !task.checked"
                          v-tippy
                          title="因账号未登录任务已暂停运行"
                        >
                          <i class="job-state weui-icon-waiting-circle" @click="showLogin()"></i>
                        </span>
                        <i
                          v-show="task.checked"
                          v-tippy
                          :title="task.checkin_description"
                          class="today weui-icon-success-circle"
                        ></i>
                      </div>
                      <div class="weui-cell__bd task-controls">
                        <button
                          v-if="!task.new"
                          type="button"
                          class="task-run-button"
                          :disabled="!canRunTask(task)"
                          @click.stop="retryTask(task)"
                          v-tippy
                          :title="taskRunTitle(task)"
                        >{{ runningTaskId == task.id ? '启动中' : '立即运行' }}</button>
                        <select
                          class="weui-select"
                          @change="taskFrequencyUpdate(task, $event)"
                          v-model="task.frequency"
                          :name="`job${task.id}_frequency`"
                        >
                          <option
                            v-for="option in task.frequencyOption"
                            :value="option"
                            :key="`${task.id}${option}`"
                          >{{ frequencyOptionText[option] }}</option>
                        </select>
                        <span
                          class="enabled-task"
                          v-if="task.new"
                          @click="enabledTask(task)"
                          v-tippy
                          title="点击以启用新的任务"
                        >启用</span>
                        <i
                          v-else
                          v-show="hover == task.id"
                          class="setting-task weui-icon-info-circle"
                          @click="currentSettingTask = task.id"
                          v-tippy
                          title="查看任务设置"
                        ></i>
                      </div>
                    </div>
                    <task-setting
                      :task="task"
                      :current-task="currentSettingTask"
                      @close="currentSettingTask = null"
                    ></task-setting>
                  </div>
                </div>
              </div>
            </div>
            <div class="tips bottom-tips">
              <p class="page__desc" v-if="notice">
                <a id="notice" @dblclick="changeTips">{{notice.text}}</a>
                <a
                  v-if="notice.type == 'link' && notice.button && notice.mode != 'mobliepage'"
                  class="weui-btn weui-btn_mini weui-btn_primary"
                  target="_blank"
                  :href="notice.url"
                >{{notice.button}}</a>
                <span
                  v-if="notice.type == 'link' && notice.button && notice.mode == 'mobliepage'"
                  class="weui-btn weui-btn_mini weui-btn_primary"
                  @click="openMobilePage(notice.url)"
                  :data-url="notice.url"
                >{{notice.button}}</span>
              </p>
            </div>
          </div>
          <div class="preference_settings settings_box" v-show="activeTab == 'preference_settings'">
            <div class="settings-section">
              <div class="settings-section__header">
                <strong>通知提醒</strong>
                <span>控制通知内容、提示音和免打扰策略</span>
              </div>
              <div class="weui-cells weui-cells_form">
                <div class="weui-cell weui-cell_switch">
                  <div class="weui-cell__bd">
                    <span>隐藏价保商品信息</span>
                    <em>通知中不显示商品名称，降低旁人看到订单信息的风险</em>
                  </div>
                  <div class="weui-cell__ft">
                    <input
                      class="weui-switch"
                      type="checkbox"
                      true-value="checked"
                      false-value="false"
                      v-model="settings['hide_good']"
                      @change="onSettingChange('hide_good', $event)"
                    >
                  </div>
                </div>
                <div class="weui-cell weui-cell_switch">
                  <div class="weui-cell__bd">
                    <span>开启夜晚防打扰</span>
                    <em>晚上 12 点至凌晨 6 点不发送浏览器通知</em>
                  </div>
                  <div class="weui-cell__ft">
                    <input
                      class="weui-switch"
                      type="checkbox"
                      true-value="checked"
                      false-value="false"
                      v-model="settings['mute_night']"
                      name="mute_night"
                      @change="onSettingChange('mute_night', $event)"
                    >
                  </div>
                </div>
                <div class="weui-cell weui-cell_switch">
                  <div class="weui-cell__bd">
                    <span>
                      播放提示音效
                      <i
                        id="listen"
                        @click="listenAudio = true"
                        class="weui-icon-info-circle tippy"
                        data-tippy-content="试听全部提示音效"
                      ></i>
                    </span>
                    <em>价保、签到等通知出现时播放对应音效</em>
                  </div>
                  <div class="weui-cell__ft">
                    <input
                      class="weui-switch"
                      type="checkbox"
                      true-value="checked"
                      false-value="false"
                      v-model="settings['play_audio']"
                      name="play_audio"
                      @change="onSettingChange('play_audio', $event)"
                    >
                  </div>
                </div>
                <div class="weui-cell weui-cell_switch">
                  <div class="weui-cell__bd">
                    <span>签到成功静默</span>
                    <em>签到成功只写入记录，失败时仍通知</em>
                  </div>
                  <div class="weui-cell__ft">
                    <input
                      class="weui-switch"
                      type="checkbox"
                      true-value="checked"
                      false-value="false"
                      v-model="settings['mute_checkin']"
                      name="mute_checkin"
                      @change="onSettingChange('mute_checkin', $event)"
                    >
                  </div>
                </div>
              </div>
            </div>
            <div class="settings-section">
              <div class="settings-section__header">
                <strong>价保行为</strong>
                <span>控制自动价保的判断阈值和申请方式</span>
              </div>
              <div class="weui-cells weui-cells_form">
                <div class="weui-cell weui-cell_select weui-cell_select-after">
                  <div class="weui-cell__bd">
                    <span>最小价差</span>
                    <em>降价小于该金额时不自动申请价保</em>
                  </div>
                  <div class="weui-cell__bd">
                    <select
                      class="weui-select"
                      name="price_pro_min"
                      v-model="settings['price_pro_min']"
                      @change="onSettingChange('price_pro_min', $event)"
                    >
                      <option :value="0.1">0.1元</option>
                      <option :value="0.5">0.5元</option>
                      <option :value="1">1元</option>
                      <option :value="5">5元</option>
                    </select>
                  </div>
                </div>
                <div class="weui-cell weui-cell_select weui-cell_select-after">
                  <div class="weui-cell__bd">
                    <span>生鲜价保模式</span>
                    <em>生鲜价保时自动选择原返或生鲜品类券</em>
                  </div>
                  <div class="weui-cell__bd">
                    <select
                      class="weui-select"
                      name="refund_type"
                      v-model="settings['refund_type']"
                      @change="onSettingChange('refund_type', $event)"
                    >
                      <option value="1">原返</option>
                      <option value="2">限生鲜品类京券</option>
                    </select>
                  </div>
                </div>
                <div class="weui-cell weui-cell_switch">
                  <div class="weui-cell__bd">
                    <span>我是 Plus 会员</span>
                    <em>价保对比时优先按 Plus 会员价判断</em>
                  </div>
                  <div class="weui-cell__ft">
                    <input
                      class="weui-switch"
                      type="checkbox"
                      true-value="checked"
                      false-value="false"
                      name="is_plus"
                      v-model="settings['is_plus']"
                      @change="onSettingChange('is_plus', $event)"
                    >
                  </div>
                </div>
                <div class="weui-cell weui-cell_switch">
                  <div class="weui-cell__bd">
                    <span>被动价保模式</span>
                    <em>发现价保机会时只提醒，不自动提交申请</em>
                  </div>
                  <div class="weui-cell__ft">
                    <input
                      class="weui-switch"
                      type="checkbox"
                      true-value="checked"
                      false-value="false"
                      name="prompt_only"
                      v-model="settings['prompt_only']"
                      @change="onSettingChange('prompt_only', $event)"
                    >
                  </div>
                </div>
              </div>
            </div>
            <div class="settings-section">
              <div class="settings-section__header">
                <strong>页面与隐私</strong>
                <span>控制价格走势图等页面行为</span>
              </div>
              <div class="weui-cells weui-cells_form">
                <div class="weui-cell weui-cell_switch">
                  <div class="weui-cell__bd">
                    <span>停用价格走势图</span>
                    <em>停止展示价格走势，并停止上报本地获取的商品价格</em>
                  </div>
                  <div class="weui-cell__ft">
                    <input
                      class="weui-switch"
                      type="checkbox"
                      true-value="checked"
                      false-value="false"
                      name="disable_pricechart"
                      v-model="settings['disable_pricechart']"
                      @change="onSettingChange('disable_pricechart', $event)"
                    >
                  </div>
                </div>
              </div>
            </div>
            <div class="settings-section">
              <div class="settings-section__header">
                <strong>数据维护</strong>
                <span>管理本地账号、密码和运行状态</span>
              </div>
              <div class="other_actions">
                <a
                  href="#"
                  id="clearAccount"
                  @click="clearAccount"
                  class="weui-btn weui-btn_mini weui-btn_plain-default tippy"
                  data-tippy-placement="top-start"
                  data-tippy-content="在登录时勾选记住密码可保存新的密码"
                >清除账号密码和记录</a>
              </div>
            </div>
            <p class="text-tips version">当前版本：{{currentVersion}}</p>
          </div>
        </form>
      </div>
    </div>
    <div class="bottom-box">
      <div class="avatar">
        <a
          id="loginState"
          :class="`${loginState.class} login-state`"
          v-tippy
          @click="showLogin()"
          :title="loginState.description"
        ></a>
      </div>
    </div>

    <!-- 试听音效 -->
    <div id="listenAudio" v-if="listenAudio">
      <div class="js_dialog" style="opacity: 1;">
        <div class="weui-mask"></div>
        <div class="weui-dialog">
          <div class="weui-dialog__hd">
            <strong class="weui-dialog__title">试听语言提示</strong>
          </div>
          <div class="weui-dialog__bd">
            <div class="weui-cells">
              <div class="weui-cell weui-cell_access">
                <div
                  class="weui-cell__bd message listenVoice"
                  @click="listenVoice('priceProtectionNotice', 'jiabao')"
                >
                  <span>
                    <i class="notice jiabao"></i>发现价格保护机会
                  </span>
                </div>
                <div class="weui-cell__ft"></div>
              </div>
              <div class="weui-cell weui-cell_access">
                <div
                  class="weui-cell__bd message listenVoice"
                  @click="listenVoice('checkin_notice', 'bean')"
                >
                  <span>
                    <i class="checkin_notice bean"></i>签到成功，京豆入账
                  </span>
                </div>
                <div class="weui-cell__ft"></div>
              </div>
              <div class="weui-cell weui-cell_access">
                <div
                  class="weui-cell__bd message listenVoice"
                  @click="listenVoice('checkin_notice', 'coin')"
                >
                  <span>
                    <i class="checkin_notice coin"></i>金融签到，钢镚掉落
                  </span>
                </div>
                <div class="weui-cell__ft"></div>
              </div>
            </div>
          </div>
          <div class="weui-dialog__ft">
            <a class="weui-dialog__btn weui-dialog__btn_primary" @click="listenAudio = false">关闭</a>
          </div>
        </div>
      </div>
    </div>
    <we-dialog
      v-if="dialog && showDialog"
      @close="showDialog = false"
      :title="dialog.title"
      :content="dialog.content"
      :className="dialog.className"
      :buttons="dialog.buttons"
    ></we-dialog>
  </div>
</template>

<script>
import { frequencyOptionText, getTasks } from "../tasks";
import { getSetting, saveSetting } from "../utils";
import taskSetting from "./task-setting.vue";
import weDialog from "./we-dialog.vue";

const settingKeys = [
  "mute_checkin",
  "play_audio",
  "mute_night",
  "hide_good",
  "disable_pricechart",
  "prompt_only",
  "is_plus",
  "refund_type",
  "price_pro_min"
];

export default {
  name: "settings",
  props: ["loginState"],
  components: { taskSetting, weDialog },
  data() {
    return {
      frequencyOptionText: frequencyOptionText,
      currentVersion: process.env.VERSION,
      scienceOnline: false,
      listenAudio: false,
      activeTab: "frequency_settings",
      currentSettingTask: null,
      runningTaskId: null,
      taskList: [],
      hover: null,
      settings: {
        disable_pricechart: false,
        hide_good: false,
        is_plus: false,
        mute_checkin: false,
        mute_night: true,
        play_audio: false,
        price_pro_min: 0.5,
        prompt_only: false,
        refund_type: "1"
      },
      dialog: {},
      showDialog: false,
      notice: null
    };
  },
  mounted: async function() {
    this.getTaskList();
    this.changeTips();
    settingKeys.map(settingKey => {
      this.settings[settingKey] = getSetting(settingKey, this.settings[settingKey]);
    });
    // 测试是否科学上网
    setTimeout(() => {
      this.tryGoogle();
    }, 50);
  },
  watch: {
    loginState: function(newState, oldState) {
      this.getTaskList();
    }
  },
  computed: {
    tasks: function() {
      return this.taskList.filter(task => !task.new);
    }
  },
  methods: {
    taskFrequencyUpdate: function(task, event) {
      saveSetting(`job${task.id}_frequency`, event.target.value);
      this.getTaskList();
      this.$toast.show({
        text: "设置已保存",
        time: "500" //显示的时间
      });
    },

    onSettingChange: function(settingKey, event) {
      console.log("onSettingChange", settingKey, event.target.value, event);
      let notice = null;
      let value = event.target.value
      switch (settingKey) {
        case "disable_pricechart":
          notice =
            "停用价格走势功能将停止上报京价保在本地获取到的商品价格，同时也会停止展示价格走势图";
          break;
        case "prompt_only":
          notice =
            "开启本选项后，发现商品降价有价保机会时，京价保只会发送浏览器提醒，而不会自动提交价保申请";
          break;
        default:
          break;
      }

      // 处理 checkbox
      if (event.target.type == "checkbox") {
        if (event.target.checked) {
          value = "checked"
        } else {
          value = false
        }
      }

      if (notice && value) {
        this.$msgBox
          .showMsgBox({
            title: "选项确认",
            content: notice
          })
          .then(async val => {
            saveSetting(settingKey, value);
          })
          .catch(() => {
            setTimeout(() => {
              this.settings[settingKey] = getSetting(settingKey, 'false')
              console.log(this.settings[settingKey], this.settings)
            }, 50);
            return console.log("取消", this.settings[settingKey], getSetting(settingKey, 'false'));
          });
      } else {
        saveSetting(settingKey, value);
      }
      this.$toast.show({
        text: "设置已保存",
        time: "500" //显示的时间
      });
    },
    // 换 Tips
    changeTips: function() {
      let announcements = getSetting("announcements", []);
      let tip = announcements[Math.floor(Math.random() * announcements.length)];
      this.notice = tip;
    },
    switchTab: async function(tab) {
      this.activeTab = tab;
    },
    openMobilePage: function(url) {
      chrome.runtime.sendMessage(
        {
          action: "openUrlAsMoblie",
          url: url
        },
        function(response) {
          console.log("Response: ", response);
        }
      );
    },
    clearAccount: async function() {
      this.$msgBox
        .showMsgBox({
          title: "清除密码确认",
          content:
            "清除密码将移除本地存储的账号密码；清除后若需继续使用请重新登录并选择让京价保记住密码"
        })
        .then(async val => {
          localStorage.removeItem("jjb_account");
          chrome.tabs.create({
            url: "https://passport.jd.com/uc/login"
          });
          console.log("确认");
        })
        .catch(() => {
          console.log("取消清除");
        });
    },
    tryGoogle: async function() {
      try {
        let response = await fetch(
          "https://www.googleapis.com/discovery/v1/apis?name=abusiveexperiencereport"
        );
        if (response.status == "200") {
          this.scienceOnline = true;
        } else {
          this.scienceOnline = false;
        }
      } catch (error) {
        this.scienceOnline = false;
      }
    },
    // 试听通知
    listenVoice: function(type, batch) {
      chrome.runtime.sendMessage(
        {
          action: type,
          batch: batch,
          test: true,
          title: "京价保通知试听",
          content: "并没有钱，这只是假象，你不要太当真"
        },
        function(response) {
          console.log("Response: ", response);
        }
      );
    },
    showLogin: function() {
      this.$emit("show-login");
    },
    // 任务列表
    getTaskList: async function() {
      this.taskList = getTasks();
    },
    canRunTask: function(task) {
      return task &&
        !task.unavailable &&
        !task.deprecated &&
        !task.new &&
        !this.runningTaskId;
    },
    taskRunTitle: function(task) {
      if (!task) return "";
      if (this.runningTaskId == task.id) return "任务正在启动";
      if (task.unavailable || task.deprecated) return "任务不可用";
      if (task.pause) return `${task.pause_description || "任务已达到频率限制"}，手动运行会立即强制执行`;
      return `${task.last_run_description}，点击立即运行`;
    },
    retryTask: function(task, hideNotice = false) {
      if (!this.canRunTask(task)) return;
      this.runningTaskId = task.id;
      chrome.runtime.sendMessage(
        {
          action: "runTask",
          hideNotice: hideNotice,
          taskId: task.id
        },
        response => {
          this.runningTaskId = null;
          if (!hideNotice) {
            if (response && response.result == "success") {
              this.$toast.show({
                text: "任务已启动",
                time: "3000"
              });
            } else if (response && response.result == "pause") {
              this.$toast.show({
                text: "任务已暂停运行",
                message: response.message,
                time: "3000"
              });
            } else {
              this.$toast.show({
                text: "任务暂未运行",
                message: response && response.message,
                time: "3000"
              });
            }
          }
        }
      );
    },
    enabledTask: function(task) {
      saveSetting(`task-${task.id}:settings`, {
        new: false
      });
      this.$toast.show({
        text: "任务启用成功",
        time: "1000"
      });
      setTimeout(() => {
        this.getTaskList();
      }, 250);
    }
  }
};
</script>
<style  scoped>
.settings_box {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
}

.settings .weui-tab__panel,
.settings form {
  flex: 1;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.frequency_settings .tasks {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}

.settings .page__desc {
  font-size: 12px;
  min-height: 38px;
  height: auto;
  line-height: 18px;
  color: var(--text-secondary);
}

.frequency_settings .weui-select {
  width: 112px;
  height: 42px;
  padding: 0 30px 0 12px;
  border-radius: 12px;
  background-color: var(--bg-light);
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
  text-align: center;
}
.settings .task-list {
  margin: 12px 10px 0;
  overflow-y: auto;
  min-height: 0;
  border: 1px solid var(--border-color);
  border-radius: var(--card-radius);
  background: var(--bg-white);
  flex: 1;
}

.task-item {
  position: relative;
}

.task-item:after {
  content: " ";
  position: absolute;
  left: 0;
  top: 0;
  right: 0;
  height: 1px;
  border-top: 1px solid #e5e5e5;
  color: #e5e5e5;
  -webkit-transform-origin: 0 0;
  transform-origin: 0 0;
  -webkit-transform: scaleY(0.5);
  transform: scaleY(0.5);
  left: 12px;
  z-index: 2;
}

.settings .task-list .weui-cells {
  margin-top: 0;
  background: transparent;
}

.settings .task-list .weui-cell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  min-height: 72px;
  padding: 12px 14px;
  box-sizing: border-box;
}

.enabled-task {
  color: #690;
  margin-left: 6px;
  cursor: pointer;
}

.setting-task {
  font-size: 19px;
  color: #6cc7f1;
  margin-left: 5px;
  margin-top: 0px;
  cursor: pointer;
}

.frequency_settings .weui-cell_select .weui-cell__bd:after {
  display: none;
}

.task-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 12px 10px 0;
  padding: 14px 16px;
  border: 1px solid var(--border-color);
  border-radius: var(--card-radius);
  background: var(--bg-white);
  color: var(--text-primary);
}

.task-list-header strong {
  display: block;
  font-size: 18px;
  line-height: 24px;
}

.task-list-header span {
  display: block;
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 18px;
}

.task-list-header em {
  flex-shrink: 0;
  min-width: 48px;
  height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--accent-settings);
  color: #fff;
  font-style: normal;
  font-weight: 700;
  font-size: 13px;
  line-height: 30px;
  text-align: center;
}

.task-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  min-width: 0;
}

.task-run-button {
  min-width: 72px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--accent-settings);
  border-radius: 10px;
  background: transparent;
  color: var(--accent-settings);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  line-height: 34px;
  white-space: nowrap;
}

.task-run-button:hover:not(:disabled) {
  background: var(--accent-settings);
  color: #fff;
}

.task-run-button:disabled {
  border-color: var(--border-light);
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.frequency_settings .bottom-tips {
  flex-shrink: 0;
  margin-top: 8px;
}

.preference_settings.settings_box {
  overflow-y: auto;
  padding: 12px 10px 18px;
  gap: 12px;
}

.settings-section {
  flex-shrink: 0;
}

.settings-section__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 0 2px 8px;
}

.settings-section__header strong {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 700;
}

.settings-section__header span {
  color: var(--text-tertiary);
  font-size: 12px;
  line-height: 1.4;
  text-align: right;
}

.preference_settings .weui-cells {
  margin: 0;
  border: 1px solid var(--border-color);
  border-radius: var(--card-radius);
  overflow: hidden;
  background: var(--bg-white);
  flex-shrink: 0;
}

.preference_settings .weui-cell {
  min-height: 64px;
  padding: 12px 16px;
  box-sizing: border-box;
}

.preference_settings .weui-cell__bd:first-child {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.preference_settings .weui-cell__bd span {
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
}

.preference_settings .weui-cell__bd em {
  color: var(--text-tertiary);
  font-size: 12px;
  font-style: normal;
  line-height: 1.4;
}

.preference_settings .weui-cell_select .weui-cell__bd:last-child {
  flex: 0 0 150px;
}

.preference_settings .weui-select {
  width: 100%;
  height: 40px;
  padding: 0 28px 0 12px;
  border-radius: 12px;
  background-color: var(--bg-light);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
}

.preference_settings .other_actions {
  display: flex;
  justify-content: center;
  padding: 14px 0 4px;
}

.preference_settings .version {
  padding: 12px 0;
  color: var(--text-tertiary);
  flex-shrink: 0;
}
</style>
