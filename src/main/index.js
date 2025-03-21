// 在文件顶部引入模块
const { app, shell, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const { join, dirname } = require('path')
const { electronApp, optimizer, is } = require('@electron-toolkit/utils')
const icon = join(__dirname, '../../resources/icon.png')
const { exec, spawn } = require('child_process')
const util = require('util')
const fs = require('fs')
const execAsync = util.promisify(exec)
// 引入 electron-log
const log = require('electron-log')

// 获取应用安装目录
const appPath = dirname(app.getPath('exe'))
const logPath = join(appPath, 'logs')
log.transports.file.resolvePath = () => join(logPath, 'main.log')
// 确保日志目录存在
if (!fs.existsSync(logPath)) {
  fs.mkdirSync(logPath, { recursive: true })
}

// 配置日志路径
// 在日志配置部分添加
try {
  if (!fs.existsSync(logPath)) {
    fs.mkdirSync(logPath, { recursive: true })
  }

  // 测试写入权限
  fs.writeFileSync(join(logPath, 'test.log'), 'test', { flag: 'w' })
  fs.unlinkSync(join(logPath, 'test.log'))


} catch (error) {
  // 如果无法写入安装目录，回退到用户数据目录
  const userDataPath = app.getPath('userData')
  const fallbackLogPath = join(userDataPath, 'logs')

  if (!fs.existsSync(fallbackLogPath)) {
    fs.mkdirSync(fallbackLogPath, { recursive: true })
  }

  log.transports.file.resolvePath = () => join(fallbackLogPath, 'main.log')
  log.warn(`无法写入安装目录日志，已回退到: ${fallbackLogPath}`)
}
log.transports.file.level = 'info'
log.transports.file.maxSize = 10 * 1024 * 1024 // 10MB
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'
log.transports.console.level = 'debug'

// 记录应用启动信息
log.info('应用启动')
console.log('应用启动')
log.info(`日志路径: ${logPath}`)
console.log(`日志路径: ${logPath}`)

async function runPowerShellCommand(command, showErrorDialog) {
  try {
    // 使用内置的 PowerShell 命令设置编码，而不是使用命令行参数
    const { stdout, stderr } = await execAsync(`powershell -WindowStyle Hidden -Command ${command}`)

    // 添加日志记录
    log.info(`PowerShell command executed: ${command}`)
    console.log(`PowerShell command executed: ${command}`)
    log.info(`PowerShell stdout: ${stdout}`)
    console.log(`PowerShell stdout: ${stdout}`)
    if (stderr) {
      log.warn(`PowerShell stderr: ${stderr}`)
      console.log(`PowerShell stderr: ${stderr}`)
    }
    return { success: true, data: stdout || stderr }
  } catch (error) {

    // 记录错误到日志
    log.error(`PowerShell command failed: ${command}`)
    console.log(`PowerShell command failed: ${command}`)
    log.error(`Error: ${error.message}`)
    console.log(`Error: ${error.message}`)
    if (showErrorDialog) {
      // 显示错误对话框
      dialog.showErrorBox('PowerShell', `执行命令 "${command}" 时发生错误：\n${error.message}`)
    }
    return { success: false, error: error.message }
  }
}
async function runPowerShellAsAdmin(command, showErrorDialog = true) {
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
    log.info('PowerShell result:', command)
    console.log('PowerShell stdout:', stdout)
    log.info('PowerShell stdout:', stdout)
    console.log('PowerShell stderr:', stderr)
    log.info('PowerShell stdout:', stderr)
    return { success: true, data: stdout || stderr }
  } catch (error) {
    console.error('PowerShell error:', command)
    log.info('PowerShell error:', command)
    console.error('error info:', error.message)
    log.info('error info:', error.message)
    if (showErrorDialog) {
      dialog.showErrorBox('PowerShell', `执行命令 "${command}" 时发生错误：\n${error.message}`)
    }
    

    return { success: false, error: error.message }
  }
}


// 注册 IPC 处理程序
ipcMain.handle('run-powershell-admin', async (_, command, showErrorDialog = true) => {
  return await runPowerShellAsAdmin(command, showErrorDialog)
})


// 在 app.whenReady().then() 中添加
ipcMain.handle('run-powershell', async (_, command, showErrorDialog = true) => {
  return await runPowerShellCommand(command, showErrorDialog)
})

