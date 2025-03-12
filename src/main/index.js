import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
const { exec } = require('child_process')
import { promisify } from 'util'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import fs from 'fs'
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

async function runPowerShellCommandWithWindow(command) {
  try {
    // 创建一个临时的 PS1 脚本文件
    const scriptContent = `
    $userPath = [System.Environment]::GetEnvironmentVariable('Path', 'User')
    $systemPath = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
    $env:Path = "$userPath;$systemPath"
    ${command}
    `
    const tempFile = join(app.getPath('temp'), 'temp_script.ps1')
    await fs.promises.writeFile(tempFile, scriptContent)
    
    // 直接执行脚本文件
    const { stdout, stderr } = await execAsync(`powershell -WindowStyle Hidden -File "${tempFile}"`)
    
    // 清理临时文件
    await fs.promises.unlink(tempFile)
    
    console.log('PowerShell result:', command)
    console.log('PowerShell stdout:', stdout)
    console.log('PowerShell stderr:', stderr)
    return { success: true, data: stdout || stderr }
  } catch (error) {
    console.error('PowerShell error:', command)
    console.error('error info:', error.message)
    dialog.showErrorBox('PowerShell', `执行命令 "${command}" 时发生错误：\n${error.message}`)
    return { success: false, error: error.message }
  }
}

// 注册新的 IPC 处理程序
ipcMain.handle('run-powershell-window', async (_, command) => {
  return await runPowerShellCommandWithWindow(command)
})

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

// 在适当的位置添加以下代码
const { spawn } = require('child_process')

// 添加 IPC 处理程序
ipcMain.handle('run-powershell-realtime', async (event, command) => {
  return new Promise((resolve) => {
    const powershell = spawn('powershell.exe', ['-Command', command], {
      shell: true
    })
    
    let stdoutData = ''
    let stderrData = ''
    
    powershell.stdout.on('data', (data) => {
      const output = data.toString()
      stdoutData += output
      // 发送实时输出到渲染进程
      event.sender.send('powershell-output', output.trim())
    })
    
    powershell.stderr.on('data', (data) => {
      const output = data.toString()
      stderrData += output
      // 发送错误输出到渲染进程
      event.sender.send('powershell-output', `错误: ${output.trim()}`)
    })
    
    powershell.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, data: stdoutData })
      } else {
        resolve({ success: false, error: stderrData || '执行命令失败' })
      }
    })
    
    powershell.on('error', (error) => {
      resolve({ success: false, error: error.message })
    })
  })
})
