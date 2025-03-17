const icongen = require('electron-icon-maker');

icongen({
  input: './resource/icon.png',  // 源图像路径
  output: './build',               // 输出目录
  flatten: true,                   // 是否将所有图标放在同一目录下
  icons: {
    ico: true,                     // Windows图标
    icns: true,                    // macOS图标
    favicon: false,                // 网页图标
  }
})
.then(() => {
  console.log('图标生成成功！');
})
.catch(err => {
  console.error('图标生成失败:', err);
});