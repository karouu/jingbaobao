import * as _ from "lodash"
$ = window.$ = window.jQuery = require('jquery')

import tippy from 'tippy.js'
import 'weui';
import { createApp } from 'vue'

import { getLoginState } from './account'

import App from './components/App.vue';
// import VueLazyload from 'vue-lazyload'

import MessageBox from './components/messageBox/messageBox';

import Toast from './components/toast/toast';

const app = createApp(App);

app.use(MessageBox);
app.use(Toast);

// app.use(VueLazyload, {
//   preLoad: 1.3,
//   error: '',
//   attempt: 1
// })

app.mount('#app');



$(document).ready(function () {
  const account = localStorage.getItem('jjb_account');
  let loginState = getLoginState()

  // tippy
  tippy('.tippy')

  // 是否已存在弹窗
  function isNoDialog() {
    return ($(".js_dialog:visible").length < 1) && ($(".weui-dialog:visible").length < 1)
  }

  setTimeout(() => {
    // 没有弹框 且 未登录账号
    if (isNoDialog() && (!account && loginState.class == "failed") || loginState.class == "unknown") {
      $("#loginNotice").show();
    }

    if (!account) {
      $("#clearAccount").addClass('weui-btn_disabled')
    }
  }, 200);


  $(".weui-dialog__ft a").on("click", function () {
    $("#dialogs").hide()
    $("#listenAudio").hide()
    $("#loginNotice").hide()
    $("#changeLogs").hide()
  })

  $("#listen").on("click", function () {
    $("#listenAudio").show()
  })

  $(".showLoginState").on("click", function () {
    $("#loginNotice").show()
  })


  $("#jEventDialags .js-close").on("click", function () {
    $("#jEventDialags").hide()
  })

  $("#dialogs .js-close").on("click", function () {
    $("#dialogs").hide()
  })

  $("#wechatDialags .js-close").on("click", function () {
    $("#wechatDialags").hide()
  })


  $(".openLogin").on("click", function () {
    chrome.runtime.sendMessage({
      text: "openLogin",
    }, function (response) {
      console.log("Response: ", response);
    });
  })

  $("#pricePro").on("click", function () {
    chrome.runtime.sendMessage({
      text: "openPricePro"
    }, function (response) {
      console.log("Response: ", response);
    })
  })

})

chrome.windows.getCurrent(function (current) {
  if (current.type == "popup") {
    $(".main-app").addClass("popup-window")
  }
})


// 防止缩放
chrome.tabs.getZoomSettings(function (zoomSettings) {
  if (zoomSettings.defaultZoomFactor > 1 && zoomSettings.scope == 'per-origin' && zoomSettings.mode == 'automatic') {
    let zoomPercent = (100 / (zoomSettings.defaultZoomFactor * 100)) * 100;
    document.body.style.zoom = zoomPercent + '%'
    document.body.style.setProperty("--zoom-factor", zoomSettings.defaultZoomFactor);
  }
})
