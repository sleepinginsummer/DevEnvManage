import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
const { exec } = require('child_process')
import { promisify } from 'util'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

const execAsync = promisify(exec)

async function runPowerShellCommand(command) {
  try {
    const { stdout, stderr } = await execAsync(`powershell -WindowStyle Hidden -Command "${command}"`)
    console.log('PowerShell result:', command)
    console.log('PowerShell stdout:', stdout)
    console.log('PowerShell stderr:', stderr)
    return { success: true, data: stdout || stderr }
  } catch (error) {
    console.error('PowerShell error:', command)
    console.error('error info:', error.message)
    // 显示错误对话框
    dialog.showErrorBox('PowerShell', `执行命令 "${command}" 时发生错误：\n${error.message}`)
    return { success: false, error: error.message }
  }
}

// 在 app.whenReady().then() 中添加
ipcMain.handle('run-powershell', async (_, command) => {
  return await runPowerShellCommand(command)
})

// 添加 run-cmd 处理程序
ipcMain.handle('run-cmd', async (_, command) => {
  return new Promise((resolve) => {
    exec(command, { shell: 'cmd.exe', encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          error: error.message,
          data: stderr
        })
      } else {
        resolve({
          success: true,
          data: stderr || stdout // java -version 输出到 stderr
        })
      }
    })
  })
})

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,  // 增加窗口宽度
    height: 800,  // 增加窗口高度
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Add this near your other ipcMain handlers
ipcMain.handle('restart-app', () => {
  app.relaunch()
  app.exit(0)
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