// 添加 run-cmd 处理程序
// 修改 run-cmd 处理程序，添加 showErrorDialog 参数
ipcMain.handle('run-cmd', async (_, command, showErrorDialog = true) => {
  log.info(`Executing CMD command: ${command}`)
  console.log(`Executing CMD command: ${command}`)
  return new Promise((resolve) => {
    exec(command, { shell: 'cmd.exe', encoding: 'utf8' }, (error, stdout, stderr) => {
      if (error) {
        // 记录错误到日志
        log.error(`CMD execution error: ${error.message}`)
        console.log(`CMD execution error: ${error.message}`)
        log.error(`CMD stderr output: ${stderr}`)
        console.log(`CMD stderr output: ${stderr}`)

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

        // 记录成功信息到日志
        log.info('CMD execution successful')
        console.log('CMD execution successful')
        log.info(`CMD stdout: ${stdout}`)
        console.log(`CMD stdout: ${stdout}`)
        if (stderr) {
          log.info(`CMD stderr: ${stderr}`)
          console.log(`CMD stderr: ${stderr}`)
        }
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
    icon: join(__dirname, '../../resources/icon.ico'), // 添加这行配置
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      // 添加以下配置允许开发者工具
      devTools: true
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
    },
    // 添加开发菜单
    {
      label: '开发',
      submenu: [
        {
          label: '开发者工具',
          accelerator: 'F12',
          click: () => {
            if (mainWindow.webContents.isDevToolsOpened()) {
              mainWindow.webContents.closeDevTools();
            } else {
              mainWindow.webContents.openDevTools();
            }
          }
        }
      ]
    }
  ]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)

  // 添加快捷键监听
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

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
ipcMain.handle('get-log-path', () => {
  return join(logPath, 'renderer.log')
})
ipcMain.handle('restart-app', () => {
  app.relaunch()
  app.exit(0)
})


// 添加 IPC 处理程序
ipcMain.handle('run-powershell-realtime', async (event, command) => {
  return new Promise((resolve) => {
    try {
      // 添加编码设置，使用 -OutputEncoding UTF8 参数
      const powershell = spawn('powershell.exe', ['-OutputEncoding', 'UTF8', '-Command', command], {
        encoding: 'utf8',
        shell: true
      })
  
      // 确保输出和错误都使用 UTF-8 编码
      powershell.stdout.setEncoding('utf8')
      powershell.stderr.setEncoding('utf8')

      // 获取进程ID
      const processId = powershell.pid
      console.log(`启动进程，PID: ${processId}，命令: ${command}`)
      log.info(`启动PowerShell进程，PID: ${processId}，命令: ${command}`)
      console.log(`启动PowerShell进程，PID: ${processId}，命令: ${command}`)

      let stdoutData = ''
      let stderrData = ''

      powershell.stdout.on('data', (data) => {
        const output = data.toString()
        stdoutData += output
        // 修改这里：直接发送字符串数据，而不是对象
        event.sender.send('powershell-output', output.trim())
      })

      powershell.stderr.on('data', (data) => {
        const output = data.toString()
        stderrData += output
        // 修改这里：直接发送字符串数据，而不是对象
        event.sender.send('powershell-output', `错误: ${output.trim()}`)
      })

      powershell.on('close', (code) => {
        console.log(`进程 ${processId} 已结束，退出码: ${code}`)
        log.info(`PowerShell进程 ${processId} 已结束，退出码: ${code}`)
        console.log(`PowerShell进程 ${processId} 已结束，退出码: ${code}`)
        if (code === 0) {
          resolve({ success: true, data: stdoutData, processId })
        } else {
          resolve({ success: false, error: stderrData || '执行命令失败', processId })
        }
      })

      powershell.on('error', (error) => {
        console.error(`进程 ${processId} 发生错误:`, error.message)
        log.error(`PowerShell进程 ${processId} 发生错误: ${error.message}`)
        console.log(`PowerShell进程 ${processId} 发生错误: ${error.message}`)
        resolve({ success: false, error: error.message, processId })
      })
    } catch (error) {
      console.error('启动进程时发生错误:', error)
      log.error(`启动PowerShell进程时发生错误: ${error.message}`)
      console.log(`启动PowerShell进程时发生错误: ${error.message}`)
      resolve({ success: false, error: error.message, processId: 0 })
    }
  })
})

// 添加以管理员身份实时运行 PowerShell 命令的函数
ipcMain.handle('run-powershell-admin-realtime', async (event, command) => {
  return new Promise(async (resolve) => {
    try {
      // 创建临时脚本文件，包含实时输出重定向逻辑
      const scriptContent = `
      $startTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
      $logFile = "${logPath}\\admin_realtime_commands.log"
      Add-Content -Path $logFile -Value "[$startTime] 开始执行命令: ${command}"
      

      $outputFile = "${app.getPath('temp')}\\admin_output_${Date.now()}.log"
      
      try {
        Start-Transcript -Path $outputFile -Force
        
        ${command}
        
        Stop-Transcript
        
        $exitCode = $LASTEXITCODE
        if ($exitCode -eq $null) { $exitCode = 0 }
      } catch {
        $errorMsg = $_.Exception.Message
        Add-Content -Path $logFile -Value "执行出错: $errorMsg"
        Add-Content -Path $outputFile -Value "错误: $errorMsg"
        exit 1
      }
      
      $endTime = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
      Add-Content -Path $logFile -Value "[$endTime] 命令执行完成，退出码: $exitCode"
      exit $exitCode
      `
      
      const tempScriptPath = join(app.getPath('temp'), `admin_realtime_script_${Date.now()}.ps1`)
      const outputFilePath = join(app.getPath('temp'), `admin_output_${Date.now()}.log`)
      
      await fs.promises.writeFile(tempScriptPath, scriptContent)
      
      log.info(`创建管理员权限实时脚本: ${tempScriptPath}`)
      console.log(`创建管理员权限实时脚本: ${tempScriptPath}`)
      // 使用 Start-Process 以管理员身份启动 PowerShell 并执行脚本
      const elevateCmd = `
      Start-Process powershell.exe -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File "${tempScriptPath}"' -Verb RunAs -WindowStyle Hidden
      `
      
      // 执行提权命令
      await execAsync(`powershell -WindowStyle Hidden -Command "${elevateCmd}"`)
      
      log.info(`请求管理员权限实时执行命令: ${command}`)
      console.log(`请求管理员权限实时执行命令: ${command}`)
      event.sender.send('powershell-output', `正在以管理员权限执行命令: ${command}`)
      
      // 创建输出文件（如果不存在）
      if (!fs.existsSync(outputFilePath)) {
        await fs.promises.writeFile(outputFilePath, '')
      }
      
      // 设置文件监视器来读取实时输出
      let lastSize = 0
      const checkInterval = 100 // 每100毫秒检查一次
      
      const fileWatcher = setInterval(async () => {
        try {
          if (fs.existsSync(outputFilePath)) {
            const stats = fs.statSync(outputFilePath)
            
            if (stats.size > lastSize) {
              const buffer = Buffer.alloc(stats.size - lastSize)
              const fileHandle = await fs.promises.open(outputFilePath, 'r')
              await fileHandle.read(buffer, 0, stats.size - lastSize, lastSize)
              await fileHandle.close()
              
              const newContent = buffer.toString('utf8')
              if (newContent.trim()) {
                // 修改这里：直接发送字符串数据，而不是对象
                event.sender.send('powershell-output', newContent.trim())
              }
              
              lastSize = stats.size
            }
            
            // 检查脚本是否已完成执行
            if (!fs.existsSync(tempScriptPath)) {
              clearInterval(fileWatcher)
              resolve({ 
                success: true, 
                message: '管理员权限命令执行完成',
                outputFile: outputFilePath
              })
            }
          }
        } catch (error) {
          console.error('读取输出文件时出错:', error)
          log.error(`读取管理员命令输出时出错: ${error.message}`)
          console.log(`读取管理员命令输出时出错: ${error.message}`)
        }
      }, checkInterval)
      
      // 设置超时，防止无限等待
      setTimeout(() => {
        clearInterval(fileWatcher)
        resolve({ 
          success: true, 
          message: '管理员权限命令执行中（可能仍在后台运行）',
          outputFile: outputFilePath
        })
      }, 2 * 60 * 1000) // 2分钟超时
      
    } catch (error) {
      console.error('以管理员身份启动实时进程时发生错误:', error)
      log.error(`以管理员身份启动实时PowerShell进程时发生错误: ${error.message}`)
      console.log(`以管理员身份启动实时PowerShell进程时发生错误: ${error.message}`)
      event.sender.send('powershell-output', `错误: 无法以管理员身份启动进程 - ${error.message}`)
      resolve({ success: false, error: error.message })
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

// 在文件顶部引入模块

// 捕获未处理的异常
process.on('uncaughtException', (error) => {
  log.error('未捕获的异常:', error)
  console.error('未捕获的异常:', error)
  // 这里已经有console.error了，不需要添加
  dialog.showErrorBox('应用错误', `发生了未处理的异常：\n${error.message}`)
})

// 捕获未处理的 Promise 拒绝
process.on('unhandledRejection', (reason) => {
  log.error('未处理的 Promise 拒绝:', reason)
  console.error('未处理的 Promise 拒绝:', reason)
  // 这里已经有console.error了，不需要添加
})

// 应用退出时记录日志
app.on('quit', () => {
  log.info('应用退出')
  console.log('应用退出')
})


