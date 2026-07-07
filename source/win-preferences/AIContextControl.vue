<template>
  <div class="ai-context-control">
    <p class="ai-context-intro">{{ introText }}</p>

    <!-- Folder group -->
    <label class="ai-field-label">{{ folderLabel }}</label>
    <div class="ai-context-row">
      <input
        v-model="folder"
        type="text"
        class="ai-context-input"
        v-bind:placeholder="folderPlaceholder"
        autocomplete="off"
        spellcheck="false"
        v-on:change="saveFolder"
        v-on:blur="saveFolder"
      >
      <button type="button" class="ai-context-btn" v-on:click="pickFolder">{{ chooseLabel }}</button>
      <button type="button" class="ai-context-btn" v-bind:disabled="testing || folder.trim() === ''" v-on:click="testFolder">{{ testLabel }}</button>
      <button type="button" class="ai-context-btn" v-bind:disabled="folder.trim() === ''" v-on:click="clearFolder">{{ clearLabel }}</button>
    </div>

    <!-- MCP server -->
    <label class="ai-field-label">{{ mcpLabel }}</label>
    <div class="ai-context-row">
      <input
        v-model="mcpUrl"
        type="text"
        class="ai-context-input"
        v-bind:placeholder="mcpPlaceholder"
        autocomplete="off"
        spellcheck="false"
        v-on:change="saveMcp"
        v-on:blur="saveMcp"
      >
      <button type="button" class="ai-context-btn" v-bind:disabled="testing || mcpUrl.trim() === ''" v-on:click="testMcp">{{ testLabel }}</button>
      <button type="button" class="ai-context-btn" v-bind:disabled="mcpUrl.trim() === ''" v-on:click="clearMcp">{{ clearLabel }}</button>
    </div>
    <p class="ai-context-hint">{{ mcpHint }}</p>

    <!-- Active source -->
    <label class="ai-field-label">{{ activeLabel }}</label>
    <select v-model="source" class="ai-context-select" v-on:change="saveSource">
      <option value="none">{{ trans('None (off)') }}</option>
      <option value="folder">{{ trans('Folder group') }}</option>
      <option value="mcp">{{ trans('MCP server') }}</option>
      <option value="both">{{ trans('Both (folder + MCP)') }}</option>
    </select>

    <p v-if="status !== ''" class="ai-context-status">{{ status }}</p>
  </div>
</template>

<script setup lang="ts">
/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        AIContextControl
 * CVM-Role:        View
 * Maintainer:      Mint Stylus
 * License:         GNU GPL v3
 *
 * Description:     The "Context source" editor for the AI preferences tab. Lets
 *                  the user plug a local FOLDER GROUP or an MCP SERVER URL in as
 *                  extra context for every AI request, and pick which one is
 *                  active (mirrored by the Context dropdown in the main window's
 *                  top bar). Choosing a folder or entering an MCP URL turns the
 *                  corresponding source ON automatically. A "Test" button probes
 *                  the source and reports a short status. All folder reads / MCP
 *                  calls happen in the main-process AIProvider; this component
 *                  only stores config and shows status.
 *
 *                  ==== AI-created for Mint Stylus ====
 *
 * END HEADER
 */

import { ref } from 'vue'
import { trans } from '@common/i18n-renderer'

const folder = ref<string>(String(window.config.get('ai.contextFolder') ?? ''))
const mcpUrl = ref<string>(String(window.config.get('ai.contextMcpUrl') ?? ''))
const source = ref<string>(String(window.config.get('ai.contextSource') ?? 'none'))
const status = ref<string>('')
const testing = ref<boolean>(false)

const introText = trans('Give the AI extra context on every request from a local folder of notes or from an MCP server. Whichever you set up here becomes selectable in the "Context:" dropdown at the top of the editor — and turns on automatically the moment you pick a folder or enter an MCP URL.')
const folderLabel = trans('Local folder group')
const folderPlaceholder = trans('No folder chosen — click "Choose folder…"')
const mcpLabel = trans('MCP server URL')
const mcpPlaceholder = 'http://localhost:3000/mcp'
const mcpHint = trans('Any MCP server that speaks the Streamable HTTP transport. Its tools/resources are queried with your prompt and injected as context.')
const activeLabel = trans('Active context source')
const chooseLabel = trans('Choose folder…')
const testLabel = trans('Test')
const clearLabel = trans('Clear')

