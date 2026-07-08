/* eslint-disable no-undef */
const localStorage = {
  get length() {
    const { keys } = wx.getStorageInfoSync();
    return keys.length;
  },

  key(n) {
    const { keys } = wx.getStorageInfoSync();

    return keys[n];
  },

  getItem(key) {
    const value = wx.getStorageSync(key);
    return value === '' ? null : value;
  },

  setItem(key, value) {
    return wx.setStorageSync(key, value);
  },

  removeItem(key) {
    return wx.removeStorageSync(key);
  },

  clear() {
    return wx.clearStorageSync();
  },
};

export default localStorage;
