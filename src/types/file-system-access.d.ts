// Minimal ambient types for the File System Access API (Chromium only). TypeScript's bundled DOM
// lib doesn't include these yet, so only the handful of members this app actually uses are declared.
export {}

declare global {
 interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite'
 }

 interface FileSystemHandle {
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
 }

 interface Window {
  showDirectoryPicker(options?: { id?: string; mode?: 'read' | 'readwrite'; startIn?: string }): Promise<FileSystemDirectoryHandle>
 }
}