/**
 * Persists the folder path. A non-empty path turns the folder source ON.
 */
function saveFolder (): void {
  const value = folder.value.trim()
  folder.value = value
  window.config.set('ai.contextFolder', value)
  if (value !== '') {
    source.value = 'folder'
    window.config.set('ai.contextSource', 'folder')
  }
}

/**
 * Opens the native folder picker (in main) and stores the chosen path, turning
 * the folder source ON.
 */
function pickFolder (): void {
  window.ai.pickContextFolder()
    .then(chosen => {
      if (chosen !== '') {
        folder.value = chosen
        window.config.set('ai.contextFolder', chosen)
        source.value = 'folder'
        window.config.set('ai.contextSource', 'folder')
        status.value = ''
      }
    })
    .catch(err => console.error('Folder pick failed', err))
}

/**
 * Clears the folder path and, if it was the active source, turns context off.
 */
function clearFolder (): void {
  folder.value = ''
  window.config.set('ai.contextFolder', '')
  if (source.value === 'folder') {
    source.value = 'none'
    window.config.set('ai.contextSource', 'none')
  }
}

/**
 * Persists the MCP URL. A non-empty URL turns the MCP source ON.
 */
function saveMcp (): void {
  const value = mcpUrl.value.trim()
  mcpUrl.value = value
  window.config.set('ai.contextMcpUrl', value)
  if (value !== '') {
    source.value = 'mcp'
    window.config.set('ai.contextSource', 'mcp')
  }
}

/**
 * Clears the MCP URL and, if it was the active source, turns context off.
 */
function clearMcp (): void {
  mcpUrl.value = ''
  window.config.set('ai.contextMcpUrl', '')
  if (source.value === 'mcp') {
    source.value = 'none'
    window.config.set('ai.contextSource', 'none')
  }
}

/**
 * Persists the active source chosen in the dropdown.
 */
function saveSource (): void {
  window.config.set('ai.contextSource', source.value)
}

/**
 * Probes the folder source and shows a short status.
 */
function testFolder (): void {
  runTest({ source: 'folder', folder: folder.value.trim() })
}

/**
 * Probes the MCP source and shows a short status.
 */
function testMcp (): void {
  runTest({ source: 'mcp', url: mcpUrl.value.trim() })
}

function runTest (payload: { source: string, folder?: string, url?: string }): void {
  testing.value = true
  status.value = trans('Testing…')
  window.ai.testContext(payload)
    .then(result => { status.value = result })
    .catch(err => { status.value = `Test failed: ${err?.message ?? String(err)}` })
    .finally(() => { testing.value = false })
}
</script>

<style lang="less">
.ai-context-control {
  .ai-context-intro {
    font-size: 12px;
    color: rgb(120, 120, 120);
    margin: 0 0 12px 0;
  }

  .ai-field-label {
    display: block;
    font-weight: bold;
    margin: 12px 0 6px 0;
  }

  .ai-context-row {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;

    .ai-context-input {
      flex: 1 1 auto;
      min-width: 200px;
      padding: 6px 8px;
      border-radius: 6px;
      font-family: inherit;
    }

    .ai-context-btn {
      flex: 0 0 auto;
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid rgba(128, 128, 128, 0.4);
      background-color: transparent;
      color: inherit;
      cursor: pointer;
      font-size: 12px;
      white-space: nowrap;

      &:hover:not(:disabled) { background-color: rgba(128, 128, 128, 0.15); }
      &:disabled { opacity: 0.5; cursor: default; }
    }
  }

  .ai-context-select {
    padding: 6px 8px;
    border-radius: 6px;
  }

  .ai-context-hint {
    font-size: 11px;
    color: rgb(131, 131, 131);
    margin: 6px 0 0 0;
  }

  .ai-context-status {
    font-size: 12px;
    margin: 10px 0 0 0;
    padding: 6px 8px;
    border-radius: 6px;
    background-color: rgba(128, 128, 128, 0.12);
  }
}
</style>
