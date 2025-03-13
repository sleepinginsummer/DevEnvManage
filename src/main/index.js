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
// 修改 run-cmd 处理程序，添加 showErrorDialog 参数
ipcMain.handle('run-cmd', async (_, command, showErrorDialog = true) => {
  console.log('Executing CMD command:', command)
  return new Promise((resolve) => {
    exec(command, { shell: 'cmd.exe', encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        console.error('CMD execution error:', error.message)
        console.error('CMD stderr output:', stderr)

        // 只有当 showErrorDialog 为 true 时才显示错误对话框
        if (showErrorDialog) {
          dialog.showErrorBox('CMD Execution Error', `Error executing command "${command}":\n${error.message}`)
        }

        resolve({
          success: false,
          error: error.message,
          data: stderr
        })
      } else {
        console.log('CMD execution successful')
        console.log('CMD stdout:', stdout)
        console.log('CMD stderr:', stderr)
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
    width: 1060,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    icon: join(__dirname, '../../resources/icon.png'), // 添加这行配置
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // 添加标准的编辑菜单，启用复制粘贴功能
  const { Menu } = require('electron')
  const template = [
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'delete', label: '删除' },
        { type: 'separator' },
        { role: 'selectAll', label: '全选' }
      ]
    }
  ]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)

  // 启用右键菜单
  mainWindow.webContents.on('context-menu', (_, params) => {
    const contextMenu = Menu.buildFromTemplate([
      { role: 'copy', label: '复制' },
      { role: 'paste', label: '粘贴' },
      { role: 'selectAll', label: '全选' }
    ])
    contextMenu.popup({ window: mainWindow })
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

  // 在页面加载完成后注入允许文本选择的 CSS 和 JavaScript
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.insertCSS(`
      * {
        -webkit-user-select: text !important;
        user-select: text !important;
      }
    `).catch(err => console.error('插入 CSS 失败:', err));

    mainWindow.webContents.executeJavaScript(`
      document.addEventListener('selectstart', (e) => {
        e.stopPropagation();
      }, true);
      
      // 确保所有元素可以被选择
      const style = document.createElement('style');
      style.innerHTML = '* { user-select: text !important; -webkit-user-select: text !important; }';
      document.head.appendChild(style);
      
      console.log('已启用文本选择功能');
    `).catch(err => console.error('执行 JavaScript 失败:', err));
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// 在 app.whenReady().then() 中添加
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 添加复制到剪贴板的 IPC 处理程序
  ipcMain.handle('copy-to-clipboard', (_, text) => {
    require('electron').clipboard.writeText(text);
    return true;
  });

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
    try {
      const powershell = spawn('powershell.exe', ['-Command', command], {
        shell: true
      })

      // 获取进程ID
      const processId = powershell.pid
      console.log(`启动进程，PID: ${processId}，命令: ${command}`)

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
        console.log(`进程 ${processId} 已结束，退出码: ${code}`)
        if (code === 0) {
          resolve({ success: true, data: stdoutData, processId })
        } else {
          resolve({ success: false, error: stderrData || '执行命令失败', processId })
        }
      })

      powershell.on('error', (error) => {
        console.error(`进程 ${processId} 发生错误:`, error.message)
        resolve({ success: false, error: error.message, processId })
      })
    } catch (error) {
      console.error('启动进程时发生错误:', error)
      resolve({ success: false, error: error.message, processId: 0 })
    }
  })
})

// 添加 CMD 实时输出处理程序
ipcMain.handle('run-cmd-realtime', async (event, command) => {
  return new Promise((resolve) => {
    try {
      const cmd = spawn('cmd.exe', ['/c', command], {
        shell: true,
        // 添加编码设置
        env: { ...process.env, LANG: 'zh_CN.GBK', LC_ALL: 'zh_CN.GBK' }
      })

      // 获取进程ID
      const processId = cmd.pid
      console.log(`Starting process, PID: ${processId}, Command: ${command}`)

      let stdoutData = ''
      let stderrData = ''

      cmd.stdout.on('data', (data) => {
        // 使用 GBK 解码
        const output = Buffer.from(data).toString('latin1')
        stdoutData += output
        // 发送实时输出到渲染进程
        event.sender.send('powershell-output', output.trim())
      })

      cmd.stderr.on('data', (data) => {
        // 使用 GBK 解码
        const output = Buffer.from(data).toString('latin1')
        stderrData += output
        // 发送错误输出到渲染进程
        event.sender.send('powershell-output', `Error: ${output.trim()}`)
      })

      cmd.on('close', (code) => {
        console.log(`Process ${processId} ended, exit code: ${code}`)
        if (code === 0) {
          resolve({ success: true, data: stdoutData, processId })
        } else {
          resolve({ success: false, error: stderrData || 'Command execution failed', processId })
        }
      })

      cmd.on('error', (error) => {
        console.error(`Process ${processId} error:`, error.message)
        resolve({ success: false, error: error.message, processId })
      })
    } catch (error) {
      console.error('Error starting process:', error)
      resolve({ success: false, error: error.message, processId: 0 })
    }
  })
})


