import { default as localStorage } from "../../utils/localStorage";
import { LICENSE_KEY, APP_ID, authFunc } from "../../utils/auth";
import fs from "../../utils/fileSystemManager.js";
import shareAppMessage from "../../utils/common";
import i18n from "../../utils/i18n.js";
import { plugin3d } from "./plugin-3d";
// const WX_APP_ID = 'wx04445cff065100ed'
const app = getApp();
const isEn = app.globalData.language === "en";
const RECORD_MODE_STYLE = {
  fontSize: isEn ? 18 : 32,
  padding: 24,
};
const noneIcon = {
  icon: "https://webar-static.tencent-cloud.com/assets/icon/none.png",
  id: "none",
  name: i18n.t("none"),
};
const EFFECT_MODE_SCROLL_LEFT = isEn ? 56 : 50;

const BEAUTY_OPTION_LIST = [
  {
    name: i18n.t("whiten"),
    id: "whiten",
    icon: "https://webar-static.tencent-cloud.com/assets/back-new/meibai.svg",
    intensity: 10,
  },
  {
    name: i18n.t("dermabrasion"),
    id: "dermabrasion",
    icon: "https://webar-static.tencent-cloud.com/assets/back-new/mopi.svg",
    intensity: 50,
  },
  {
    name: i18n.t("lift"),
    id: "lift",
    icon: "https://webar-static.tencent-cloud.com/assets/back-new/shoulian.svg",
    intensity: 0,
  },
  {
    name: i18n.t("shave"),
    id: "shave",
    icon: "https://webar-static.tencent-cloud.com/assets/back-new/xiaolian.svg",
    intensity: 0,
  },
  {
    name: i18n.t("eye"),
    id: "eye",
    icon: "https://webar-static.tencent-cloud.com/assets/back-new/dayan.svg",
    intensity: 20,
  },
  {
    name: i18n.t("chin"),
    id: "chin",
    icon: "https://webar-static.tencent-cloud.com/assets/back-new/xiaba.svg",
    intensity: 0,
  },
];
const DEFAULT_MUSIC_LIST = [
  {
    key: "01",
    url: "https://webar-static.tencent-cloud.com/assets/music/01.mp3",
  },
  {
    key: "02",
    url: "https://webar-static.tencent-cloud.com/assets/music/02.mp3",
  },
  {
    key: "03",
    url: "https://webar-static.tencent-cloud.com/assets/music/03.mp3",
  },
  {
    key: "04",
    url: "https://webar-static.tencent-cloud.com/assets/music/04.mp3",
  },
  {
    key: "05",
    url: "https://webar-static.tencent-cloud.com/assets/music/05.mp3",
  },
  {
    key: "06",
    url: "https://webar-static.tencent-cloud.com/assets/music/06.mp3",
  },
  {
    key: "07",
    url: "https://webar-static.tencent-cloud.com/assets/music/07.mp3",
  },
  {
    key: "08",
    url: "https://webar-static.tencent-cloud.com/assets/music/08.mp3",
  },
  {
    key: "09",
    url: "https://webar-static.tencent-cloud.com/assets/music/09.mp3",
  },
];
Page({
  /**
   * 页面的初始数据
   */
  data: {
    plugin3d,
    licenseKey: LICENSE_KEY,
    appid: APP_ID,
    authFunc,
    current: {
      id: "",
      type: "",
    },
    beautiId: "whiten",
    filterId: "none",
    stickerId: "none",
    makeUpId: "none",
    list: [],
    beautiList: BEAUTY_OPTION_LIST,
    stickerList: [],
    filterList: [],
    makeUpList: [],
    backBtnTop: 40, // 返回按钮位置
    optBtnBottom: 0, // 底部操作按钮
    direction: "front", // 相机方向
    inited: false,
    loadingEffect: false,
    disableReset: true,
    elapsedTime: "0.0",
    modeList: [i18n.t("takePhoto"), i18n.t("takeVideo")],
    activeRecordMode: i18n.t("takeVideo"),
    modeLeftW:
      750 / 2 - (RECORD_MODE_STYLE.fontSize + RECORD_MODE_STYLE.padding),
    isPlayingMusic: undefined,
    activeOptName: undefined,
    efModeScrollLeft: EFFECT_MODE_SCROLL_LEFT,
    isEn,
    beautify: {
      whiten: 0.1,
      dermabrasion: 0.5,
      lift: 0,
      shave: 0,
      eye: 0.2,
      chin: 0,
    },
    i18n: {
      takePhoto: i18n.t("takePhoto"),
      takeVideo: i18n.t("takeVideo"),
      switchMusic: i18n.t("switchMusic"),
      playMusic: i18n.t("playMusic"),
      flip: i18n.t("flip"),
      filter: i18n.t("filter"),
      beautify: i18n.t("beautify"),
      interest: i18n.t("interest"),
      makeUp: i18n.t("makeUp"),
      reset: i18n.t("reset"),
      sticker: i18n.t("sticker"),
    },
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {},

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {
    this.initPage();
    this.initMusic();
  },

  onShow() {
    // console.log('camera onshow', this.data.isPlayingMusic);
    if (!this.sdk) return;
    this.sdk.start();
    this.data.isPlayingMusic &&
      this.data.activeRecordMode == i18n.t("takeVideo") &&
      this.playMusic();
  },
  onHide() {
    console.log("camera onhide");
    // this.stopMusic() // onHide不会触发stop 凸，改用pause
    this.audioCtx.pause();
    this.sdk && this.sdk.stop();
  },
  onArCreated(sdk) {
    this.sdk = sdk.detail;
    this.setData({
      inited: true,
    });
    this.preloadResources();
  },
  async onError(error) {
    if (error.detail.code === 20001002) {
      const { confirm } = await wx.showModal({
        title: "您的license无效或试用已过期，请参考文档重新获取license",
        icon: "none",
      });
      if (confirm) {
        wx.navigateTo({
          url: `/pages/webview/index?src=https://cloud.tencent.com/document/product/616/71371`,
        });
      }
    }
  },
  async initPage() {
    let isBigScreen = false;
    const { screenWidth, screenHeight, platform, statusBarHeight } =
      await wx.getSystemInfoSync();
    this.data._screenRatio = screenWidth / 750;
    if (screenHeight - 1334 * this.data._screenRatio >= 100) {
      isBigScreen = true;
    }
    const backBtnTop = isBigScreen
      ? Math.min(
          statusBarHeight + 8,
          (screenHeight - 1334 * this.data._screenRatio) / 2 + 8
        )
      : Math.max(
          statusBarHeight + 8,
          (screenHeight - 1334 * this.data._screenRatio) / 2 + 8
        );
    this.setData({
      mainPageTop: isBigScreen ? statusBarHeight : 0,
      backBtnTop,
      bigScreen: isBigScreen,
      recordStatus: "init",
      canvasWidth: (screenHeight / 16) * 9 + "px",
    });
    global.backBtnTop = backBtnTop;
    global.mainPageTop = this.data.mainPageTop;
    global.bigScreen = isBigScreen;
    this._effectMap = {};
  },
  getBeauTiParam() {
    return Object.fromEntries(
      this.data.beautiList.map((item) => [item.id, item.intensity / 100])
    );
  },
  async initMusic() {
    if (!fs.mkdir("music")) return;
    const musicCache = fs.getFileList("music");
    let defaultMusic;
    if (!musicCache || musicCache.length === 0) {
      const defaultMusicInfo = await this.downloadFile(
        "https://webar-static.tencent-cloud.com/assets/music/01.mp3"
      );
      defaultMusic = defaultMusicInfo.tempFilePath;
      defaultMusic = fs.saveFile(defaultMusic, "music/01.mp3");
    } else {
      defaultMusic = musicCache.sort()[0];
    }
    // 设置静音条件下也能出声音
    wx.setInnerAudioOption({
      obeyMuteSwitch: false,
    });
    const audioCtx = wx.createInnerAudioContext();
    audioCtx.autoplay = false;
    audioCtx.loop = true;
    audioCtx.obeyMuteSwitch = false;
    audioCtx._musicKey = "01";
    // console.log('默认音乐地址',defaultMusic)
    audioCtx.src = defaultMusic;
    audioCtx._src = defaultMusic; // 这里存储一份原始的src数据 wxfile://xxx.mp3; bugfix: 安卓src会莫名变成file://开头，导致存储后续SDK解析失败
    audioCtx.onCanplay((_) => {
      console.log("music start");
    });
    audioCtx.onPlay((_) => {
      console.log("music play");
      this._forcePlayMusic = false;
      this.setData({
        isPlayingMusic: true,
      });
    });
    audioCtx.onStop((_) => {
      console.log("music stop");
      this.setData({
        isPlayingMusic: false || this._forcePlayMusic, // 切换过程的stop不修改UI
      });
    });
    audioCtx.onPause((_) => {
      console.log("music pause");
    });
    audioCtx.onError((e) => {
      console.log("music error", e);
    });
    this.audioCtx = audioCtx;
  },
  async getCanvasNode(id) {
    return new Promise((resolve) => {
      this.createSelectorQuery()
        .select(`#${id}`)
        .node()
        .exec((res) => {
          const canvasNode = res[0].node;
          resolve(canvasNode);
        });
    });
  },

  onClickRecord() {
    if (this.data.loadingEffect) {
      wx.showToast({
        title: i18n.t("toast_1"),
        icon: "none",
        duration: 1500,
      });
      return;
    }
    try {
      wx.vibrateShort();
    } catch (e) {}
    // 倒计时模式下再次点击拍摄按钮，停止倒计时，停止拍摄
    if (this.data.countdownOn) {
      this.stopCountdown();
      return;
    }
    if (this.data.activeRecordMode === i18n.t("takeVideo")) {
      this.startRecord();
    } else {
      this.takePhoto();
    }
  },
  async onClickStop() {
    if (!this.data.sdkRecording) {
      wx.showToast({
        title: i18n.t("toast_2"),
        icon: "none",
        duration: 1500,
      });
      return;
    }
    try {
      wx.vibrateShort();
    } catch (e) {}
    this._clearInterval();
    this.setData({
      elapsedTime: "0.0",
      recordStatus: "processing",
      sdkRecording: false,
    });
    wx.showLoading({
      title: i18n.t("loading_1"),
      mask: true,
    });
    try {
      const result = await this.sdk.stopRecord(
        this.data.isPlayingMusic
          ? {
              useOriginAudio: false,
              musicPath: this.audioCtx._src,
            }
          : {
              useOriginAudio: true,
            }
      );
      this.recording = false;
      // console.log('导出result', result);
      const { tempFilePath } = result;
      wx.hideLoading();
      this._forcePlayMusic = this.data.isPlayingMusic; // 维持录制之前的播放状态
      wx.navigateTo({
        url: `../export/export?file=${tempFilePath}`,
        complete: (_) => {
          setTimeout((_) => {
            this.setData({
              recordStatus: "init",
            });
          }, 300);
        },
      });
    } catch (e) {
      // wx.showToast({
      //   title:'录制失败',
      //   icon:'error',
      //   mask: true
      // })
      console.error("record error", e);
      wx.hideLoading();
      this.setData({
        recordStatus: "init",
      });
    }
  },

  async startRecord() {
    this.setData(
      {
        recordStatus: "recording",
      },
      async (_) => {
        // setData回调执行startRecord，避免动画卡顿
        // 延迟等待动画完成，避免主线程拥塞导致动画卡顿
        // todo 动画改成transform
        // setTimeout(async () => {
        // }, 100);
        // sdk真正开始录制后
        this.recording = true;
        const { isPlayingMusic } = this.data; // 记录停止前的播放状态
        this.stopMusic();
        try {
          await this.sdk.startRecord();
        } catch (e) {
          return;
        }
        isPlayingMusic && this.playMusic();
        this.setData({
          sdkRecording: true,
        });
        this.data._recordStartTime = +new Date(); // 记录开始时间
        this.data._timer = setInterval((_) => {
          this.setElapsedTime();
        }, 200);
      }
    );
  },

  async takePhoto() {
    const { uint8ArrayData, width, height } = await this.sdk.takePhoto();
    // console.log('takePhoto imageData', width, height);
    if (!this.photoCanvasNode) {
      this.photoCanvasNode = await this.getCanvasNode("photo-canvas");
    }
    this.photoCanvasNode.width = parseInt(width);
    this.photoCanvasNode.height = parseInt(height);
    const ctx = this.photoCanvasNode.getContext("2d");
    const imageData = this.photoCanvasNode.createImageData(
      uint8ArrayData,
      width,
      height
    );
    ctx.putImageData(imageData, 0, 0, 0, 0, width, height);
    const { pixelRatio } = wx.getSystemInfoSync();

    wx.canvasToTempFilePath({
      canvas: this.photoCanvasNode,
      x: 0,
      y: 0,
      width,
      height,
      destWidth: width * pixelRatio,
      destHeight: height * pixelRatio,
      quality: 1,
      success: (res) => {
        console.error("takePhoto ok", res);
        wx.navigateTo({
          url: `../export/export?file=${res.tempFilePath}&&type=image`,
        });
      },
      fail: (res) => {
        console.error("takePhoto error", res);
      },
    });
  },
  setList() {
    const type = this.data.current.type;
    switch (type) {
      case "":
        this.data.list = [];
        break;
      case "beauti":
        this.data.list = this.data.beautiList;
        break;
      case "makeUp":
        this.data.list = this.data.makeUpList;
        break;
      case "filter":
        this.data.list = this.data.filterList;
        break;
      case "sticker":
        this.data.list = this.data.stickerList;
        break;

      default:
        break;
    }
    this.setData({ list: [noneIcon, ...this.data.list] });
  },
  setType(event) {
    const type = event.currentTarget.id;
    this.setData({
      current: {
        type,
        id: this.data[type + "Id"],
      },
    });
    this.setList();
  },
  playMusic() {
    this.audioCtx && this.audioCtx.play();
  },
  stopMusic() {
    this.audioCtx && this.audioCtx.stop();
  },
  // 设置拍摄时间
  setElapsedTime() {
    const { _recordStartTime } = this.data;
    const now = +new Date();
    const time = (now - _recordStartTime) / 1000;
    const elapsedTime = Math.min(30, parseFloat(time)).toFixed(1);
    this.setData({
      elapsedTime,
    });
    // 超时自动停止
    if (elapsedTime === "30.0") {
      this.onClickStop();
    }
  },
  async onClickMusicIcon() {
    if (this._musicDownloading) return;
    try {
      wx.vibrateShort();
    } catch (e) {}
    if (!this.data.isPlayingMusic) {
      this.playMusic();
      return;
    }
    this._forcePlayMusic = true;
    this.stopMusic();
    const currentMusic = this.audioCtx._musicKey;
    const musicCache = fs.getFileList("music");
    const nextMusic = `0${(+currentMusic % DEFAULT_MUSIC_LIST.length) + 1}`;
    let targetMusic = musicCache.find((m) => {
      const targetName = `${nextMusic}.mp3`;
      const parts = m.split("/");
      const fileName = parts.pop();
      if (targetName === fileName) return true;
      return false;
    });
    if (!targetMusic) {
      this._musicDownloading = true;
      const targetMusicInfo = await this.downloadFile(
        `https://webar-static.tencent-cloud.com/assets/music/${nextMusic}.mp3`
      );
      targetMusic = targetMusicInfo.tempFilePath;
      musicCache.push({
        key: nextMusic,
        tempFilePath: targetMusic,
      });
      targetMusic = fs.saveFile(targetMusic, `music/${nextMusic}.mp3`);
      this._musicDownloading = false;
    }
    this.audioCtx._musicKey = nextMusic;
    this.audioCtx.src = targetMusic;
    this.audioCtx._src = targetMusic; // 这里存储一份原始的src数据 wxfile://xxx.mp3; bugfix: 安卓src会莫名变成file://开头，导致存储后续SDK解析失败
    this.audioCtx.play();
  },
  onClickCloseIcon() {
    this._forcePlayMusic = false;
    try {
      wx.vibrateShort();
    } catch (e) {}
    this.stopMusic();
  },
  onClickSwitchIcon() {
    this.setData({
      direction: this.data.direction === "front" ? "back" : "front",
    });
  },
  // 遮罩层点击事件
  onClickMask() {
    this.setData({
      current: {
        type: "",
        id: "",
      },
    });
  },
  setTypeList(type, list) {
    this.setData({ [type + "List"]: list });
    this.setList();
  },
  preloadResources() {
    localStorage.clear();
    const getFilterList = () =>
      new Promise(async (resolve, reject) => {
        let cache = localStorage.getItem("filter");
        // console.log('filter', cache);
        if (!cache) {
          const filterList = await this.sdk.getCommonFilter();
          cache = filterList.map((f) => ({
            name: f.Name,
            icon: f.CoverUrl,
            id: f.EffectId,
            weight: f.Weight || 0,
            intensity: 60,
            tag:
              f.Label.indexOf("少女") >= 0 || f.Label.indexOf("少年") >= 0
                ? i18n.t("tag_human")
                : i18n.t("tag_common"),
          }));
          localStorage.setItem("filter", cache);
        }
        cache.sort((a, b) => b.weight - a.weight);
        this.setTypeList("filter", cache);
        resolve(cache);
      });
    const getEffectList = () =>
      new Promise(async (resolve, reject) => {
        let cache = localStorage.getItem("effect");
        // console.log('effect', cache);
        if (!cache) {
          const effectList = await this.sdk.getEffectList({
            Type: "Preset",
            Label: "美妆",
          });
          //  && EXCEPT_EF_LIST.indexOf(e.Name)<0
          cache = effectList
            // .filter(e => e.Label.indexOf('美妆') >= 0)
            .map((f, idx) => ({
              name: f.Name,
              icon: f.CoverUrl,
              id: f.EffectId,
              label: f.Label,
              weight: f.Weight || 0,
              intensity: 60,
            }));
          localStorage.setItem("effect", cache);
        }
        cache.sort((a, b) => b.weight - a.weight);
        this.setTypeList("makeUp", cache);
        resolve(cache);
      });
    const getStickerList = () =>
      new Promise(async (resolve, reject) => {
        let cache = localStorage.getItem("sticker");
        if (!cache) {
          const effectList = await this.sdk.getEffectList({
            Type: "Preset",
            Label: "贴纸",
          });
          cache = effectList.map((f) => ({
            name: f.Name.slice(0, isEn ? 10 : 5),
            icon: f.CoverUrl,
            id: f.EffectId,
            label: f.Label,
            weight: f.Weight || 0,
          }));
          localStorage.setItem("sticker", cache);
        }
        cache.sort((a, b) => b.weight - a.weight);
        this.setTypeList("sticker", cache);
        resolve(cache);
      });
    getFilterList();
    getEffectList();
    getStickerList();
  },
  async downloadFile(url) {
    return new Promise((resolve) => {
      wx.downloadFile({
        url,
        success(res) {
          resolve(res);
        },
        fail(e) {
          resolve({
            error: e,
            tempFilePath: url,
          });
        },
      });
    });
  },
  onUpdate(e) {
    console.log(111, this.sdk);
    let { id, type, intensity } = e.detail;
    const item = this.data[type + "List"].find((f) => f.id === id);
    if (item) item.intensity = intensity;
    this.setData({
      [type + "Id"]: id,
      [type + "List"]: this.data[type + "List"],
    });
    this.setList();
    switch (type) {
      case "beauti":
        if (id === "none") {
          this.sdk.setBeautify(null);
          return;
        }
        if (id === "chin") {
          intensity = intensity / 300;
        } else {
          intensity = intensity / 100;
        }
        const _beauty = this.getBeauTiParam();
        this.sdk.setBeautify({
          ..._beauty,
          [id]: intensity,
        });
        break;
      case "filter":
        this._setFilter(id, intensity);
        break;
      case "makeUp":
        this.setData({ makeUpId: id });
        this._setEffect(id);
        break;

      case "sticker":
        this.setData({ stickerId: id });
        this._setEffect(id);
        break;

      default:
        break;
    }
  },
  onChangeEnable(e) {
    const enable = e.detail;
    if (enable) {
      this.sdk.enable();
    } else {
      this.sdk.disable();
    }
  },
  _setFilter(id, intensity) {
    if (id !== "" && id !== "none") {
      if (!this._effectMap[id]) {
        this.setData({
          loadingEffect: true,
        });
      }
      this.sdk.setFilter(id, intensity / 100, (_) => {
        this._effectMap[id] = true;
        this.setData({
          loadingEffect: false,
        });
      });
    } else {
      this.sdk.setFilter("", 0);
      try {
        wx.vibrateShort();
      } catch (e) {}
      wx.showToast({
        title: i18n.t("toast_4"),
        icon: "none",
        duration: 1500,
      });
    }
  },
  onClickModeItem(e) {
    const index = e.currentTarget.dataset.idx;
    this.setData({
      activeRecordMode: this.data.modeList[index],
    });
    if (this.data.activeRecordMode == i18n.t("takePhoto")) {
      // 拍照模式停止音乐
      this._forcePlayMusic = !!this.data.isPlayingMusic;
      this.stopMusic();
    } else {
      if (this.data.isPlayingMusic) {
        this.playMusic();
      }
    }
  },
  // 统一设置特效入口
  _setEffect(id) {
    const filter = this.data.makeUpList.find(
      (item) => item.id !== "none" && item.id === this.data.makeUpId
    );
    const sticker = this.data.stickerList.find(
      (item) => item.id !== "none" && item.id === this.data.stickerId
    );
    const list = [filter, sticker]
      .map((item, i) => {
        if (item)
          return {
            id: item.id,
            intensity: i === 1 ? 1 : (item.intensity ?? 100) / 100,
          };
      })
      .filter((item) => item);
    if (!list.length) {
      return this.sdk.setEffect([]);
    }
    if (!this._effectMap[id]) {
      this.setData({
        loadingEffect: true,
      });
    }
    try {
      wx.vibrateShort();
    } catch (e) {}
    this.sdk.setEffect(list, (_) => {
      this._effectMap[id] = true; // 标记加载位
      this.setData({
        loadingEffect: false,
      });
      if (this.data.activeRecordMode == i18n.t("takePhoto")) return;
      if (!this.audioCtx) {
        this.initMusic();
      }
      if (this.data.isPlayingMusic === undefined) {
        // 首次设置特效播放音乐
        this.audioCtx.play();
      }
    });
  },
  // 清除定时任务
  _clearInterval(timer) {
    if (timer) clearInterval(timer);
    else {
      clearInterval(this.data._timer);
    }
  },
  // test(){
  //   this.setData({
  //     test: !this.data.test
  //   })
  // },
  goBack() {
    if (this.data.recordStatus === "recording") {
      wx.showModal({
        title: i18n.t("tips"),
        content: i18n.t("modal_2"),
        confirmText: i18n.t("confirm"),
        cancelText: i18n.t("cancel"),
        success: async (res) => {
          if (res.confirm) {
            wx.showToast({
              title: i18n.t("toast_5"),
              icon: "none",
              duration: 1500,
            });
            this._clearInterval();
            try {
              await this.sdk.stopRecord();
              this.recording = false;
            } finally {
              wx.navigateBack();
            }
          } else if (res.cancel) {
            console.log("go back cancel");
          }
        },
      });
      return;
    }
    wx.navigateBack();
  },
  async onUnload() {
    // localStorage.clear()
    console.log("onUnload");
    try {
      this.sdk && this.sdk.stop();
      if (this.recording) {
        await this.sdk.stopRecord({
          destroy: true,
        });
        this.recording = false;
      }
    } catch (e) {}
    this.audioCtx && this.audioCtx.destroy();
    this.sdk && this.sdk.destroy();
  },
  onShareAppMessage() {
    return shareAppMessage();
  },
});
