import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'

const url = process.argv.at(-1)

if (!url || !/^https?:\/\//i.test(url)) {
  process.exit(0)
}

const candidates =
  process.platform === 'win32'
    ? [
        process.env.CHROME_PATH,
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA &&
          `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
      ]
    : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']

const chrome = candidates.filter(Boolean).find((candidate) => {
  return process.platform !== 'win32' || existsSync(candidate)
})

if (!chrome) {
  process.exit(0)
}

const child = spawn(chrome, [url], {
  detached: true,
  stdio: 'ignore',
})

child.unref()
