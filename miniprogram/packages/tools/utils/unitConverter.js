const CATEGORIES = [
  {
    id: "length",
    name: "长度",
    allowNegative: false,
    units: [
      ["mm", "毫米", 0.001],
      ["cm", "厘米", 0.01],
      ["m", "米", 1],
      ["km", "千米", 1000],
      ["in", "英寸", 0.0254],
      ["ft", "英尺", 0.3048],
      ["yd", "码", 0.9144],
      ["mi", "英里", 1609.344],
      ["nmi", "海里", 1852]
    ]
  },
  {
    id: "area",
    name: "面积",
    allowNegative: false,
    units: [
      ["cm2", "平方厘米", 0.0001],
      ["m2", "平方米", 1],
      ["km2", "平方千米", 1000000],
      ["ha", "公顷", 10000],
      ["in2", "平方英寸", 0.00064516],
      ["ft2", "平方英尺", 0.09290304],
      ["acre", "英亩", 4046.8564224]
    ]
  },
  {
    id: "mass",
    name: "重量",
    allowNegative: false,
    units: [
      ["mg", "毫克", 0.000001],
      ["g", "克", 0.001],
      ["kg", "千克", 1],
      ["t", "吨", 1000],
      ["oz", "盎司", 0.028349523125],
      ["lb", "磅", 0.45359237]
    ]
  },
  {
    id: "volume",
    name: "体积",
    allowNegative: false,
    note: "杯、品脱、加仑采用美制",
    units: [
      ["ml", "毫升", 0.001],
      ["l", "升", 1],
      ["m3", "立方米", 1000],
      ["tsp", "茶匙（美制）", 0.00492892159375],
      ["tbsp", "汤匙（美制）", 0.01478676478125],
      ["floz", "液体盎司（美制）", 0.0295735295625],
      ["cup", "杯（美制）", 0.2365882365],
      ["pt", "品脱（美制）", 0.473176473],
      ["gal", "加仑（美制）", 3.785411784]
    ]
  },
  {
    id: "temperature",
    name: "温度",
    allowNegative: true,
    units: [
      ["c", "摄氏度", null],
      ["f", "华氏度", null],
      ["k", "开尔文", null]
    ]
  },
  {
    id: "time",
    name: "时间",
    allowNegative: false,
    units: [
      ["ms", "毫秒", 0.001],
      ["s", "秒", 1],
      ["min", "分钟", 60],
      ["h", "小时", 3600],
      ["day", "天", 86400],
      ["week", "周", 604800]
    ]
  },
  {
    id: "speed",
    name: "速度",
    allowNegative: false,
    units: [
      ["mps", "米/秒", 1],
      ["kmh", "千米/时", 0.2777777777777778],
      ["mph", "英里/时", 0.44704],
      ["knot", "节", 0.5144444444444445]
    ]
  },
  {
    id: "data",
    name: "数据容量",
    allowNegative: false,
    note: "KB 为 1000 字节，KiB 为 1024 字节",
    units: [
      ["b", "字节 B", 1],
      ["kb", "千字节 KB", 1000],
      ["mb", "兆字节 MB", 1000000],
      ["gb", "吉字节 GB", 1000000000],
      ["tb", "太字节 TB", 1000000000000],
      ["kib", "千二进制字节 KiB", 1024],
      ["mib", "兆二进制字节 MiB", 1048576],
      ["gib", "吉二进制字节 GiB", 1073741824],
      ["tib", "太二进制字节 TiB", 1099511627776]
    ]
  }
].map((category) => ({
  ...category,
  units: category.units.map(([id, name, factor]) => ({ id, name, factor }))
}));

function getCategory(categoryId) {
  const category = CATEGORIES.find((item) => item.id === categoryId);
  if (!category) throw new Error("不支持的换算类别");
  return category;
}

function getUnit(category, unitId) {
  const unit = category.units.find((item) => item.id === unitId);
  if (!unit) throw new Error("不支持的单位");
  return unit;
}

function parseValue(value) {
  const text = String(value == null ? "" : value).trim();
  if (!text) throw new Error("请输入数值");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) {
    throw new Error("请输入有效数值");
  }
  const number = Number(text);
  if (!Number.isFinite(number)) throw new Error("数值超出可计算范围");
  return number;
}

function temperatureToKelvin(value, unitId) {
  if (unitId === "c") return value + 273.15;
  if (unitId === "f") return (value - 32) * 5 / 9 + 273.15;
  return value;
}

function kelvinToTemperature(value, unitId) {
  if (unitId === "c") return value - 273.15;
  if (unitId === "f") return (value - 273.15) * 9 / 5 + 32;
  return value;
}

function convert(categoryId, rawValue, fromUnitId, toUnitId) {
  const category = getCategory(categoryId);
  const value = parseValue(rawValue);
  if (!category.allowNegative && value < 0) throw new Error(`${category.name}不能为负数`);
  const fromUnit = getUnit(category, fromUnitId);
  const toUnit = getUnit(category, toUnitId);
  let result;
  if (category.id === "temperature") {
    result = kelvinToTemperature(temperatureToKelvin(value, fromUnit.id), toUnit.id);
    if (result < 0 && toUnit.id === "k" && Math.abs(result) < 1e-10) result = 0;
  } else {
    result = value * fromUnit.factor / toUnit.factor;
  }
  if (!Number.isFinite(result)) throw new Error("换算结果超出可显示范围");
  return { category, fromUnit, result, toUnit, value };
}

function trimExponential(value) {
  const [coefficient, exponent] = value.toExponential(8).split("e");
  return `${coefficient.replace(/\.?0+$/, "")}e${Number(exponent) >= 0 ? "+" : ""}${Number(exponent)}`;
}

function formatNumber(value) {
  if (Object.is(value, -0) || Math.abs(value) < 1e-14) return "0";
  const absolute = Math.abs(value);
  if (absolute >= 1e12 || absolute < 1e-8) return trimExponential(value);
  return String(Number(value.toPrecision(12)));
}

function buildCopyText(conversion) {
  return `${formatNumber(conversion.value)} ${conversion.fromUnit.name} = ${formatNumber(conversion.result)} ${conversion.toUnit.name}`;
}

module.exports = {
  CATEGORIES,
  buildCopyText,
  convert,
  formatNumber,
  getCategory,
  parseValue
};
