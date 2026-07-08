/* eslint-disable prefer-const */
/* eslint-disable prefer-destructuring */
/* eslint-disable max-len */
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-param-reassign */
/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
class FileSystemManager {
  constructor() {
    this.fs = wx.getFileSystemManager();
    this.basePath = `${wx.env.USER_DATA_PATH}/`;
  }
  //   创建文件夹
  mkdir(dirPath) {
    try {
      this.fs.accessSync(this.basePath + dirPath);
      console.log('mkdir ok', this.basePath + dirPath);
      return true;
    } catch (e) {
      try {
        this.fs.mkdirSync(this.basePath + dirPath, true);
        console.log('mkdir ok', this.basePath + dirPath);
        return true;
      } catch (e) {
        console.log('mkdir error', this.basePath + dirPath);
        return false;
      }
    }
  }
  //   保存文件
  saveFile(tempFilePath, filePath) {
    try {
      console.log('%c saveFile', 'font-size:50px', tempFilePath);
      const savedFilePath = this.fs.saveFileSync(
        tempFilePath,
        this.basePath + filePath,
      );
      return savedFilePath;
    } catch (e) {
      return false;
    }
  }
  //   检查本地文件是否存在
  findFile(filePath) {
    try {
      this.fs.statSync(this.basePath + filePath, false);
      return true;
    } catch (e) {
      console.log('not found file', filPath);
      return false;
    }
  }
  //   获取指定目录的文件列表
  getFileList(dirPath) {
    try {
      const fileList = this.fs.readdirSync(this.basePath + dirPath) || [];
      console.log('%c getFileList ok', 'font-size:50px', this.basePath + dirPath, fileList);
      return fileList.map(f => `${this.basePath}${dirPath}/${f}`);
    } catch (e) {
      console.log('%c getFileList error', 'font-size:50px', this.basePath + dirPath);
      return [];
    }
  }
}

export default new FileSystemManager();
