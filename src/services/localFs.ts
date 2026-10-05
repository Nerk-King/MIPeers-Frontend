// Wraps the File System Access API (Chromium only — Chrome/Edge, not Firefox/Safari) so the app can
// actually place a picked file into a real local folder before telling ilDecision:ragUpload to go
// read it from there. Browsers never expose a handle's absolute OS path to script (by design), so
// the matching server-side path is a value the user configures once in Settings, not something we
// can derive or verify here.
const DB_NAME = 'mipeers-uploads-fs'
const STORE = 'handles'
const HANDLE_KEY = 'uploadsDir'

export const isFileSystemAccessSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window

function openDb(): Promise<IDBDatabase> {
 return new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1)
  request.onupgradeneeded = () => request.result.createObjectStore(STORE)
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(new Error('Local storage is unavailable. Allow browser storage and try again.'))
 })
}

async function storeHandle(handle: FileSystemDirectoryHandle): Promise<void> {
 const db = await openDb()
 await new Promise<void>((resolve, reject) => {
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).put(handle, HANDLE_KEY)
  tx.oncomplete = () => resolve()
  tx.onerror = () => reject(new Error('Could not remember this folder for next time.'))
 })
}

async function loadHandle(): Promise<FileSystemDirectoryHandle | undefined> {
 const db = await openDb()
 return new Promise((resolve, reject) => {
  const tx = db.transaction(STORE, 'readonly')
  const request = tx.objectStore(STORE).get(HANDLE_KEY)
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(new Error('Could not read the saved folder.'))
 })
}

/** Opens the browser's folder picker so the user can grant access to their local uploads folder. Must run from a click handler. */
export async function chooseUploadsFolder(): Promise<FileSystemDirectoryHandle> {
 if (!isFileSystemAccessSupported) throw new Error('Your browser can’t grant folder access. Use Chrome or Edge for uploads.')
 const handle = await window.showDirectoryPicker({ id: 'mipeers-uploads', mode: 'readwrite' })
 await storeHandle(handle)
 return handle
}

/** Returns the previously granted folder if permission is still active, without prompting (safe to call outside a click handler). */
export async function getGrantedUploadsFolder(): Promise<FileSystemDirectoryHandle | undefined> {
 const handle = await loadHandle()
 if (!handle) return undefined
 const permission = await handle.queryPermission({ mode: 'readwrite' })
 return permission === 'granted' ? handle : undefined
}

/** Re-prompts for permission on a previously chosen folder. Must run from a click handler. */
export async function requestUploadsFolderAccess(): Promise<FileSystemDirectoryHandle> {
 const handle = await loadHandle()
 if (!handle) throw new Error('Choose a folder first.')
 const permission = await handle.requestPermission({ mode: 'readwrite' })
 if (permission !== 'granted') throw new Error('Folder access was not granted.')
 return handle
}

/** Returns true if a folder has been chosen before, whether or not its permission is still active (vs. needing a fresh pick). */
export async function hasChosenUploadsFolder(): Promise<boolean> {
 return !!(await loadHandle())
}

export async function writeFileToFolder(handle: FileSystemDirectoryHandle, file: File): Promise<void> {
 const fileHandle = await handle.getFileHandle(file.name, { create: true })
 const writable = await fileHandle.createWritable()
 await writable.write(file)
 await writable.close()
}
