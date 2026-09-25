import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

const SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'process-control.ps1')

/**
 * Membekukan (suspend) seluruh thread proses child di Windows / POSIX
 */
export function suspendProcess(pid) {
  if (!pid) return false
  try {
    if (process.platform === 'win32') {
      if (!fs.existsSync(SCRIPT_PATH)) {
        console.warn('[ProcessControl] scripts/process-control.ps1 tidak ditemukan.')
        return false
      }
      execSync(`powershell -ExecutionPolicy Bypass -File "${SCRIPT_PATH}" -targetPid ${pid} -action suspend`, {
        stdio: 'ignore',
        timeout: 6000,
      })
      return true
    } else {
      process.kill(pid, 'SIGSTOP')
      return true
    }
  } catch (err) {
    console.warn(`[ProcessControl] Gagal suspend PID ${pid}:`, err.message)
    return false
  }
}

/**
 * Melanjutkan kembali (resume) seluruh thread proses child
 */
export function resumeProcess(pid) {
  if (!pid) return false
  try {
    if (process.platform === 'win32') {
      if (!fs.existsSync(SCRIPT_PATH)) {
        console.warn('[ProcessControl] scripts/process-control.ps1 tidak ditemukan.')
        return false
      }
      execSync(`powershell -ExecutionPolicy Bypass -File "${SCRIPT_PATH}" -targetPid ${pid} -action resume`, {
        stdio: 'ignore',
        timeout: 6000,
      })
      return true
    } else {
      process.kill(pid, 'SIGCONT')
      return true
    }
  } catch (err) {
    console.warn(`[ProcessControl] Gagal resume PID ${pid}:`, err.message)
    return false
  }
}

/**
 * Menghentikan paksa (kill) proses dan seluruh pohon subprosesnya (process tree)
 */
export function killProcessTree(pid) {
  if (!pid) return false
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /F /T`, { stdio: 'ignore', timeout: 6000 })
      return true
    } else {
      process.kill(pid, 'SIGKILL')
      return true
    }
  } catch (err) {
    console.warn(`[ProcessControl] Gagal terminate PID ${pid}:`, err.message)
    return false
  }
}
