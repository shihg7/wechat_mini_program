/* eslint-disable no-undef */
/* eslint-disable arrow-parens */
/* eslint-disable no-unused-vars */
import shareAppMessage from "../../utils/common";
import i18n from "../../utils/i18n.js";

Page({
  /**
   * 页面的初始数据
   */
  data: {
    file: "",
    backBtnTop: 40,
    i18n: {
      save: i18n.t("save"),
      photo: i18n.t("photo"),
      video: i18n.t("video"),
    },
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log("options", options);
    this.setData({
      file: options.file,
      type: options.type,
      backBtnTop: global.backBtnTop,
      mainPageTop: global.mainPageTop,
      bigScreen: global.bigScreen,
    });
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {},

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // if(this.data._preStatus === 'show'){
    //   this.setData({
    //     showCustomModal: true
    //   })
    // }
  },
  onHide() {},
  onClickExport() {
    if (this.data.type === "image") {
      wx.saveImageToPhotosAlbum({
        filePath: this.data.file,
        success: (_) => {
          this.showSuccessModal();
          // this.setData({
          //   showCustomModal: true
          // })
          // wx.showToast({
          //   title: "保存成功！"
          // });
          // setTimeout(_=>{
          //   wx.navigateBack({
          //     delta: 2
          //   })
          // },1000)
        },
        fail: () => {
          this.getWxAuth();
        },
      });
    } else {
      wx.saveVideoToPhotosAlbum({
        filePath: this.data.file,
        success: (res) => {
          this.showSuccessModal();
          // this.setData({
          //   showCustomModal: true
          // })
          // wx.showToast({
          //   title: "保存成功！"
          // });
          // setTimeout(_=>{
          //   wx.navigateBack({
          //     delta: 2
          //   })
          // },1000)
        },
        fail: () => {
          this.getWxAuth();
        },
      });
    }
  },
  getWxAuth() {
    wx.getSetting({
      success: (res) => {
        if (!res.authSetting["scope.writePhotosAlbum"]) {
          wx.showModal({
            content: i18n.t("modal_3"),
            confirmText: i18n.t("setting"),
            showCancel: false,
            success: (res) => {
              if (res.confirm) {
                wx.openSetting({
                  success: (res) => {
                    if (res.authSetting["scope.writePhotosAlbum"]) {
                      this.onClickExport();
                    }
                  },
                  fail: () => {},
                });
              } else if (res.cancel) {
                // do nothing
              }
            },
          });
        }
      },
    });
  },
  showSuccessModal() {
    wx.showModal({
      title: i18n.t("saveSuccess"),
      content: i18n.t("modal_4"),
      confirmText: i18n.t("confirm"),
      showCancel: false,
      success: (res) => {
        if (res.confirm) {
          this.goHome();
        }
      },
    });
  },
  goBack() {
    wx.showModal({
      title: i18n.t("tips"),
      content: i18n.t("modal_2"),
      confirmText: i18n.t("confirm"),
      cancelText: i18n.t("cancel"),
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack();
        } else if (res.cancel) {
          console.log("go back cancel");
        }
      },
    });
  },
  goHome() {
    wx.navigateBack({
      delta: 1,
    });
  },
  onShareAppMessage() {
    return shareAppMessage();
  },
});
