import { LICENSE_KEY, APP_ID, authFunc } from "../../utils/auth";
import i18n from "../../utils/i18n.js";

const app = getApp();
const noneIcon = {
  icon: "https://webar-static.tencent-cloud.com/assets/icon/none.png",
  id: "none",
  name: i18n.t("none"),
};

Page({
  data: {
    licenseKey: LICENSE_KEY,
    appid: APP_ID,
    authFunc,
    backBtnTop: 40, // 返回按钮位置
    optBtnBottom: 0, // 底部操作按钮
    inited: false,
    current: {
      id: "",
      type: "",
    },
    beautiId: "whiten",
    backgroundId: "none",
    watermarkId: "none",
    list: [],
    beauti: {
      whiten: 0.1,
      dermabrasion: 0.5,
      lift: 0,
      intensity: 0.2,
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
      none: i18n.t("none"),
      sticker: i18n.t("sticker"),
      class: i18n.t("class"),
      medical: i18n.t("medical"),
      live: i18n.t("live"),
      background: i18n.t("background"),
    },
    beautiList: [
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
        name: i18n.t("eye"),
        id: "eye",
        icon: "https://webar-static.tencent-cloud.com/assets/back-new/dayan.svg",
        intensity: 20,
      },
    ],
    backgroundList: [
      {
        id: "https://webar-static.tencent-cloud.com/assets/back-new/class.png",
        name: i18n.t("class"),
      },
      {
        id: "https://webar-static.tencent-cloud.com/assets/back-new/medical.png",
        name: i18n.t("medical"),
      },
      {
        id: "https://webar-static.tencent-cloud.com/assets/back-new/live.png",
        name: i18n.t("live"),
      },
    ],
    filterList: [],
  },
  onReady() {
    this.initPage();
  },
  goBack() {
    wx.navigateBack();
  },
  onArCreated(sdk) {
    this.sdk = sdk.detail;
    this.setData({
      inited: true,
    });
  },
  onClickSwitchIcon() {
    this.sdk.pusherContext.switchCamera();
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
  onUpdate(e) {
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
          this.setData({ beauti: {} });
          return;
        }
        this.setData({
          beauti: {
            ...Object.fromEntries(
              this.data.beautiList.map((item) => [
                item.id,
                item.intensity / 100,
              ])
            ),
            [id]: intensity / 100,
          },
        });
        break;
      case "filter":
        this.sdk.setFilter(id === "none" ? "" : id, intensity);
        break;
      case "background":
        if (id === "none") {
          this.sdk.setBackground(null);
        } else {
          this.download(id).then((buffer) => {
            this.sdk.setBackground({
              type: "image",
              src: buffer,
            });
          });
        }
        break;
      case "watermark":

      default:
        break;
    }
  },
  async download(url) {
    if (url instanceof ArrayBuffer) return url;
    return new Promise((resolve, reject) => {
      wx.request({
        url: url,
        responseType: "arrayBuffer",
        success: (res) => {
          const { data } = res;
          resolve(data);
        },
        fail: (res) => {
          reject(res);
        },
      });
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
      case "watermark":
        this.data.list = this.data.stickerList;
        break;
      case "filter":
        this.data.list = this.data.filterList;
        break;
      case "background":
        this.data.list = this.data.backgroundList;
        break;

      default:
        break;
    }
    this.setData({ list: [noneIcon, ...this.data.list] });
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
  onChangeEnable(e) {
    const enable = e.detail;
    if (enable) {
      this.setData({
        beauti: {
          ...Object.fromEntries(
            this.data.beautiList.map((item) => [item.id, item.intensity / 100])
          ),
        },
      });
      this.sdk.enable();
    } else {
      this.setData({ beauti: {} });
      this.sdk.disable();
    }
  },
  async initPage() {
    let isBigScreen = false;
    const { screenWidth, screenHeight, platform, statusBarHeight } =
      wx.getSystemInfoSync();
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
    });
  },
  async getFilterList() {
    const filterList = await this.sdk.getCommonFilter();
    cache = filterList.map((f) => ({
      name: f.Name,
      icon: f.CoverUrl,
      id: f.EffectId,
      weight: f.Weight || 0,
      intensity: 100,
      tag:
        f.Label.indexOf("少女") >= 0 || f.Label.indexOf("少年") >= 0
          ? i18n.t("tag_human")
          : i18n.t("tag_common"),
    }));
    cache.sort((a, b) => b.weight - a.weight);
    this.setData({
      filterList: cache,
    });
  },
});
