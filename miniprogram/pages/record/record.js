const {
  buildScores,
  buildSelectedTags,
  getCategories,
  getCategoryScores,
  getOverallScore,
  getRecordTitle,
  getTypeConfig,
  getVerdict
} = require("../../utils/hotelScore");
const {
  deleteRecord,
  duplicateRecord,
  getRecordById,
  getRecords
} = require("../../utils/repositories/recordRepository");
const {
  MAX_PHOTOS,
  chooseAndSavePhotos,
  getPhotoCategories,
  removeSavedPhotos,
  withAvailability
} = require("../../utils/repositories/mediaRepository");
const {
  ensurePlacesForRecords,
  findPlaceSuggestions,
  getPlaceById
} = require("../../utils/repositories/placeRepository");
const { getWishlistItem } = require("../../utils/repositories/wishlistRepository");
const departureRepository = require("../../utils/repositories/departureRepository");
const { applyTemplate, buildRecentSuggestions, getTemplates, saveTemplate } = require("../../utils/repositories/formTemplateRepository");
const { saveExperienceRecord } = require("../../utils/experienceWorkflowService");
const demoMode = require("../../utils/demoMode");

function buildInitialForm(recordType = "hotel") {
  const scores = buildScores(recordType);
  const overallScore = getOverallScore(scores, recordType);
  return {
    recordType,
    hotelName: "",
    restaurantName: "",
    placeId: "",
    placeName: "",
    placeAlias: "",
    area: "",
    address: "",
    latitude: null,
    longitude: null,
    cloudRecordId: "",
    publicReviewId: "",
    bookingId: "",
    wishlistId: "",
    tripId: "",
    itineraryItemId: "",
    city: "",
    stayDate: "",
    visitMonth: "",
    roomType: "",
    memberLevel: "",
    cuisine: "",
    michelinLevel: "",
    mealPeriod: "",
    priceRange: "",
    note: "",
    privateNote: "",
    publicNote: "",
    visibility: "private",
    publishStatus: "local",
    scores,
    selectedTags: buildSelectedTags(recordType),
    customTags: [],
    photos: [],
    coverPhotoId: "",
    status: "draft",
    categoryScores: getCategoryScores(scores, recordType),
    overallScore,
    isRated: false,
    ratingTouched: false,
    verdict: "尚未评分"
  };
}

function buildScoreBars(form) {
  return getCategories(form.recordType).map((category) => {
    const score = form.categoryScores && form.categoryScores[category.key]
      ? form.categoryScores[category.key]
      : 0;
    return {
      key: category.key,
      title: category.title,
      accent: category.accent,
      score,
      percent: Math.max(0, Math.min(100, score * 10))
    };
  });
}

function buildPublicPreview(form) {
  const typeConfig = getTypeConfig(form.recordType);
  const tags = Object.keys(form.selectedTags || {}).reduce((items, key) => {
    return items.concat(form.selectedTags[key] || []);
  }, []).concat(form.customTags || []);
  return {
    title: form.placeName || getRecordTitle(form),
    typeLabel: typeConfig.label,
    visitMonth: form.visitMonth || (form.stayDate ? form.stayDate.slice(0, 7) : "未填写月份"),
    summary: form.publicNote || form.verdict || "暂无分享摘要",
    tags: tags.slice(0, 8).join("、") || "暂无标签"
  };
}

function getPageText(mode, recordType, form = {}, isQuick = false) {
  const typeConfig = getTypeConfig(recordType);
  if (isQuick) {
    return {
      eyebrow: `快速记录${typeConfig.label}`,
      title: recordType === "restaurant" ? "快速记录餐厅" : "快速记录酒店"
    };
  }
  if (mode === "edit") {
    return {
      eyebrow: `编辑${typeConfig.label}`,
      title: getRecordTitle(form)
    };
  }
  return {
    eyebrow: mode === "detail" ? `${typeConfig.label}详情` : `新增${typeConfig.label}`,
    title: mode === "detail"
      ? getRecordTitle(form)
      : (recordType === "restaurant" ? "新增米其林餐厅" : "新增酒店记录")
  };
}

