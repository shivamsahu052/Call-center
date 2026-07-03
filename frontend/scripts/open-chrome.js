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
      ].map((command) => command && { command, args: [url] })
    : process.platform === 'darwin'
      ? [{ command: 'open', args: ['-a', 'Google Chrome', url] }]
      : [
          { command: 'google-chrome', args: [url] },
          { command: 'google-chrome-stable', args: [url] },
          { command: 'chromium', args: [url] },
          { command: 'chromium-browser', args: [url] },
        ]

const chrome = candidates.filter(Boolean).find(({ command }) => {
  return process.platform !== 'win32' || existsSync(command)
})

if (!chrome) {
  process.exit(0)
}

const child = spawn(chrome.command, chrome.args, {
  detached: true,
  stdio: 'ignore',
})

child.on('error', () => {
  process.exit(0)
})

child.unref()
