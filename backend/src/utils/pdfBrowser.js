const chromium = require('@sparticuz/chromium');
const puppeteerCore = require('puppeteer-core');
const puppeteer = require('puppeteer');

const RAILWAY_KEYS = [
  'RAILWAY_PROJECT_ID',
  'RAILWAY_SERVICE_ID',
  'RAILWAY_ENVIRONMENT',
];

const EXECUTABLE_ENV_KEYS = [
  'PUPPETEER_EXECUTABLE_PATH',
  'CHROME_EXECUTABLE_PATH',
  'GOOGLE_CHROME_BIN',
  'CHROMIUM_PATH',
];

const commonArgs = ['--no-sandbox', '--disable-setuid-sandbox'];

const isRailwayRuntime = () => RAILWAY_KEYS.some(k => Boolean(process.env[k]));

const getEnvExecutablePath = () => {
  for (const key of EXECUTABLE_ENV_KEYS) {
    const val = process.env[key];
    if (val && String(val).trim()) return String(val).trim();
  }
  return null;
};

const launchWithSystemPuppeteer = async () => {
  return puppeteer.launch({
    headless: 'new',
    args: commonArgs,
  });
};

const launchWithCore = async ({ executablePath, useChromiumArgs = false }) => {
  return puppeteerCore.launch({
    executablePath,
    headless: true,
    args: useChromiumArgs ? [...commonArgs, ...chromium.args] : commonArgs,
    defaultViewport: chromium.defaultViewport,
  });
};

const launchWithSparticuz = async () => {
  const executablePath = await chromium.executablePath();
  if (!executablePath) {
    throw new Error('Sparticuz executable path not available');
  }
  return launchWithCore({ executablePath, useChromiumArgs: true });
};

const launchPdfBrowser = async () => {
  if (isRailwayRuntime()) {
    try {
      return await launchWithSparticuz();
    } catch (e) {
      console.warn('Railway Chromium launch failed, falling back to bundled Puppeteer:', e.message);
      return launchWithSystemPuppeteer();
    }
  }

  try {
    return await launchWithSystemPuppeteer();
  } catch (localErr) {
    const envExecutablePath = getEnvExecutablePath();
    if (envExecutablePath) {
      try {
        return await launchWithCore({ executablePath: envExecutablePath });
      } catch (envErr) {
        console.warn('Env executable path launch failed:', envErr.message);
      }
    }

    try {
      return await launchWithSparticuz();
    } catch (chromiumErr) {
      throw new Error(
        `Unable to launch PDF browser. Local Puppeteer: ${localErr.message}; Sparticuz: ${chromiumErr.message}`
      );
    }
  }
};

module.exports = {
  launchPdfBrowser,
};
