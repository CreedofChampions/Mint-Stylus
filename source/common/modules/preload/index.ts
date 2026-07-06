/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        BrowserWindow preload script
 * CVM-Role:        Controller
 * Maintainer:      Hendrik Erz
 * License:         GNU GPL v3
 *
 * Description:     This file is being executed by every BrowserWindow instance
 *                  and has the task to provide needed Electron APIs into the
 *                  sandboxed renderers.
 *
 * END HEADER
 */

import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { CiteprocProviderIPCAPI } from 'source/app/service-providers/citeproc'
// ==== AI-created for Mint Stylus ====
// The following import is a *type-only* import of the AIProvider's IPC contract
// so the `window.ai` bridge below stays in lock-step with what the main-process
// provider actually accepts. Type-only, so it is erased at build time and never
// pulls main-process code into the sandboxed preload bundle.
import type { AIProviderIPCAPI } from 'source/app/service-providers/ai'

// PREPARATION: Since we have multiple editor panes and all of them need to
// listen to a few events, we need to ramp up some of the channels' max
// listeners. We assume approx. 10 base listeners and will support up to 90 more
// The reason we run into this problem is that the preloader actually shares
// listeners across all windows
ipcRenderer.setMaxListeners(100)

// We need a few ipc methods
contextBridge.exposeInMainWorld('ipc', {
  // TODO: Instead of simply exposing the required IPC functions to the main
  // context, we may want to create a dedicated (possibly much more type-safe)
  // API object that JS in the renderer can call. This would get rid of the
  // no-unsafe-argument problems we have here.

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  sendSync: (event: string, ...args: any[]) => ipcRenderer.sendSync(event, ...args),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  invoke: async (channel: string, ...args: any[]) => await ipcRenderer.invoke(channel, ...args),
  on: (channel: string, listener: (...args: any[]) => void) => {
    // NOTE: We're returning a stopListening() callback here since the function
    // will be cloned across the context bridge, so not the same object, hence
    // it cannot be removed otherwise.
    const callback = (event: any, ...args: any[]): void => {
      // Omit the event when calling the listener
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      listener(undefined, ...args)
    }
    ipcRenderer.on(channel, callback)

    return () => ipcRenderer.off(channel, callback)
  }
})

contextBridge.exposeInMainWorld('config', {
  get: function (property?: string) {
    return ipcRenderer.sendSync('config-provider', {
      command: 'get-config',
      payload: { key: property }
    })
  },
  set: function (property: string, value: any) {
    ipcRenderer.sendSync('config-provider', {
      command: 'set-config-single',
      payload: { key: property, val: value }
    })
  }
})

// ==== AI-created for Mint Stylus ====
// The narrow `window.ai` bridge. This is the ONLY surface the renderer has to
// the AIProvider (main process). Every method wraps a single
// ipcRenderer.invoke('ai-provider', { command, payload }) round-trip — matching
// the exact { command, payload } shape of AIProviderIPCAPI — so no API key and
// no HTTP ever touch the renderer. There is deliberately NO getKey(): keys only
// ever travel *inbound* via saveKey and are never read back out.
//
// Streaming: chatStream() generates a correlation id, hands it to main inside
// the 'chat-stream' payload, and (a) registers any per-call onDelta callback and
// (b) exposes onStream(id, cb) for the store to subscribe. Main pushes deltas
// back over the 'ai-stream' channel as { id, delta }, which the single dispatch
// listener below fans out to the callbacks registered for that id.

// Per-id set of delta callbacks for in-flight streams. A single ipcRenderer.on
// listener dispatches every 'ai-stream' message to the matching callbacks.
const aiStreamCallbacks = new Map<string, Set<(delta: string) => void>>()

ipcRenderer.on('ai-stream', (_event, message: { id?: string, delta?: string }) => {
  if (message === undefined || message === null || typeof message.id !== 'string') {
    return
  }
  // Only forward payloads that actually carry a text delta; terminal messages
  // ('done'/'error'/'cancelled') resolve the invoke() promise instead.
  if (typeof message.delta !== 'string') {
    return
  }
  const callbacks = aiStreamCallbacks.get(message.id)
  if (callbacks === undefined) {
    return
  }
  for (const callback of callbacks) {
    callback(message.delta)
  }
})

/**
 * Subscribe a callback to the stream deltas of a given request id. Returns an
 * unsubscribe function that removes just this callback (and cleans up the id's
 * bucket once empty).
 *
 * @param   {string}                    id        The request id to listen for
 * @param   {(delta: string) => void}   callback  Called with each text delta
 *
 * @return  {() => void}                          Unsubscribe function
 */
function subscribeToStream (id: string, callback: (delta: string) => void): () => void {
  let bucket = aiStreamCallbacks.get(id)
  if (bucket === undefined) {
    bucket = new Set()
    aiStreamCallbacks.set(id, bucket)
  }
  bucket.add(callback)

  return () => {
    const current = aiStreamCallbacks.get(id)
    if (current === undefined) {
      return
    }
    current.delete(callback)
    if (current.size === 0) {
      aiStreamCallbacks.delete(id)
    }
  }
}

/**
 * Send a single typed command to the AIProvider over the 'ai-provider' channel.
 *
 * @param   {AIProviderIPCAPI}  message  The { command, payload } message
 *
 * @return  {Promise<any>}               Whatever the provider resolves with
 */
async function invokeAI (message: AIProviderIPCAPI): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return await ipcRenderer.invoke('ai-provider', message)
}

