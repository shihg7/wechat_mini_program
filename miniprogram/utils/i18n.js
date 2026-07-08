/* eslint-disable no-underscore-dangle */
const zh = {
  webar: "美颜特效",
  index_1: "适用于",
  index_2: "小程序、Web的AR SDK",
  index_3:
    "通过强大的SDK，以及统一的素材生产管理工具，轻松将AI美颜美妆、滤镜、趣味贴纸、虚拟背景等酷炫AR效果添加到您的小程序应用中。",
  index_4: "可应用于试妆试戴、营销活动、实时音视频、直播推流、视频拍摄等场景。",
  demo: "演示",
  learnMore: "了解更多",
  whiten: "美白",
  dermabrasion: "磨皮",
  lift: "瘦脸",
  shave: "削脸",
  eye: "大眼",
  chin: "下巴",
  takePhoto: "照片",
  takeVideo: "视频",
  tips: "提示",
  toast_1: "特效下载中，请耐心等待",
  toast_2: "录制启动中，请耐心等待",
  loading_1: "视频处理中",
  modal_1: "确定全部恢复默认效果吗？",
  confirm: "确定",
  cancel: "取消",
  toast_3: "美颜已关闭",
  tag_human: "人像",
  tag_common: "通用",
  toast_4: "滤镜已关闭",
  modal_2: "返回将丢失当前拍摄效果，确定返回？",
  toast_5: "录制结束中，请稍后",
  switchMusic: "切换音乐",
  playMusic: "播放音乐",
  flip: "翻转",
  filter: "滤镜",
  beautify: "美颜",
  interest: "趣味",
  makeUp: "美妆",
  reset: "重置",
  none: "关闭",
  save: "保存",
  photo: "照片",
  video: "视频",
  modal_3: "请先开启相册权限",
  setting: "去设置",
  saveSuccess: "保存成功",
  modal_4: "感谢体验！使用SDK为您的应用添加有趣功能吧。",
  policy: "您是否已阅读并同意 Web美颜特效隐私协议？",
  custom: "Custom 模式",
  custom_des: "支持拍摄和直播推流场景，包含美颜美妆、滤镜和趣味贴纸能力",
  native: "虚拟背景",
  native_des: "支持直播推流场景，包含虚拟背景以及基础美颜能力",
  godemo: "体验Demo",
  sticker: "贴纸",
  intensity: "程度",
  webDemo: "美颜特效 Web端 Demo",
  webDesc: "前往Web体验馆，体验更多",
  experience: "立即体验",
  qaGroup: "腾讯云-WebAR 答疑群",
  qaDesc: "在线协助您快速接入",
  addGroup: "立即加入",
  doc: "点击查看介绍文档、接入指南",
  pri1: "我已阅读并同意Web美颜特效",
  pri2: "隐私协议",
  background: "背景",
  watermark: "前景贴纸",
  logoName: "腾讯特效引擎",
  logoDesc: "小程序 SDK",
  class: "课堂",
  medical: "医疗",
  live: "直播",
};

const en = {
  webar: "Beauty Ar",
  index_1: "Apply to",
  index_2: "Wechat App and Web",
  index_3:
    "By using a powerful SDK and a unified material production management tool, it is easy to add cool AR effects such as AI beauty, filters, fun stickers, and virtual backgrounds to your mini program application.",
  index_4:
    "Can be applied to scenarios such as virtual try-on for makeup and accessories, WebRTC, live streaming, and video recording.",
  demo: "Demo",
  learnMore: "Learn More",
  whiten: "Whiten",
  dermabrasion: "Smooth",
  lift: "Slim face",
  shave: "V shape",
  eye: "Big eyes",
  chin: "Chin",
  takePhoto: "Photo",
  takeVideo: "Video",
  tips: "Note",
  toast_1: "Effect download in progress, please be patient",
  toast_2: "Recording is starting, please be patient",
  loading_1: "Video processing in progress",
  modal_1: "Are you sure you want to reset to default effects?",
  confirm: "OK",
  cancel: "Cancel",
  toast_3: "Beautify turned off",
  tag_human: "Human",
  tag_common: "Common",
  toast_4: "Filter turned off",
  modal_2: "Go back will cause the current recording effect to be lost",
  toast_5: "Stoping Recording, please wait a moment",
  switchMusic: "Change Music",
  playMusic: "Play Music",
  flip: "Flip",
  filter: "Filter",
  beautify: "Beautify",
  interest: "Interest",
  makeUp: "Makeup",
  reset: "Reset",
  none: "Close",
  save: "Save",
  photo: "Photo",
  video: "Video",
  modal_3: "Please enable access to photo album first",
  setting: "Go Settings",
  saveSuccess: "Save successful",
  modal_4:
    "Thanks for trying it out! Use the SDK to add fun features to your application",
  policy: "Please read and agree to the privacy policy",
  sticker: "sticker",
  intensity: "intensity",
  webDemo: "Web Demo",
  webDesc: "Web Experience Hall and experience more",
  experience: "Experience Now",
  qaGroup: "Tencent Cloud WebAR Q&A Group",
  qaDesc: "Online assistance for quick access",
  addGroup: "Join Now",
  doc: "Click to view the introduction document and access guide",
  pri1: "I have read and agreed to the",
  pri2: "privacy agreement",
  background: "background",
  watermark: "Foreground stickers",
  logoName: "Beauty AR",
  logoDesc: "Mini program SDK",
  custom: "Custom mode",
  custom_des:
    "Support shooting and live streaming scenes, including beauty and makeup, filters, and fun sticker capabilities",
  native: "Virtual background",
  native_des:
    "Support live streaming scenarios, including virtual backgrounds and basic beauty skills",
  godemo: "Experience Demo",
  class: "classroom",
  medical: "medical",
  live: "live",
};

class I18n {
  _lang;
  constructor(language = "zh") {
    this._lang = language;
  }
  set lang(language) {
    this._lang = language;
  }
  get lang() {
    return this._lang;
  }
  t(key) {
    let result;
    if (this._lang === "zh") result = zh[key];
    else result = en[key];
    console.log("zy sdk lang", this._lang);
    return result;
  }
}

export default new I18n();
