const weui = {
  toast(content, duration = 3000) {
    if (typeof duration === 'object') {
        duration = duration.duration || 3000;
    }
    
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="weui-mask_transparent"></div>
      <div class="weui-toast">
        <i class="weui-icon-success-no-circle weui-icon_toast"></i>
        <p class="weui-toast__content">${content}</p>
      </div>
    `;
    document.body.appendChild(div);

    setTimeout(() => {
      div.remove();
    }, duration);
  },

  confirm(content, yes, no) {
    const div = document.createElement('div');
    div.innerHTML = `
        <div class="weui-mask"></div>
        <div class="weui-dialog">
            <div class="weui-dialog__bd">${content}</div>
            <div class="weui-dialog__ft">
                <a href="javascript:;" class="weui-dialog__btn weui-dialog__btn_default" id="weui-cancel">取消</a>
                <a href="javascript:;" class="weui-dialog__btn weui-dialog__btn_primary" id="weui-confirm">确定</a>
            </div>
        </div>
    `;
    document.body.appendChild(div);

    div.querySelector('#weui-confirm').addEventListener('click', () => {
        div.remove();
        if (yes) yes();
    });

    div.querySelector('#weui-cancel').addEventListener('click', () => {
        div.remove();
        if (no) no();
    });
  }
};

export default weui;