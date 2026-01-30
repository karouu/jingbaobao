import { createApp } from 'vue';
import Alert from './toast.vue';   

var Toast = {} 
Toast.install = function (app) { 
 if(document.getElementsByClassName('alertBox').length){ 
   return
 }
 
 const mountNode = document.createElement('div');
 document.body.appendChild(mountNode);
 
 const toastApp = createApp(Alert);
 const $vm = toastApp.mount(mountNode);
 
 app.config.globalProperties.$toast = { 
  show(options) { 
   if (typeof options === 'string') { 
    $vm.text = options 
   }
   else if (typeof options === 'object') {
    Object.assign($vm, options) 
   }
   $vm.show = true 
    setTimeout(()=>{
       $vm.show = false
     },$vm.time)    
  },
  hide() { 
   $vm.show = false
  }
 }
}
export default Toast;