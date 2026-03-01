<template>
  <div class="guide">
    <div class="js_dialog" style="opacity: 1;" v-if="step > 0">
      <div class="weui-mask"></div>
      <div class="weui-dialog">
        <div class="testbox step-1" v-if="step == 1">
          <div class="weui-dialog__hd">
            <strong class="weui-dialog__title">恭喜安装成功！</strong>
          </div>
          <span class="js-close" @click="step = 0">x</span>
          <div class="weui-dialog__bd">
            <p>感谢你使用京价保！以下是一些简单的介绍：</p>
            <p>京价保是一个<a href="https://github.com/sunoj/jjb" target="_blank">公开源代码</a>的浏览器插件。它能自动监控已购商品的价格变化，在降价时自动申请价格保护。</p>
            <p>由于京东网页经常更新，京价保受其影响可能部分功能有时变得不可用，因此京价保会经常更新以保持功能正常。如果你使用的不是
              <a v-if="browser == 'chrome'" href="https://chrome.google.com/webstore/detail/gfgkebiommjpiaomalcbfefimhhanlfd" target="_blank">Chrome 拓展商店</a>
              <a v-if="browser == 'firefox'" href="https://addons.mozilla.org/zh-CN/firefox/addon/jjb/" target="_blank">Firefox 官方商店</a>
              <a v-if="browser == 'edge'" href="https://microsoftedge.microsoft.com/addons/detail/ljdjkkjiognkghfjndoddoplekppngge" target="_blank">Microsoft Edge 扩展中心</a>
              安装，强烈建议您使用上述渠道安装，只有这样你才能获得官方的自动更新。</p>
            <p>本插件的所有功能均为京东官方网页提供，未利用任何私有 API。</p>
          </div>
          <div class="weui-dialog__ft">
            <a class="weui-dialog__btn weui-dialog__btn_primary answer" @click="step = 2">继续</a>
          </div>
        </div>
        <div class="testbox step-2" v-if="step == 2">
          <div class="weui-dialog__hd">
            <strong class="weui-dialog__title">登录账号</strong>
          </div>
          <span class="js-close" @click="step = 0">x</span>
          <div class="weui-dialog__bd">
            <p>如你所知，京价保是一个浏览器插件。在你的授权下，京价保代替你自动访问京东的网页来执行一系列操作。 </p>
            <p>很显然，
              <b>京价保需要您登录京东才能完成你指定的工作</b>。而京东的登录有效期很短，如果您使用扫码登录等方式登录京东，京价保只能在短时间内保持有效。
            </p>
            <p>强烈建议您在登录时选择
              <b>“让京价保记住密码并自动登录”</b>，以便京价保自动完成工作。
            </p>
            <p>京价保确保
              <b>绝不会将您的密码上传和分享给任何人</b>，您可以通过
              <a href="https://github.com/sunoj/jjb" target="_blank">审查代码</a>来确认这一点，同时建议您
              <b>为京东配置一个唯一的登录密码，开启所有的安全措施</b>。
            </p>
            <p>当登录失效或者需要验证码时，京价保将会提醒你。除非你重新登录，否则京价保将无法继续完成任何工作。</p>
          </div>
          <div class="weui-dialog__ft">
            <a v-if="loginState.class == 'unknown'" class="weui-dialog__btn weui-dialog__btn_primary answer" @click="done('openLogin')">现在登录</a>
            <a v-else class="weui-dialog__btn weui-dialog__btn_primary answer" @click="done()">我知道了</a>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script>
import { getSetting } from "../utils";

export default {
  name: "guide",
  props: ["loginState"],
  data() {
    return {
      step: 1,
      browser: process.env.BROWSER
    };
  },
  methods: {
    done: async function(action) {
      this.step = 0
      localStorage.setItem('showGuideAt', new Date())
      if (action == 'openLogin') {
        chrome.runtime.sendMessage({
          action: "openLogin",
        }, function(response) {
          console.log("Response: ", response);
        });
      }
    }
  }
};
</script>
