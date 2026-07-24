const assert = require("assert");
const converter = require("../miniprogram/packages/tools/utils/unitConverter");

function close(actual, expected, epsilon = 1e-9) {
  assert(Math.abs(actual - expected) <= epsilon, `${actual} should be close to ${expected}`);
}

close(converter.convert("length", 1, "km", "m").result, 1000);
close(converter.convert("area", 1, "ha", "m2").result, 10000);
close(converter.convert("mass", 1, "lb", "kg").result, 0.45359237);
close(converter.convert("volume", 1, "gal", "l").result, 3.785411784);
close(converter.convert("time", 1, "day", "h").result, 24);
close(converter.convert("speed", 36, "kmh", "mps").result, 10);
close(converter.convert("data", 1, "mib", "kib").result, 1024);
close(converter.convert("temperature", 0, "c", "f").result, 32);
close(converter.convert("temperature", 32, "f", "c").result, 0);
close(converter.convert("temperature", 0, "k", "c").result, -273.15);

converter.CATEGORIES.forEach((category) => {
  const first = category.units[0];
  const last = category.units[category.units.length - 1];
  const forward = converter.convert(category.id, 12.345, first.id, last.id);
  const roundTrip = converter.convert(category.id, forward.result, last.id, first.id);
  close(roundTrip.result, 12.345, 1e-7);
});

assert.throws(() => converter.convert("length", -1, "m", "km"), /不能为负数/);
assert.doesNotThrow(() => converter.convert("temperature", -40, "c", "f"));
assert.throws(() => converter.convert("unknown", 1, "m", "km"), /不支持/);
assert.throws(() => converter.parseValue("12px"), /有效数值/);
assert.strictEqual(converter.formatNumber(1.2300000000), "1.23");
assert.strictEqual(converter.formatNumber(-0), "0");
assert.strictEqual(converter.formatNumber(0.00000000123), "1.23e-9");
assert.strictEqual(converter.formatNumber(1230000000000), "1.23e+12");
assert(converter.buildCopyText(converter.convert("length", 1, "m", "cm")).includes("100 厘米"));

console.log(`unit converter tests passed (${converter.CATEGORIES.length} categories)`);