contextBridge.exposeInMainWorld('ai', {
  /**
   * One-shot (non-streaming) chat completion. Resolves with the assistant's
   * full text response.
   */
  chat: async (payload: any): Promise<string> => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await invokeAI({ command: 'chat', payload })
  },
  /**
   * Streaming chat completion. Generates a correlation id, forwards it to main
   * inside the 'chat-stream' payload, wires up delta delivery, and resolves
   * with the id (used to correlate deltas via onStream and to cancel()). An
   * optional onDelta callback receives deltas directly for callers that prefer
   * the (payload, onDelta) form; store callers use onStream(id, cb) instead.
   */
  chatStream: async (payload: any, onDelta?: (delta: string) => void): Promise<string> => {
    const id = (typeof payload?.id === 'string' && payload.id.length > 0)
      ? payload.id
      : `ai-stream-${Date.now()}-${Math.random().toString(36).slice(2)}`

    let unsubscribe: (() => void) | undefined
    if (typeof onDelta === 'function') {
      unsubscribe = subscribeToStream(id, onDelta)
    }

    try {
      // Main resolves this promise with { id, text } once the stream completes.
      await invokeAI({ command: 'chat-stream', payload: { ...payload, id } })
    } finally {
      // If we registered a direct onDelta above, tear it down when the stream
      // ends. Callers using onStream() manage their own subscription lifetime.
      if (unsubscribe !== undefined) {
        unsubscribe()
      }
    }

    return id
  },
  /**
   * Lists the models available from the current (or given) provider.
   */
  listModels: async (provider?: string): Promise<any[]> => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return await invokeAI({ command: 'list-models', payload: { provider } })
  },
  /**
   * Validates the stored key for a provider (e.g. quota check). Resolves true
   * when the provider does not throw.
   */
  validateKey: async (provider: string): Promise<boolean> => {
    try {
      await invokeAI({ command: 'validate-key', payload: { provider } })
      return true
    } catch (err) {
      return false
    }
  },
  /**
   * Persists (encrypts, in main) an API key for a provider. The plaintext key
   * only travels inbound here at save time; it is never read back out.
   */
  saveKey: async (provider: string, key: string): Promise<boolean> => {
    const result = await invokeAI({ command: 'save-key', payload: { provider, key } })
    return result?.saved === true
  },
  /**
   * Whether a key is stored for the given provider.
   */
  hasKey: async (provider: string): Promise<boolean> => {
    const result = await invokeAI({ command: 'has-key', payload: { provider } })
    return result === true
  },
  /**
   * Removes the stored key for a provider.
   */
  deleteKey: async (provider: string): Promise<boolean> => {
    const result = await invokeAI({ command: 'delete-key', payload: { provider } })
    return result?.deleted === true
  },
  /**
   * Runs a web search in main and resolves with the formatted, URL-bearing
   * results block for RAG injection.
   */
  search: async (query: string): Promise<string> => {
    const result = await invokeAI({ command: 'search', payload: { query } })
    // The provider returns a SearchResponse whose `block` field is the
    // ready-to-inject, URL-bearing RAG block. Hand that back; fall back
    // defensively for any other shape.
    if (typeof result === 'string') {
      return result
    }
    if (result !== null && result !== undefined && typeof result.block === 'string') {
      return result.block
    }
    return result !== null && result !== undefined ? JSON.stringify(result) : ''
  },
  /**
   * Reads the current "Write in My Style" precursor text.
   */
  getStyle: async (): Promise<string> => {
    const result = await invokeAI({ command: 'get-style', payload: undefined })
    return typeof result === 'string' ? result : ''
  },
  /**
   * Writes the "Write in My Style" precursor text.
   */
  setStyle: async (style: string): Promise<boolean> => {
    const result = await invokeAI({ command: 'set-style', payload: { content: style } })
    return result?.saved === true
  },
  /**
   * Subscribes to stream deltas for a request id. The callback fires for every
   * delta that matches id. Returns an unsubscribe function.
   */
  onStream: (id: string, callback: (delta: string) => void): (() => void) => {
    return subscribeToStream(id, callback)
  },
  /**
   * Aborts an in-flight streaming request by its id.
   */
  cancel: (id: string): void => {
    // Fire-and-forget: we don't await the abort acknowledgement.
    void invokeAI({ command: 'cancel', payload: { id } })
    // Proactively drop any local subscriptions for this id.
    aiStreamCallbacks.delete(id)
  }
})

contextBridge.exposeInMainWorld(
  'getCitationCallback',
  function (database: string): (citations: CiteItem[], composite: boolean) => string|undefined {
    return function (citations: CiteItem[], composite: boolean): string|undefined {
      return ipcRenderer.sendSync('citeproc-provider', {
        command: 'get-citation-sync',
        payload: { database, citations, composite }
      } as CiteprocProviderIPCAPI)
    }
  }
)

// Expose the subset of process properties we need
contextBridge.exposeInMainWorld('process', {
  platform: process.platform,
  version: process.version,
  versions: process.versions,
  arch: process.arch,
  uptime: () => process.uptime(),
  getSystemVersion: process.getSystemVersion(),
  env: Object.assign({}, process.env),
  argv: process.argv
})

// Allow renderers to retrieve the absolute file path for any file object that
// points to a file on disk
contextBridge.exposeInMainWorld('getPathForFile', function (file: File): string|undefined {
  try {
    const filePath = webUtils.getPathForFile(file)
    return filePath !== '' ? filePath : undefined
  } catch (err) {
    return undefined
  }
})
