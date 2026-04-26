const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");

const DEFAULT_DEV_URL = "http://127.0.0.1:5173/";
const DEFAULT_PROD_URL = "http://127.0.0.1:5001/";

let mainWindow;
let loaderWindow;

function createLoaderWindow() {
  loaderWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    alwaysOnTop: true,
    backgroundColor: '#000000',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  loaderWindow.loadFile(path.join(__dirname, 'loader.html'));
  loaderWindow.once('ready-to-show', () => {
    loaderWindow.show();
  });
}

function createMainWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "brainDead",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(url);

  mainWindow.once('ready-to-show', () => {
    if (loaderWindow) {
      loaderWindow.close();
      loaderWindow = null;
    }
    mainWindow.show();
  });
}

function showErrorAndQuit(message) {
  dialog.showErrorBox("brainDead Desktop", message);
  app.quit();
}

app.whenReady().then(() => {
  const isDev = process.env.NEUROFLOW_ELECTRON_DEV === "1";

  createLoaderWindow();

  // Simulate loading time - in a real app, you'd check backend readiness
  setTimeout(() => {
    const url = isDev
      ? (process.env.NEUROFLOW_DEV_URL || DEFAULT_DEV_URL)
      : (process.env.NEUROFLOW_PROD_URL || DEFAULT_PROD_URL);

    createMainWindow(url);
  }, 8000); // 8 seconds for the loading animation
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