Page({
  data: {
    mode: "create",
    recordId: "",
    recordType: "hotel",
    typeConfig: getTypeConfig("hotel"),
    categories: getCategories("hotel"),
    isReadonly: false,
    isQuick: false,
    hasUnsavedChanges: false,
    pageText: getPageText("create", "hotel", buildInitialForm()),
    form: buildInitialForm(),
    originalForm: null,
    customTagInput: "",
    scoreBars: buildScoreBars(buildInitialForm()),
    publicPreview: buildPublicPreview(buildInitialForm()),
    placeSuggestions: [],
    placeChoiceConfirmed: false,
    photoCategories: getPhotoCategories("hotel"),
    maxPhotos: MAX_PHOTOS,
    addingPhotos: false,
    sourceWishlistId: "",
    sourceBookingId: "",
    templates: [],
    recentSuggestions: null,
    demoActive: false,
    showPlaceDetails: false,
    showShareSection: false
  },

  pendingPhotoDeletes: [],
  newPhotoPaths: [],
  photosCommitted: false,

  onLoad(options) {
    const demoActive = !!(options && options.demo === "record" && demoMode.getState().active);
    this.setData({ templates: getTemplates(), demoActive });
    if (options && options.id) {
      this.loadDetail(options.id);
      return;
    }
    const recordType = options && options.type === "restaurant" ? "restaurant" : "hotel";
    this.setRecordType(recordType, options && options.quick === "1");
    if (options && options.placeId) this.applyPlace(options.placeId);
    if (options && options.wishlistId) this.applyWishlist(options.wishlistId);
    if (options && options.bookingId) this.applyBooking(options.bookingId);
  },

  setRecordType(recordType, isQuick = false) {
    const form = buildInitialForm(recordType);
    this.setData({
      recordType,
      typeConfig: getTypeConfig(recordType),
      categories: getCategories(recordType),
      isReadonly: false,
      isQuick,
      hasUnsavedChanges: false,
      pageText: getPageText("create", recordType, form, isQuick),
      form,
      originalForm: JSON.stringify(form),
      customTagInput: "",
      scoreBars: buildScoreBars(form),
      publicPreview: buildPublicPreview(form),
      placeSuggestions: [],
      placeChoiceConfirmed: false,
      photoCategories: getPhotoCategories(recordType),
      showPlaceDetails: false,
      showShareSection: false
    });
    this.disableLeaveAlert();
  },

  onTypeChange(event) {
    if (this.data.mode === "detail") return;
    this.cleanupUnsavedPhotos();
    this.photosCommitted = false;
    this.setRecordType(event.currentTarget.dataset.type, this.data.isQuick);
  },

  loadDetail(id) {
    ensurePlacesForRecords();
    const record = getRecordById(id);
    if (!record) {
      wx.showToast({
        title: "记录不存在",
        icon: "none"
      });
      setTimeout(() => wx.navigateBack(), 600);
      return;
    }
    if (this.data.demoActive) demoMode.markStep("record");

    const form = {
      ...record,
      photos: withAvailability(record.photos, record.recordType),
      categoryScores: getCategoryScores(record.scores, record.recordType)
    };
    this.setData({
      mode: "detail",
      recordId: record.id,
      recordType: record.recordType,
      typeConfig: getTypeConfig(record.recordType),
      categories: getCategories(record.recordType),
      isReadonly: true,
      isQuick: false,
      hasUnsavedChanges: false,
      pageText: getPageText("detail", record.recordType, form),
      form,
      originalForm: JSON.stringify(form),
      customTagInput: "",
      scoreBars: buildScoreBars(form),
      publicPreview: buildPublicPreview(form),
      showPlaceDetails: !!(form.area || form.address || form.placeAlias),
      showShareSection: !!form.publicNote
    });
    this.pendingPhotoDeletes = [];
    this.newPhotoPaths = [];
    this.photosCommitted = true;
    this.disableLeaveAlert();
  },

  enterEdit() {
    const originalForm = JSON.stringify(this.data.form);
    this.setData({
      mode: "edit",
      isReadonly: false,
      isQuick: false,
      hasUnsavedChanges: false,
      pageText: getPageText("edit", this.data.recordType, this.data.form),
      originalForm
    });
    this.disableLeaveAlert();
    this.pendingPhotoDeletes = [];
    this.newPhotoPaths = [];
    this.photosCommitted = false;
  },

  cancelEdit() {
    if (this.data.hasUnsavedChanges) {
      wx.showModal({
        title: "放弃修改",
        content: "当前修改尚未保存，确定放弃吗？",
        confirmText: "放弃",
        success: (res) => {
          if (res.confirm) this.restoreOriginalForm();
        }
      });
      return;
    }
    this.restoreOriginalForm();
  },

  restoreOriginalForm() {
    this.cleanupUnsavedPhotos();
    const form = this.data.originalForm ? JSON.parse(this.data.originalForm) : this.data.form;
    this.setData({
      mode: "detail",
      isReadonly: true,
      hasUnsavedChanges: false,
      pageText: getPageText("detail", this.data.recordType, form),
      form,
      scoreBars: buildScoreBars(form),
      publicPreview: buildPublicPreview(form)
    });
    this.disableLeaveAlert();
  },

  markDirty() {
    const changed = JSON.stringify(this.data.form) !== this.data.originalForm;
    this.setData({ hasUnsavedChanges: changed });
    if (changed) {
      this.enableLeaveAlert();
    } else {
      this.disableLeaveAlert();
    }
  },

  enableLeaveAlert() {
    if (!wx.enableAlertBeforeUnload) return;
    wx.enableAlertBeforeUnload({
      message: "当前修改尚未保存，确定离开吗？"
    });
  },

  disableLeaveAlert() {
    if (!wx.disableAlertBeforeUnload) return;
    wx.disableAlertBeforeUnload();
  },

  onFieldInput(event) {
    if (this.data.isReadonly) return;
    const { field } = event.currentTarget.dataset;
    const updates = {
      [`form.${field}`]: event.detail.value
    };
    if (field === "note") {
      updates["form.privateNote"] = event.detail.value;
    }
    this.setData(updates, () => {
      this.setData({ publicPreview: buildPublicPreview(this.data.form) });
      if (["hotelName", "restaurantName", "placeName", "city"].indexOf(field) >= 0) {
        this.refreshPlaceSuggestions();
      }
      if (["hotelName", "restaurantName"].indexOf(field) >= 0) this.refreshRecentSuggestions();
      this.markDirty();
    });
  },

  getPlaceInput() {
    const form = this.data.form;
    return {
      type: form.recordType,
      name: form.placeName || getRecordTitle(form),
      city: form.city,
      area: form.area,
      address: form.address,
      latitude: form.latitude,
      longitude: form.longitude,
      aliases: form.placeAlias ? [form.placeAlias] : []
    };
  },

  refreshPlaceSuggestions() {
    if (this.data.isReadonly || this.data.placeChoiceConfirmed) return;
    const suggestions = findPlaceSuggestions(this.getPlaceInput())
      .filter((place) => String(place.id) !== String(this.data.form.placeId || ""))
      .slice(0, 4);
    this.setData({ placeSuggestions: suggestions });
  },

  applyPlace(placeId) {
    const place = getPlaceById(placeId);
    if (!place) return;
    const nameField = place.type === "restaurant" ? "restaurantName" : "hotelName";
    this.setData({
      recordType: place.type,
      typeConfig: getTypeConfig(place.type),
      categories: getCategories(place.type),
      [`form.${nameField}`]: place.name,
      "form.recordType": place.type,
      "form.placeId": place.id,
      "form.placeName": place.name,
      "form.placeAlias": (place.aliases || []).join("、"),
      "form.city": place.city,
      "form.area": place.area,
      "form.address": place.address,
      "form.latitude": place.latitude,
      "form.longitude": place.longitude,
      placeSuggestions: [],
      placeChoiceConfirmed: true
    }, () => {
      this.setData({ publicPreview: buildPublicPreview(this.data.form) });
      this.markDirty();
    });
  },

  applyWishlist(wishlistId) {
    const item = getWishlistItem(wishlistId);
    if (!item) return;
    const nameField = item.type === "restaurant" ? "restaurantName" : "hotelName";
    const updates = {
      sourceWishlistId: item.id,
      recordType: item.type,
      typeConfig: getTypeConfig(item.type),
      categories: getCategories(item.type),
      [`form.${nameField}`]: item.name,
      "form.recordType": item.type,
      "form.wishlistId": item.id,
      "form.tripId": item.tripId || "",
      "form.itineraryItemId": item.itineraryItemId || "",
      "form.placeName": item.name,
      "form.city": item.city,
      "form.area": item.area,
      "form.address": item.address,
      "form.latitude": item.latitude,
      "form.longitude": item.longitude,
      "form.stayDate": item.targetDate || "",
      "form.visitMonth": item.targetDate ? item.targetDate.slice(0, 7) : "",
      "form.note": item.note || "",
      "form.privateNote": item.note || ""
    };
    if (item.placeId) {
      updates["form.placeId"] = item.placeId;
      updates.placeChoiceConfirmed = true;
    }
    this.setData(updates, () => {
      this.setData({ pageText: getPageText("create", item.type, this.data.form), publicPreview: buildPublicPreview(this.data.form) });
      if (!item.placeId) this.refreshPlaceSuggestions();
      this.markDirty();
    });
  },

  applyBooking(bookingId) {
    const booking = departureRepository.getBookingById(bookingId);
    if (!booking || ["hotel", "restaurant"].indexOf(booking.type) < 0) return;
    const nameField = booking.type === "restaurant" ? "restaurantName" : "hotelName";
    const updates = {
      sourceBookingId: booking.id,
      sourceWishlistId: booking.wishlistId || "",
      recordType: booking.type,
      typeConfig: getTypeConfig(booking.type),
      categories: getCategories(booking.type),
      [`form.${nameField}`]: booking.name,
      "form.recordType": booking.type,
      "form.bookingId": booking.id,
      "form.wishlistId": booking.wishlistId || "",
      "form.tripId": booking.tripId || "",
      "form.itineraryItemId": booking.itineraryItemId || "",
      "form.placeId": booking.placeId || "",
      "form.placeName": booking.name,
      "form.city": booking.city,
      "form.address": booking.address,
      "form.stayDate": booking.startDate,
      "form.visitMonth": booking.startDate ? booking.startDate.slice(0, 7) : "",
      "form.note": booking.note || "",
      "form.privateNote": booking.note || ""
    };
    if (booking.placeId) updates.placeChoiceConfirmed = true;
    this.setData(updates, () => {
      this.setData({ pageText: getPageText("create", booking.type, this.data.form), publicPreview: buildPublicPreview(this.data.form) });
      if (!booking.placeId) this.refreshPlaceSuggestions();
      this.markDirty();
    });
  },

  applyFormTemplate(event) {
    if (this.data.isReadonly) return;
    const template = this.data.templates.find((item) => item.id === event.currentTarget.dataset.id);
    if (!template || template.type !== this.data.recordType) return;
    const form = applyTemplate(this.data.form, template);
    this.setData({ form, publicPreview: buildPublicPreview(form) }, () => this.markDirty());
  },

  saveCurrentTemplate() {
    if (this.data.isReadonly) return;
    wx.showModal({ title: "保存录入模板", editable: true, placeholderText: "模板名称", success: (result) => { if (!result.confirm) return; try { saveTemplate(result.content, this.data.form); this.setData({ templates: getTemplates() }); wx.showToast({ title: "模板已保存", icon: "success" }); } catch (error) { wx.showToast({ title: error.message, icon: "none" }); } } });
  },

  refreshRecentSuggestions() {
    const suggestions = buildRecentSuggestions(getRecords(), this.data.form);
    this.setData({ recentSuggestions: suggestions.city || suggestions.roomType || suggestions.memberLevel || suggestions.cuisine || suggestions.tags.length ? suggestions : null });
  },

  useRecentSuggestion(event) {
    if (this.data.isReadonly) return;
    const field = event.currentTarget.dataset.field;
    const value = event.currentTarget.dataset.value;
    if (field && !this.data.form[field]) this.setData({ [`form.${field}`]: value }, () => this.markDirty());
  },

  selectPlaceSuggestion(event) {
    this.applyPlace(event.currentTarget.dataset.id);
  },

  createAsNewPlace() {
    this.setData({
      "form.placeId": "",
      placeSuggestions: [],
      placeChoiceConfirmed: true
    }, () => this.markDirty());
  },

  resetPlaceChoice() {
    this.setData({ placeChoiceConfirmed: false }, () => this.refreshPlaceSuggestions());
  },

  chooseLocation() {
    if (this.data.isReadonly || !wx.chooseLocation) return;
    wx.chooseLocation({
      success: (location) => {
        const currentTitle = getRecordTitle(this.data.form);
        const updates = {
          "form.address": location.address || "",
          "form.latitude": location.latitude,
          "form.longitude": location.longitude,
          placeChoiceConfirmed: false
        };
        if ((!currentTitle || currentTitle.indexOf("未命名") === 0) && location.name) {
          const field = this.data.recordType === "restaurant" ? "restaurantName" : "hotelName";
          updates[`form.${field}`] = location.name;
          updates["form.placeName"] = location.name;
        }
        this.setData(updates, () => {
          this.refreshPlaceSuggestions();
          this.markDirty();
        });
      },
      fail: (error) => {
        if (String(error && error.errMsg).indexOf("cancel") < 0) {
          wx.showToast({ title: "可继续手工填写地点", icon: "none" });
        }
      }
    });
  },

  onDateChange(event) {
    if (this.data.isReadonly) return;
    this.setData({
      "form.stayDate": event.detail.value,
      "form.visitMonth": event.detail.value ? event.detail.value.slice(0, 7) : ""
    }, () => {
      this.setData({ publicPreview: buildPublicPreview(this.data.form) });
      this.markDirty();
    });
  },

  onScoreChange(event) {
    if (this.data.isReadonly) return;
    const { category, metric } = event.currentTarget.dataset;
    const recordType = this.data.form.recordType;
    const scores = this.data.form.scores;
    scores[category][metric] = Number(event.detail.value);
    const overallScore = getOverallScore(scores, recordType);
    this.setData({
      "form.scores": scores,
      "form.categoryScores": getCategoryScores(scores, recordType),
      "form.overallScore": overallScore,
      "form.ratingTouched": true,
      "form.isRated": true,
      "form.verdict": getVerdict(overallScore, recordType),
      "scoreBars": buildScoreBars({
        ...this.data.form,
        scores,
        categoryScores: getCategoryScores(scores, recordType),
        overallScore
      })
    }, () => {
      this.setData({ publicPreview: buildPublicPreview(this.data.form) });
      this.markDirty();
    });
  },

  onToggleTag(event) {
    if (this.data.isReadonly) return;
    const { category, tag } = event.currentTarget.dataset;
    const selectedTags = this.data.form.selectedTags;
    const current = selectedTags[category] || [];
    selectedTags[category] = current.includes(tag)
      ? current.filter((item) => item !== tag)
      : current.concat(tag);
    this.setData({
      "form.selectedTags": selectedTags
    }, () => {
      this.setData({ publicPreview: buildPublicPreview(this.data.form) });
      this.markDirty();
    });
  },

  togglePlaceDetails() {
    this.setData({ showPlaceDetails: !this.data.showPlaceDetails });
  },

  toggleShareSection() {
    this.setData({ showShareSection: !this.data.showShareSection });
  },

  expandQuickRecord() {
    this.setData({
      isQuick: false,
      pageText: getPageText(this.data.mode, this.data.recordType, this.data.form, false)
    });
  },

  onCustomTagInput(event) {
    if (this.data.isReadonly) return;
    this.setData({ customTagInput: event.detail.value });
  },

  addPhotos() {
    if (this.data.isReadonly || this.data.addingPhotos) return;
    this.setData({ addingPhotos: true });
    return chooseAndSavePhotos(this.data.recordType, (this.data.form.photos || []).length).then((photos) => {
      this.newPhotoPaths = this.newPhotoPaths.concat(photos.map((photo) => photo.filePath));
      const nextPhotos = (this.data.form.photos || []).concat(photos.map((photo) => ({ ...photo, available: true })));
      const updates = { "form.photos": nextPhotos, addingPhotos: false };
      if (!this.data.form.coverPhotoId && nextPhotos[0]) updates["form.coverPhotoId"] = nextPhotos[0].id;
      this.setData(updates, () => this.markDirty());
    }).catch((error) => {
      this.setData({ addingPhotos: false });
      if (String(error && error.errMsg).indexOf("cancel") < 0) wx.showToast({ title: error.message || "照片保存失败", icon: "none" });
    });
  },

  previewPhoto(event) {
    const photo = (this.data.form.photos || []).find((item) => item.id === event.currentTarget.dataset.id);
    const available = (this.data.form.photos || []).filter((item) => item.available !== false);
    if (!photo || photo.available === false || !wx.previewImage) {
      wx.showToast({ title: "照片文件已失效", icon: "none" });
      return;
    }
    wx.previewImage({ current: photo.filePath, urls: available.map((item) => item.filePath) });
  },

  setCoverPhoto(event) {
    if (this.data.isReadonly) return;
    this.setData({ "form.coverPhotoId": event.currentTarget.dataset.id }, () => this.markDirty());
  },

  removePhoto(event) {
    if (this.data.isReadonly) return;
    const id = event.currentTarget.dataset.id;
    const photo = (this.data.form.photos || []).find((item) => item.id === id);
    if (!photo) return;
    if (this.newPhotoPaths.indexOf(photo.filePath) >= 0) {
      removeSavedPhotos([photo.filePath]);
      this.newPhotoPaths = this.newPhotoPaths.filter((path) => path !== photo.filePath);
    } else {
      this.pendingPhotoDeletes.push(photo.filePath);
    }
    const photos = this.data.form.photos.filter((item) => item.id !== id);
    const coverPhotoId = this.data.form.coverPhotoId === id ? (photos[0] ? photos[0].id : "") : this.data.form.coverPhotoId;
    this.setData({ "form.photos": photos, "form.coverPhotoId": coverPhotoId }, () => this.markDirty());
  },

  movePhoto(event) {
    if (this.data.isReadonly) return;
    const id = event.currentTarget.dataset.id;
    const direction = Number(event.currentTarget.dataset.direction);
    const photos = (this.data.form.photos || []).slice();
    const index = photos.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= photos.length) return;
    const swap = photos[index];
    photos[index] = photos[target];
    photos[target] = swap;
    this.setData({ "form.photos": photos }, () => this.markDirty());
  },

  onPhotoCategoryChange(event) {
    if (this.data.isReadonly) return;
    const id = event.currentTarget.dataset.id;
    const category = this.data.photoCategories[Number(event.detail.value)] || this.data.photoCategories[0];
    const photos = this.data.form.photos.map((item) => item.id === id ? { ...item, category } : item);
    this.setData({ "form.photos": photos }, () => this.markDirty());
  },

  onPhotoCaptionInput(event) {
    if (this.data.isReadonly) return;
    const id = event.currentTarget.dataset.id;
    const photos = this.data.form.photos.map((item) => item.id === id ? { ...item, caption: event.detail.value } : item);
    this.setData({ "form.photos": photos }, () => this.markDirty());
  },

  cleanupUnsavedPhotos() {
    if (this.photosCommitted) return;
    removeSavedPhotos(this.newPhotoPaths);
    this.newPhotoPaths = [];
    this.pendingPhotoDeletes = [];
  },

  commitPhotoChanges() {
    removeSavedPhotos(this.pendingPhotoDeletes);
    this.pendingPhotoDeletes = [];
    this.newPhotoPaths = [];
    this.photosCommitted = true;
  },

  addCustomTag() {
    if (this.data.isReadonly) return;
    const tag = String(this.data.customTagInput || "").trim();
    if (!tag) {
      wx.showToast({
        title: "先输入标签",
        icon: "none"
      });
      return;
    }
    const customTags = this.data.form.customTags || [];
    if (customTags.indexOf(tag) >= 0) {
      this.setData({ customTagInput: "" });
      return;
    }
    this.setData({
      "form.customTags": customTags.concat(tag),
      customTagInput: ""
    }, () => {
      this.setData({ publicPreview: buildPublicPreview(this.data.form) });
      this.markDirty();
    });
  },

  removeCustomTag(event) {
    if (this.data.isReadonly) return;
    const tag = event.currentTarget.dataset.tag;
    const customTags = (this.data.form.customTags || []).filter((item) => item !== tag);
    this.setData({
      "form.customTags": customTags
    }, () => {
      this.setData({ publicPreview: buildPublicPreview(this.data.form) });
      this.markDirty();
    });
  },

  saveRecord(event) {
    if (this.data.mode === "detail") return;
    const targetStatus = event && event.currentTarget && event.currentTarget.dataset.status;
    if (this.data.isQuick && targetStatus === "completed") {
      this.expandQuickRecord();
      wx.showToast({ title: "先完成评分再保存", icon: "none" });
      return;
    }
    const title = getRecordTitle(this.data.form);
    if (!title || title.indexOf("未命名") === 0) {
      wx.showToast({
        title: this.data.recordType === "restaurant" ? "先填写餐厅名" : "先填写酒店名",
        icon: "none"
      });
      return;
    }
    if (this.data.placeSuggestions.length && !this.data.placeChoiceConfirmed) {
      wx.showToast({ title: "先确认是否关联已有地点", icon: "none" });
      return;
    }
    const nextStatus = targetStatus || this.data.form.status || "draft";
    const nextForm = {
      ...this.data.form,
      placeName: this.data.form.placeName || title,
      privateNote: this.data.form.note,
      visitMonth: this.data.form.visitMonth || (this.data.form.stayDate ? this.data.form.stayDate.slice(0, 7) : ""),
      status: nextStatus,
      isRated: nextStatus !== "draft" && !!this.data.form.ratingTouched
    };

    let savedRecord;
    try {
      savedRecord = saveExperienceRecord({
        mode: this.data.mode,
        recordId: this.data.recordId,
        recordInput: nextForm,
        placeInput: this.getPlaceInput()
      });
    } catch (error) {
      wx.showToast({ title: error.message || "记录保存失败", icon: "none" });
      return;
    }

    if (this.data.mode === "edit") {
      const form = {
        ...savedRecord,
        photos: withAvailability(savedRecord.photos, savedRecord.recordType),
        categoryScores: getCategoryScores(savedRecord.scores, savedRecord.recordType)
      };
      this.commitPhotoChanges();
      this.setData({
        mode: "detail",
        isReadonly: true,
        hasUnsavedChanges: false,
        form,
        pageText: getPageText("detail", savedRecord.recordType, form),
        originalForm: JSON.stringify(form),
        scoreBars: buildScoreBars(form),
        publicPreview: buildPublicPreview(form)
      });
      this.disableLeaveAlert();
      wx.showToast({
        title: nextForm.status === "draft" ? "草稿已更新" : "已更新",
        icon: "success"
      });
      return;
    }
    this.commitPhotoChanges();
    this.disableLeaveAlert();
    wx.showToast({
      title: nextForm.status === "draft" ? "草稿已保存" : "已保存",
      icon: "success"
    });
    setTimeout(() => wx.navigateBack(), 450);
  },

  copyRecord() {
    const record = duplicateRecord(this.data.recordId);
    if (!record) {
      wx.showToast({
        title: "复制失败",
        icon: "none"
      });
      return;
    }
    wx.showToast({
      title: "已复制",
      icon: "success"
    });
    this.loadDetail(record.id);
  },

  deleteRecord() {
    const photoPaths = (this.data.form.photos || []).map((photo) => photo.filePath);
    wx.showModal({
      title: "删除记录",
      content: "删除后无法恢复，确认删除这条记录吗？",
      confirmText: "删除",
      confirmColor: "#a34b32",
      success: (res) => {
        if (!res.confirm) return;
        deleteRecord(this.data.recordId);
        const referenced = getRecords().reduce((paths, record) => paths.concat((record.photos || []).map((photo) => photo.filePath)), []);
        removeSavedPhotos(photoPaths.filter((path) => referenced.indexOf(path) < 0));
        wx.showToast({
          title: "已删除",
          icon: "none"
        });
        setTimeout(() => wx.navigateBack(), 450);
      }
    });
  },

  goPlaceDetail() {
    if (!this.data.form.placeId) return;
    wx.navigateTo({ url: `/pages/place/detail?id=${this.data.form.placeId}` });
  },

  goStory() {
    wx.navigateTo({ url: `/packages/tools/story/index?id=${this.data.recordId}` });
  },

  onUnload() {
    this.disableLeaveAlert();
    this.cleanupUnsavedPhotos();
  }
});
