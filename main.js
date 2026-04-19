const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { autoUpdater } = require('electron-updater');

// 업데이트 로그 설정 (선택 사항)
autoUpdater.autoDownload = false; // 수동으로 다운로드 여부 결정


// [CRITICAL] 터미널의 모든 SSL/TLS 관련 네트워킹 에러 로그를 앱 기동 전 원천 차단
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('log-level', '3'); // 불필요한 로그 억제

// Ensure data directory exists
const DATA_DIR = path.join(app.getPath('userData'), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 렌더러 프로세스에 데이터 경로를 제공하는 핸들러 추가
ipcMain.handle('get-data-path', () => {
    return DATA_DIR;
});

// 동기식 경로 제공 (초기화용)
ipcMain.on('get-path-sync', (event, arg) => {
    if (arg === 'userData-data') {
        event.returnValue = DATA_DIR;
    } else {
        event.returnValue = app.getPath(arg);
    }
});

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(__dirname, 'app_icon.png'),
    frame: false, // 커스텀 타이틀바 윈도우 스타일
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#fbfbfd', // Soft White Base
      symbolColor: '#1d1d1f',
      height: 48 // 타이틀바 높이
    },
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false, // 외부 이미지 로드 및 캡처를 위해 보안 해제
      devTools: !app.isPackaged // 배포용(Packaged) 상태일 때는 개발자 도구 비활성화
    }
  });

  // 배포 모드에서 추가적인 개발자 도구 차단 (단축키 등)
  if (app.isPackaged) {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools();
    });
    
    // 우클릭 검사 메뉴 및 단축키(F12, Ctrl+Shift+I) 원천 차단
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if ((input.control && input.shift && input.key.toLowerCase() === 'i') || 
          (input.key === 'F12') || 
          (input.control && input.key.toLowerCase() === 'r')) {
        event.preventDefault();
      }
    });
    
    // 메뉴 바 제거 (Alt 키 등으로 나타나는 기본 메뉴 차단)
    mainWindow.setMenu(null);
  }

  mainWindow.loadFile('index.html');
}

// 렌더러에서 테마 변경 요청 시 타이틀바 색상 동기화
ipcMain.on('theme-changed', (event, theme) => {
  const win = BrowserWindow.getFocusedWindow();
  if (!win) return;
  if (theme === 'dark') {
    win.setTitleBarOverlay({
      color: '#1a1a1c',
      symbolColor: '#f5f5f7'
    });
  } else {
    win.setTitleBarOverlay({
      color: '#fbfbfd',
      symbolColor: '#1d1d1f'
    });
  }
});

// 렌더러에서 앱 재시작 요청 시 처리 (전역 위치로 이동하여 안정성 확보)
ipcMain.on('restart-app', () => {
  app.relaunch();
  app.exit(0);
});

// 데이터베이스 파일 저장 핸들러 (내보내기 완료 시점 파악용)
ipcMain.handle('save-database', async (event, content, defaultFilename) => {
  const downloadsPath = app.getPath('downloads') || app.getPath('userData');
  
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: '데이터베이스 내보내기',
    defaultPath: path.join(downloadsPath, defaultFilename),
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });

  if (canceled || !filePath) return { success: false, canceled: true };

  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return { success: true };
  } catch (err) {
    console.error('Failed to save database file:', err);
    return { success: false, error: err.message };
  }
});

