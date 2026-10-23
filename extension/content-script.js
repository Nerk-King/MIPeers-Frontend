// Injected on demand (via chrome.scripting.executeScript) only when the popup is opened — not a
// persistent content script, so it never runs on pages the user hasn't actively invoked it on.
// Its return value becomes the "page context" the popup can fold into a RAG question.
(() => {
 const selection = window.getSelection ? window.getSelection().toString().trim() : ''
 const bodyText = document.body ? document.body.innerText : ''
 const excerpt = bodyText.replace(/\s+/g, ' ').trim().slice(0, 4000)
 return {
  title: document.title,
  url: location.href,
  selection,
  excerpt,
 }
})()
