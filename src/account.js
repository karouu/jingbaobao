import { getSetting } from './utils'

export const getLoginState = function () {
  let pcState = getSetting('jjb_login-state_pc', {
    state: "unknown"
  })
  let mobileState = getSetting('jjb_login-state_m', {
    state: "unknown"
  })
  let loginState = {
    pc: pcState,
    m: mobileState,
    class: "unknown"
  }
  // 处理登录状态
  if (loginState.pc.state == 'alive' || loginState.m.state == 'alive') {
    loginState.class = "alive"
  } else if (loginState.pc.state == 'failed' && loginState.m.state == 'failed') {
    loginState.class = "failed"
  } else {
    loginState.class = "warning"
  }
  return loginState
}