// ============================================================
// [핵심] 네이티브 PDF 생성 핸들러 (벡터 텍스트 보존)
// iframe.contentWindow.print() 대신 Electron의 webContents.printToPDF() 사용
// 이 방식은 텍스트를 100% 벡터 데이터로 보존하여 드래그/검색이 가능합니다
// ============================================================
ipcMain.handle('print-to-pdf', async (event, { html, title }) => {
  const tempFile = path.join(os.tmpdir(), `pcshop_print_${Date.now()}.html`);
  let printWin = null;

  try {
    // 1. HTML을 임시 파일로 저장
    fs.writeFileSync(tempFile, html, 'utf8');

    // 2. 숨겨진 BrowserWindow 생성 (A4 비율)
    printWin = new BrowserWindow({
      show: false,
      width: 794,    // A4 너비 (210mm at 96dpi)
      height: 1123,  // A4 높이 (297mm at 96dpi)
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // 3. 임시 HTML 파일 로드 (Windows 절대경로 호환을 위해 file:// URL 사용)
    const fileUrl = 'file:///' + tempFile.replace(/\\/g, '/');
    await printWin.loadURL(fileUrl);

    // 4. 폰트 및 이미지가 완전히 로드될 때까지 대기
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 5. 저장 대화상자 표시
    const allWindows = BrowserWindow.getAllWindows();
    const parentWin = allWindows.find(w => w !== printWin) || printWin;
    const downloadsPath = app.getPath('downloads');
    const safeTitle = (title || 'PCSHOP_Document').replace(/[<>:"/\\|?*]/g, '_');

    const { filePath, canceled } = await dialog.showSaveDialog(parentWin, {
      title: 'PDF 저장',
      defaultPath: path.join(downloadsPath, `${safeTitle}.pdf`),
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    // 6. 네이티브 PDF 생성 (벡터 텍스트 보존의 핵심)
    const pdfData = await printWin.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 }
    });

    // 7. PDF 파일 저장
    fs.writeFileSync(filePath, pdfData);
    return { success: true, filePath: filePath };

  } catch (err) {
    console.error('PDF generation failed:', err);
    return { success: false, error: err.message };
  } finally {
    // 리소스 정리: 숨겨진 창 닫기 및 임시 파일 삭제
    if (printWin && !printWin.isDestroyed()) {
      printWin.close();
    }
    try { fs.unlinkSync(tempFile); } catch(e) {}
  }
});

// 이미지 저장 핸들러 (Base64 데이터를 받아 파일로 저장)
ipcMain.handle('save-image', async (event, { dataUrl, filename }) => {
  let win = BrowserWindow.getFocusedWindow();
  if(!win) win = BrowserWindow.getAllWindows()[0];

  const downloadsPath = app.getPath('downloads');
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    title: '이미지 저장',
    defaultPath: path.join(downloadsPath, filename),
    filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg'] }]
  });

  if (canceled || !filePath) return { success: false, canceled: true };

  try {
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);
    return { success: true };
  } catch (err) {
    console.error('Failed to save image:', err);
    return { success: false, error: err.message };
  }
});

// 엑셀 저장 핸들러 (XLS 내용을 받아 파일로 저장)
ipcMain.handle('save-excel', async (event, { content, filename }) => {
  let win = BrowserWindow.getFocusedWindow();
  if(!win) win = BrowserWindow.getAllWindows()[0];

  const downloadsPath = app.getPath('downloads');
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    title: '엑셀 파일 내보내기',
    defaultPath: path.join(downloadsPath, filename),
    filters: [{ name: 'Excel Files', extensions: ['xls'] }]
  });

  if (canceled || !filePath) return { success: false, canceled: true };

  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return { success: true };
  } catch (err) {
    console.error('Failed to save excel:', err);
    return { success: false, error: err.message };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// 업데이트 이벤트 핸들러 (렌더러로 신호 전달)
autoUpdater.on('update-available', (info) => {
  console.log('[Updater] Update found. Version:', info.version);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes
    });
  }
});

autoUpdater.on('error', (err) => {
  console.error('[Updater] Error occurred:', err);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-error', err.message);
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('[Updater] No update available.');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-not-available');
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  console.log(`[Updater] Downloading: ${progressObj.percent}%`);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-progress', progressObj.percent);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('[Updater] Update downloaded.');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-downloaded');
  }
});

// 수동 업데이트 체크 요청 핸들러
ipcMain.on('manual-update-check', () => {
  console.log('[Updater] Manual update check requested.');
  autoUpdater.checkForUpdatesAndNotify();
});

// 렌더러에서 업데이트 시작 버튼을 눌렀을 때
ipcMain.on('start-download', () => {
  autoUpdater.downloadUpdate();
});

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});

// 앱 버전 정보 제공
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});




app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
