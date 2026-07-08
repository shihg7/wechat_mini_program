const TYPE_CONFIG = {
  hotel: {
    key: "hotel",
    label: "酒店",
    pluralLabel: "酒店记录",
    titleField: "hotelName",
    titlePlaceholder: "例如：上海外滩某某酒店",
    dateLabel: "入住日期",
    primaryFieldLabel: "酒店名称",
    detailFields: [
      { key: "roomType", label: "房型", placeholder: "基础房/套房" },
      { key: "memberLevel", label: "会员等级", placeholder: "金卡/钻卡" }
    ],
    categories: [
      {
        key: "lounge",
        title: "行政酒廊",
        subtitle: "出品、景观、服务与晚间欢乐时光",
        accent: "#2864d9",
        tags: ["安静", "景观好", "热食丰富", "酒水在线", "服务主动"],
        metrics: [
          { key: "food", label: "餐食品质" },
          { key: "drink", label: "酒水选择" },
          { key: "space", label: "空间氛围" },
          { key: "service", label: "服务响应" }
        ]
      },
      {
        key: "breakfast",
        title: "早餐",
        subtitle: "品类、口味、动线与高峰体验",
        accent: "#c47a1c",
        tags: ["本地特色", "咖啡好喝", "现做档", "水果新鲜", "补餐快"],
        metrics: [
          { key: "variety", label: "品类丰富" },
          { key: "taste", label: "口味表现" },
          { key: "fresh", label: "新鲜程度" },
          { key: "flow", label: "取餐动线" }
        ]
      },
      {
        key: "pool",
        title: "泳池",
        subtitle: "水质、景观、配套与亲子友好度",
        accent: "#158f8f",
        tags: ["水质清澈", "恒温", "景观开阔", "躺椅充足", "更衣室好"],
        metrics: [
          { key: "water", label: "水质维护" },
          { key: "view", label: "景观体验" },
          { key: "facility", label: "配套设施" },
          { key: "comfort", label: "舒适程度" }
        ]
      }
    ]
  },
  restaurant: {
    key: "restaurant",
    label: "米其林餐厅",
    pluralLabel: "餐厅记录",
    titleField: "restaurantName",
    titlePlaceholder: "例如：某某轩 / Restaurant Name",
    dateLabel: "用餐日期",
    primaryFieldLabel: "餐厅名称",
    detailFields: [
      { key: "cuisine", label: "菜系", placeholder: "粤菜/法餐/日料" },
      { key: "michelinLevel", label: "米其林等级", placeholder: "一星/二星/三星/入选" },
      { key: "mealPeriod", label: "餐段", placeholder: "午餐/晚餐" },
      { key: "priceRange", label: "人均/套餐", placeholder: "¥800/人" }
    ],
    categories: [
      {
        key: "food",
        title: "菜品",
        subtitle: "出品稳定度、风味表达与记忆点",
        accent: "#a34b32",
        tags: ["招牌突出", "火候精准", "摆盘精致", "本地风味", "创意表达"],
        metrics: [
          { key: "taste", label: "味道" },
          { key: "technique", label: "技法" },
          { key: "presentation", label: "呈现" },
          { key: "signature", label: "记忆点" }
        ]
      },
      {
        key: "service",
        title: "服务",
        subtitle: "节奏、讲解、细节照顾与专业度",
        accent: "#2864d9",
        tags: ["节奏舒服", "讲解清楚", "换盘及时", "纪念日友好", "不过度打扰"],
        metrics: [
          { key: "pace", label: "上菜节奏" },
          { key: "knowledge", label: "专业讲解" },
          { key: "attention", label: "细节照顾" },
          { key: "warmth", label: "亲和度" }
        ]
      },
      {
        key: "beverage",
        title: "酒水/饮品",
        subtitle: "酒单、配餐、无酒精选择与茶水咖啡",
        accent: "#7a5cbe",
        tags: ["酒单完整", "配餐优秀", "无酒精友好", "茶饮出色", "价格合理"],
        metrics: [
          { key: "wineList", label: "酒单" },
          { key: "pairing", label: "配餐" },
          { key: "nonAlcohol", label: "无酒精" },
          { key: "value", label: "性价比" }
        ]
      },
      {
        key: "ambience",
        title: "环境",
        subtitle: "空间、私密度、声学、餐具与整体氛围",
        accent: "#158f8f",
        tags: ["座距舒适", "适合约会", "景观好", "餐具讲究", "声学舒服"],
        metrics: [
          { key: "space", label: "空间" },
          { key: "comfort", label: "舒适度" },
          { key: "design", label: "设计" },
          { key: "occasion", label: "场景适配" }
        ]
      }
    ]
  }
};

const CATEGORY_CONFIG = TYPE_CONFIG.hotel.categories;

function getTypeConfig(recordType = "hotel") {
  return TYPE_CONFIG[recordType] || TYPE_CONFIG.hotel;
}

function getCategories(recordType = "hotel") {
  return getTypeConfig(recordType).categories;
}

function roundScore(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function buildScores(recordType = "hotel", defaultValue = 8) {
  return getCategories(recordType).reduce((scores, category) => {
    scores[category.key] = category.metrics.reduce((items, metric) => {
      items[metric.key] = defaultValue;
      return items;
    }, {});
    return scores;
  }, {});
}

function buildSelectedTags(recordType = "hotel") {
  return getCategories(recordType).reduce((tags, category) => {
    tags[category.key] = [];
    return tags;
  }, {});
}

function getCategoryScore(category, scores) {
  const categoryScores = scores[category.key] || {};
  const values = category.metrics.map((metric) => Number(categoryScores[metric.key] || 0));
  const total = values.reduce((sum, value) => sum + value, 0);
  return roundScore(total / values.length);
}

function getCategoryScores(scores, recordType = "hotel") {
  return getCategories(recordType).reduce((result, category) => {
    result[category.key] = getCategoryScore(category, scores);
    return result;
  }, {});
}

function getOverallScore(scores, recordType = "hotel") {
  const categories = getCategories(recordType);
  const total = categories.reduce((sum, category) => sum + getCategoryScore(category, scores), 0);
  return roundScore(total / categories.length);
}

function getVerdict(score, recordType = "hotel") {
  if (recordType === "restaurant") {
    if (score >= 9) return "值得专程预订";
    if (score >= 8) return "表现优秀";
    if (score >= 7) return "稳定可约";
    if (score >= 6) return "亮点与短板并存";
    return "谨慎选择";
  }
  if (score >= 9) return "值得专程体验";
  if (score >= 8) return "表现优秀";
  if (score >= 7) return "稳定可选";
  if (score >= 6) return "有亮点也有短板";
  return "谨慎选择";
}

function getRecordTitle(record) {
  if (!record) return "";
  return record.recordType === "restaurant"
    ? record.restaurantName || record.hotelName || "未命名餐厅"
    : record.hotelName || record.restaurantName || "未命名酒店";
}

module.exports = {
  CATEGORY_CONFIG,
  TYPE_CONFIG,
  buildScores,
  buildSelectedTags,
  getCategories,
  getCategoryScore,
  getCategoryScores,
  getOverallScore,
  getRecordTitle,
  getTypeConfig,
  getVerdict,
  roundScore
};
