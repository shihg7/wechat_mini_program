const adapter = require("./localAdapters/ledgerLocalAdapter");

function getBackupSnapshot() { return adapter.getLedgers(); }

module.exports = { ...adapter, getBackupSnapshot };
