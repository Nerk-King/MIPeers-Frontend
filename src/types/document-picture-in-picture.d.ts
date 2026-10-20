// Document Picture-in-Picture isn't in TS's lib.dom.d.ts yet (Chrome/Edge 116+ only).
// https://developer.chrome.com/docs/web-platform/document-picture-in-picture
export {}

declare global {
 interface DocumentPictureInPicture extends EventTarget {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>
  readonly window: Window | null
 }
 interface Window {
  documentPictureInPicture?: DocumentPictureInPicture
 }
}
