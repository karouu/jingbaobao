import { createApp } from 'vue';
import msgboxVue from './messageBox.vue';

const MessageBox = {};

MessageBox.install = function (app) {
  let currentMsgInstance = null;
  let mountNode = null;
  let appInstance = null;

  const initInstance = () => {
    mountNode = document.createElement('div');
    document.body.appendChild(mountNode);
    appInstance = createApp(msgboxVue);
    currentMsgInstance = appInstance.mount(mountNode);
  };

  app.config.globalProperties.$msgBox = {
    showMsgBox(options) {
      if (!currentMsgInstance) {
        initInstance();
      }
      if (typeof options === 'string') {
        currentMsgInstance.content = options;
      } else if (typeof options === 'object') {
        Object.assign(currentMsgInstance, options);
      }

      return currentMsgInstance.showMsgBox()
        .then(val => {
          if (appInstance) {
             appInstance.unmount();
             document.body.removeChild(mountNode);
             appInstance = null;
             currentMsgInstance = null;
             mountNode = null;
          }
          return Promise.resolve(val);
        })
        .catch(err => {
          if (appInstance) {
             appInstance.unmount();
             document.body.removeChild(mountNode);
             appInstance = null;
             currentMsgInstance = null;
             mountNode = null;
          }
          return Promise.reject(err);
        });
    }
  };
};
export default MessageBox;