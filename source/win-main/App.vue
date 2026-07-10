<template>
  <WindowChrome
    v-bind:title="windowTitle"
    v-bind:titlebar="shouldShowTitlebar"
    v-bind:menubar="shouldShowMenubar"
    v-bind:show-toolbar="shouldShowToolbar"
    v-bind:toolbar-labels="false"
    v-bind:toolbar-controls="toolbarControls"
    v-bind:disable-vibrancy="!hasVibrancy"
    v-on:toolbar-toggle="handleToggle($event)"
    v-on:toolbar-click="handleClick($event)"
  >
    <SplitView
      ref="fileManagerSplitComponent"
      v-bind:initial-size-percent="fileManagerSplitComponentInitialSize"
      v-bind:minimum-size-percent="[ 10, 50 ]"
      v-bind:reset-size-percent="[ 20, 80 ]"
      v-bind:split="'horizontal'"
      v-on:views-resized="fileManagerSplitComponentResized($event)"
    >
      <template #view1>
        <!-- File manager in the left side of the split view -->
        <FileManager
          v-show="mainSplitViewVisibleComponent === 'fileManager'"
          ref="file-manager"
          v-bind:window-id="windowId"
        ></FileManager>
        <!-- ... or the global search, if selected -->
        <GlobalSearch
          v-show="mainSplitViewVisibleComponent === 'globalSearch'"
          ref="globalSearchComponent"
          v-bind:window-id="windowId"
          v-on:jtl="(filePath, lineNumber, newTab) => jtl(filePath, lineNumber, newTab)"
        >
        </GlobalSearch>
        <!-- ... or the AI panel, if an AI action opened it (Mint Stylus) -->
        <!-- AI-CREATED FOR MINT STYLUS -->
        <AIPanel
          v-show="mainSplitViewVisibleComponent === 'aiPanel'"
          v-on:replace-selection="handleAIReplaceSelection($event)"
          v-on:recover="handleAIRecover($event)"
        ></AIPanel>
      </template>
      <template #view2>
        <!-- AI-CREATED FOR MINT STYLUS: wrap the editor split so the AI question
             bar can sit above it (top-middle) without stealing the split's height -->
        <div class="editor-with-question-bar">
        <!-- AI question bar sits top-middle, above the editor/tabs (Mint Stylus);
             the GLOBAL thinking-level dropdown sits top-right of the same row.
             Every AI feature picks the level up automatically because the
             main-process AIProvider reads ai.thinkingLevel per request. -->
        <div class="question-bar-row">
          <QuestionBar v-on:ask="handleAskQuestion($event)"></QuestionBar>
          <!-- GLOBAL context-source dropdown: plug a local folder group or an MCP
               server in as extra context for every AI request. Selecting Folder/MCP
               with nothing configured immediately lets you plug it in, and turns
               context on automatically. -->
          <label
            class="ai-thinking-level ai-context-source"
            v-bind:title="contextTitle"
          >
            <span class="ai-thinking-level-label">{{ trans('Context:') }}</span>
            <select v-model="contextSource">
              <option value="none">{{ trans('None') }}</option>
              <option value="folder">{{ trans('Folder') }}</option>
              <option value="mcp">{{ trans('MCP') }}</option>
              <option value="both">{{ trans('Both') }}</option>
            </select>
          </label>
          <!-- GLOBAL AI-provider picker: choose WHICH AI (provider) every request
               goes to. Writes ai.provider (the same key Preferences uses); changing
               it reloads the Model list beside it. API keys stay in Preferences → AI
               / onboarding — this is just the quick switch. -->
          <label
            class="ai-thinking-level ai-provider-picker"
            v-bind:title="providerTitle"
          >
            <span class="ai-thinking-level-label">{{ trans('AI:') }}</span>
            <select v-model="currentProvider">
              <option
                v-for="slug in providerSlugs"
                v-bind:key="slug"
                v-bind:value="slug"
              >{{ providers[slug].label }}</option>
            </select>
          </label>
          <!-- GLOBAL model picker: choose the AI model for every request. A real
               dropdown (like Context/AI/Thinking) listing the current provider's
               live models, plus "(default)" and a "Custom…" entry that reveals a
               text box for any model id. Writes ai.model (the key Preferences uses). -->
          <label
            class="ai-thinking-level ai-model-picker"
            v-bind:title="modelTitle"
          >
            <span class="ai-thinking-level-label">{{ trans('Model:') }}</span>
            <select
              v-if="!modelCustomMode"
              v-model="modelSelectValue"
            >
              <option value="">{{ trans('(default)') }}</option>
              <option
                v-for="id in modelSelectOptions"
                v-bind:key="id"
                v-bind:value="id"
              >{{ id }}</option>
              <option value="__custom__">{{ trans('Custom…') }}</option>
            </select>
            <input
              v-else
              v-model="currentModel"
              class="ai-model-input"
              v-bind:placeholder="trans('model id')"
              autocomplete="off"
              spellcheck="false"
              ref="modelCustomInput"
              v-on:keydown.enter="modelCustomMode = false"
              v-on:blur="modelCustomMode = false"
            >
          </label>
          <label
            class="ai-thinking-level"
            v-bind:title="trans('Thinking level: how much reasoning effort the AI spends on every request (all AI features)')"
          >
            <span class="ai-thinking-level-label">{{ trans('Thinking:') }}</span>
            <select v-model="thinkingLevel">
              <option value="off">{{ trans('Off') }}</option>
              <option value="low">{{ trans('Low') }}</option>
              <option value="medium">{{ trans('Medium') }}</option>
              <option value="high">{{ trans('High') }}</option>
            </select>
          </label>
          <!-- WORKING-STATE status: a setting is not "set" until it actually works.
               This badge makes a real minimal request with the selected provider +
               model and shows the VERIFIED result (Ready / Not working / Checking),
               never just the commanded config. Auto-re-checks on every AI change;
               click to re-check (e.g. after adding a key in Preferences). -->
          <button
            type="button"
            class="ai-thinking-level ai-status-badge"
            v-bind:class="'ai-status-' + aiStatus"
            v-bind:title="aiStatusTitle"
            v-on:click="runAiHealthCheck()"
          >
            <span class="ai-status-dot"></span>
            <span class="ai-thinking-level-label">{{ aiStatusLabel }}</span>
          </button>
        </div>
        <!-- Another split view in the right side -->
        <SplitView
          ref="editorSidebarSplitComponent"
          class="editor-sidebar-split"
          v-bind:initial-size-percent="editorSidebarSplitComponentInitialSize"
          v-bind:minimum-size-percent="[ 50, 10 ]"
          v-bind:reset-size-percent="[ 80, 20 ]"
          v-bind:split="'horizontal'"
          v-on:views-resized="editorSidebarSplitComponentResized($event)"
        >
          <template #view1>
            <!-- First side: Editor -->
            <EditorPane
              v-if="paneConfiguration?.type === 'leaf'"
              v-bind:node="paneConfiguration"
              v-bind:leaf-id="paneConfiguration.id"
              v-bind:editor-commands="editorCommands"
              v-bind:window-id="windowId"
              v-on:global-search="startGlobalSearch($event)"
            ></EditorPane>
            <EditorBranch
              v-else-if="paneConfiguration !== undefined"
              v-bind:node="paneConfiguration"
              v-bind:window-id="windowId"
              v-bind:editor-commands="editorCommands"
              v-bind:is-last="true"
              v-on:global-search="startGlobalSearch($event)"
            ></EditorBranch>
          </template>
          <template #view2>
            <!-- Second side: Sidebar -->
            <MainSidebar
              v-on:move-section="moveSection($event)"
              v-on:jump-to-line="genericJtl($event)"
            ></MainSidebar>
          </template>
        </SplitView>
        </div>
      </template>
    </SplitView>
  </WindowChrome>

  <!-- Popover area: these will be teleported to the body element anyhow -->
  <PopoverExport
    v-if="showExportPopover && exportButton !== null && activeFile !== undefined"
    v-bind:target="exportButton"
    v-bind:file-path="activeFile.path"
    v-on:close="showExportPopover = false"
  ></PopoverExport>
  <PopoverStats
    v-if="showStatsPopover && statsButton !== null"
    v-bind:target="statsButton"
    v-on:close="showStatsPopover = false"
  ></PopoverStats>
  <PopoverTags
    v-if="showTagsPopover && tagsButton !== null"
    v-bind:target="tagsButton"
    v-on:close="showTagsPopover = false"
    v-on:search-tag="startGlobalSearch($event)"
  ></PopoverTags>
  <PopoverTable
    v-if="showTablePopover && tableButton !== null"
    v-bind:target="tableButton"
    v-on:close="showTablePopover = false"
    v-on:insert-table="insertTable($event)"
  ></PopoverTable>
  <PopoverDocInfo
    v-if="showDocInfoPopover && docInfoButton !== null && windowStateStore.activeDocumentInfo != null"
    v-bind:target="docInfoButton"
    v-bind:doc-info="windowStateStore.activeDocumentInfo"
    v-bind:should-count-chars="shouldCountChars"
    v-on:close="showDocInfoPopover = false"
  ></PopoverDocInfo>
  <PopoverPomodoro
    v-if="showPomodoroPopover && pomodoroButton !== null"
    v-bind:target="pomodoroButton"
    v-bind:pomodoro="pomodoro"
    v-bind:sound-effects="SOUND_EFFECTS"
    v-on:close="showPomodoroPopover = false"
    v-on:config="setPomodoroConfig($event)"
    v-on:start="startPomodoro()"
    v-on:stop="stopPomodoro()"
  ></PopoverPomodoro>
  <PopoverLRT
    v-if="showTasksPopover && tasksButton !== null"
    v-bind:target="tasksButton"
    v-on:close="showTasksPopover = false"
  ></PopoverLRT>
  <PopoverPandoc
    v-if="showPandocPopover && pandocButton !== null"
    v-bind:target="pandocButton"
    v-on:close="showPandocPopover = false"
    v-on:insert-pandoc="insertPandoc($event)"
  ></PopoverPandoc>
</template>

<script setup lang="ts">
/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        App
 * CVM-Role:        View
 * Maintainer:      Hendrik Erz
 * License:         GNU GPL v3
 *
 * Description:     This is the entry component for the main window.
 *
 * END HEADER
 */

import WindowChrome from '@common/vue/window/WindowChrome.vue'
import FileManager from './file-manager/FileManager.vue'
import MainSidebar from './sidebar/MainSidebar.vue'
import EditorPane from './EditorPane.vue'
import EditorBranch from './EditorBranch.vue'
import SplitView from '../common/vue/window/SplitView.vue'
import GlobalSearch from './GlobalSearch.vue'
import PopoverExport from './PopoverExport.vue'
import PopoverStats from './PopoverStats.vue'
import PopoverTags from './PopoverTags.vue'
import PopoverPomodoro from './PopoverPomodoro.vue'
import PopoverTable from './PopoverTable.vue'
import PopoverDocInfo from './PopoverDocInfo.vue'
import PopoverPandoc from './PopoverPandoc.vue'
// AI-CREATED FOR MINT STYLUS: AI panel + question bar + AI store
import AIPanel from './ai-panel/AIPanel.vue'
import QuestionBar from './ai-panel/QuestionBar.vue'
import { useAIStore, type AIRecoverEntry } from '../pinia/ai'
import { fiveWordSlugPrompt } from 'source/app/service-providers/ai/prompts'
// AI-CREATED FOR MINT STYLUS: resolve the active leaf's live CodeMirror editor
// so the AI surfaces can dispatch changes into it (see active-editor-registry).
import { getEditorForLeaf } from './ai-panel/active-editor-registry'
import { type AISelection } from '@common/modules/markdown-editor/plugins/ai-selection-menu'
import { type EditorView } from '@codemirror/view'
import { trans } from '@common/i18n-renderer'
// AI-CREATED FOR MINT STYLUS: provider catalogue for the top-bar AI (provider)
// picker — the SAME source of truth Preferences and onboarding use.
import { PROVIDERS, PROVIDER_SLUGS, DEFAULT_PROVIDER, isProviderSlug, getProviderInfo } from '@common/util/ai-providers'
import localiseNumber from '@common/util/localise-number'
import generateId from '@common/util/generate-id'
import {
  nextTick,
  ref,
  computed,
  watch,
  onMounted,
  onBeforeMount
} from 'vue'

// Import the sound effects for the pomodoro timer
import glassFile from './assets/glass.wav'
import alarmFile from './assets/digital_alarm.mp3'
import chimeFile from './assets/chime.mp3'
import { DocumentType, type LeafNodeJSON } from '@dts/common/documents'
import { buildPipeMarkdownTable } from '@common/util/build-pipe-markdown-table'
import { type UpdateState } from '@providers/updates'
import { type ToolbarControl } from '@common/vue/window/WindowToolbar.vue'
import getDocumentTitle from './util/get-document-title'
import { useConfigStore, useDocumentTreeStore, useLRTStore, useWindowStateStore } from 'source/pinia'
import type { ConfigOptions } from 'source/app/service-providers/config/get-config-template'
import { type AnyDescriptor } from 'source/types/common/fsal'
import type { DocumentManagerIPCAPI } from 'source/app/service-providers/documents'
import { TaskStatus } from 'source/pinia/lrt-store'
import PopoverLRT from './PopoverLRT.vue'

const ipcRenderer = window.ipc

const configStore = useConfigStore()
const documentTreeStore = useDocumentTreeStore()
const windowStateStore = useWindowStateStore()
const LRTStore = useLRTStore()
// AI-CREATED FOR MINT STYLUS: the renderer-side AI state store. It never holds a
// key; it only sends {command, payload} over the window.ai preload bridge.
const aiStore = useAIStore()

const SOUND_EFFECTS = [
  {
    file: glassFile,
    label: 'Glass'
  },
  {
    file: alarmFile,
    label: 'Digital Alarm'
  },
  {
    file: chimeFile,
    label: 'Chime'
  }
]

const searchParams = new URLSearchParams(window.location.search)
// The window number indicates which main window this one here is. This is only
// necessary for the documents and split views to show up.
const windowId = searchParams.get('window_id')!

const fileManagerVisible = computed<boolean>(() => configStore.config.window.fileManagerVisible)
// AI-CREATED FOR MINT STYLUS: 'aiPanel' added so the AI panel can share the
// left #view1 slot with the file manager and global search.
const mainSplitViewVisibleComponent = ref<'fileManager'|'globalSearch'|'aiPanel'>('fileManager')
const isUpdateAvailable = ref(false)
const hasVibrancy = computed(() => configStore.config.window.vibrancy && process.platform === 'darwin')

// Ensure the app remembers the previous sidebar sizes
const fileManagerSplitComponentInitialSize = ref<[number, number]>([ 20, 80 ])
const editorSidebarSplitComponentInitialSize = ref<[number, number]>([ 80, 20 ])
onBeforeMount(() => {
  fileManagerSplitComponentInitialSize.value = configStore.config.ui.fileManagerSplitSize
  editorSidebarSplitComponentInitialSize.value = configStore.config.ui.editorSidebarSplitSize
})

// Popover targets
const exportButton = ref<HTMLElement|null>(null)
const showExportPopover = ref<boolean>(false)
const statsButton = ref<HTMLElement|null>(null)
const showStatsPopover = ref<boolean>(false)
const tagsButton = ref<HTMLElement|null>(null)
const showTagsPopover = ref<boolean>(false)
const tableButton = ref<HTMLElement|null>(null)
const showTablePopover = ref<boolean>(false)
const docInfoButton = ref<HTMLElement|null>(null)
const showDocInfoPopover = ref<boolean>(false)
const pomodoroButton = ref<HTMLElement|null>(null)
const showPomodoroPopover = ref<boolean>(false)
const tasksButton = ref<HTMLElement|null>(null)
const showTasksPopover = ref(false)
const pandocButton = ref<HTMLElement|null>(null)
const showPandocPopover = ref<boolean>(false)

export interface PomodoroConfig {
  currentEffectFile: string
  soundEffect: HTMLAudioElement
  intervalHandle: ReturnType<typeof setInterval>|undefined
  popover: any
  durations: {
    task: number
    short: number
    long: number
  }
  phase: {
    type: 'task'|'short'|'long'
    elapsed: number
  }
  counter: {
    task: number
    short: number
    long: number
  }
  colour: {
    task: string
    short: string
    long: string
  }
}

const pomodoro = ref<PomodoroConfig>({
  currentEffectFile: glassFile,
  soundEffect: new Audio(glassFile),
  intervalHandle: undefined,
  popover: undefined,
  durations: { task: 1500, short: 300, long: 1200 },
  phase: { type: 'task', elapsed: 0 },
  counter: { task: 0, short: 0, long: 0 },
  colour: { task: '#ff3366', short: '#ddff00', long: '#33ffcc' }
})

/**
 * Okay, hear me out. We have the following situation: We have a toolbar, and
 * external components that want to tell the main editor to do something. But
 * Vue doesn't have a concept of events being passed down to child components
 * and since editors may now be nested arbitrarily deep, we have no direct way
 * of accessing the editors and tell them to do something. Basically, Vue's data
 * flow goes like this: Events flow up, and props flow down. That's it. So we're
 * using this hacky solution "misusing" props as events. This interface
 * represents all the potential editor commands that can be issued. The last
 * property can contain arbitrary data if required by the command. We'll be
 * passing this struct as a prop down to every EditorBranch and EditorPane into
 * the main editor components. Every editor instance then listens to these
 * events by watching property changes (i.e. when moveSection switches from true
 * to false) and testing if they are the last editor (the only identifying info
 * we can store in the state to not break things due to Vue's aggressive
 * reactivity). Then, the editors can act based on this info.
 *
 * One example:
 * 1. The app receives a jump to line-command. It then writes the necessary info
 *    (in this case, which line to jump to) into the `data` prop. That is not
 *    watched by the editors, but since it's part of the data structure, it will
 *    silently update in the background.
 * 2. Then, the app switches the jumpToLine-property (false->true or otherwise).
 *    Since that sub-property is being watched by the editors, it will trigger
 *    the watcher that then checks the lastLeafId in the state. If that
 *    corresponds to the editor's leaf ID, the editor calls the appropriate
 *    function locally, and executes the command, providing the data.
 */
export interface EditorCommands {
  jumpToLine: boolean
  moveSection: boolean
  addKeywords: boolean
  replaceSelection: boolean
  insertPandoc: boolean
  executeCommand: boolean
  data: any
}

// Editor commands state
const editorCommands = ref<EditorCommands>({
  jumpToLine: false,
  moveSection: false,
  addKeywords: false,
  replaceSelection: false,
  insertPandoc: false,
  executeCommand: false,
  data: undefined
})

const sidebarsBeforeDistractionfree = ref<{ fileManager: boolean, sidebar: boolean }>({
  fileManager: true,
  sidebar: false
})

const sidebarVisible = computed<boolean>(() => configStore.config.window.sidebarVisible)
const activeFile = computed(() => documentTreeStore.lastLeafActiveFile)
const shouldCountChars = computed<boolean>(() => configStore.config.editor.countChars)
const windowTitle = computed<string>(() => {
  if (activeFile.value === undefined) {
    return 'Mint Stylus'
  }

  return `Mint Stylus - ${getDocumentTitle(activeFile.value)}`
})

// Simple state machine to trigger which of the three shows up when. Below's the
// corresponding truth table, which is relatively large, but by spotting some
// patterns, we can see when which of the three Window Chrome elements shall be
// shown.
/*

| Platform | Hide Toolbar in DF? | Is DF? | Is FS? | Titlebar | Menubar | Toolbar |
|----------|---------------------|--------|--------|----------|---------|---------|
| Linux    | False               | False  | False  | False    | !native | True    |
| Linux    | False               | False  | True   | False    | !native | True    |
| Linux    | False               | True   | False  | False    | !native | True    |
| Linux    | False               | True   | True   | False    | !native | True    |
| Linux    | True                | False  | False  | False    | !native | True    |
| Linux    | True                | False  | True   | False    | !native | True    |
| Linux    | True                | True   | False  | False    | !native | False   |
| Linux    | True                | True   | True   | False    | !native | False   |
| macOS    | False               | False  | False  | False    | False   | True    |
| macOS    | False               | False  | True   | False    | False   | True    |
| macOS    | False               | True   | False  | False    | False   | True    |
| macOS    | False               | True   | True   | False    | False   | True    |
| macOS    | True                | False  | False  | False    | False   | True    |
| macOS    | True                | False  | True   | False    | False   | True    |
| macOS    | True                | True   | False  | True     | False   | False   |
| macOS    | True                | True   | True   | False    | False   | False   |
| Windows  | False               | False  | False  | False    | True    | True    |
| Windows  | False               | False  | True   | False    | True    | True    |
| Windows  | False               | True   | False  | False    | True    | True    |
| Windows  | False               | True   | True   | False    | True    | True    |
| Windows  | True                | False  | False  | False    | True    | True    |
| Windows  | True                | False  | True   | False    | True    | True    |
| Windows  | True                | True   | False  | False    | True    | False   |
| Windows  | True                | True   | True   | False    | True    | False   |

*/

// The titlebar shall be shown on the main window in only one single instance
const shouldShowTitlebar = computed<boolean>(() => process.platform === 'darwin' && configStore.config.display.hideToolbarInDistractionFree && distractionFree.value)
// The menubar is independent of other values; always shown on Windows, and on Linux only if native Appearance is off.
const shouldShowMenubar = computed<boolean>(() => process.platform === 'win32' || (process.platform !== 'darwin' && !configStore.config.window.nativeAppearance))

// Finally, the toolbar. That one is a bit more iffy. It is always shown, EXCEPT
// Hide Toolbar is True and DistractionFree is True
const shouldShowToolbar = computed<boolean>(() => !distractionFree.value || !configStore.config.display.hideToolbarInDistractionFree)

const parsedDocumentInfo = computed<string[]>(() => {
  const info = windowStateStore.activeDocumentInfo
  if (info == null) {
    return []
  }

  const lines: string[] = []

  if (info.selections.length > 0) {
    // We have selections to display.
    let length = 0
    info.selections.forEach(sel => {
      length += shouldCountChars.value ? sel.chars : sel.words
    })

    lines.push(trans('%s selected', localiseNumber(length)))
    if (info.selections.length === 1) {
      const { head, anchor } = info.selections[0]
      lines.push(`${anchor.line}:${anchor.ch} – ${head.line}:${head.ch}`)
    } else {
      // Multiple selections --> indicate
      lines.push(trans('%s selections', info.selections.length))
    }
  } else {
    // No selection.
    lines.push(shouldCountChars.value
      ? trans('%s characters', localiseNumber(info.chars))
      : trans('%s words', localiseNumber(info.words)))
    lines.push(`${info.cursor.line}:${info.cursor.ch}`)
  }

  return lines
})

// Long-Running-Task setup
const hasTasks = computed(() => LRTStore.tasks.length > 0)
const taskSuccess = computed(() => LRTStore.tasks.filter(t => t.status === TaskStatus.finished).length)
const taskAborted = computed(() => LRTStore.tasks.filter(t => t.status === TaskStatus.aborted).length)
const taskError = computed(() => LRTStore.tasks.filter(t => t.status === TaskStatus.error).length)
const taskOngoing = computed(() => LRTStore.tasks.filter(t => t.status === TaskStatus.ongoing).length)

const toolbarControls = computed<ToolbarControl[]>(() => {
  return [
    {
      type: 'three-way-toggle',
      id: 'toggle-file-manager',
      stateOne: {
        id: 'fileManager',
        title: trans('Toggle File Manager'),
        icon: 'hard-disk'
      },
      stateTwo: {
        id: 'globalSearch',
        title: trans('Search across all files'),
        icon: 'search'
      },
      initialState: (fileManagerVisible.value) ? mainSplitViewVisibleComponent.value : undefined
    },
    {
      type: 'button',
      id: 'root-open-workspaces',
      title: trans('Open workspace…'),
      icon: 'folder-open'
    },
    {
      type: 'button',
      id: 'show-stats',
      title: trans('View writing statistics'),
      icon: 'line-chart'
    },
    {
      type: 'button',
      id: 'show-tag-cloud',
      title: trans('View Tag Cloud'),
      icon: 'tag',
      badge: undefined // this.hasTagSuggestions
    },
    {
      type: 'button',
      id: 'open-preferences',
      title: trans('Open settings'),
      icon: 'cog',
      visible: getToolbarButtonDisplay('showOpenPreferencesButton')
    },
    {
      type: 'button',
      id: 'new-file',
      title: trans('New file…'),
      icon: 'plus',
      visible: getToolbarButtonDisplay('showNewFileButton')
    },
    {
      type: 'button',
      id: 'previous-file',
      title: trans('Previous file'),
      icon: 'arrow',
      direction: 'left',
      visible: getToolbarButtonDisplay('showPreviousFileButton')
    },
    {
      type: 'button',
      id: 'next-file',
      title: trans('Next file'),
      icon: 'arrow',
      direction: 'right',
      visible: getToolbarButtonDisplay('showNextFileButton')
    },
    {
      type: 'spacer',
      size: '3x'
    },
    {
      type: 'button',
      class: 'share',
      id: 'export',
      title: trans('Export current file'),
      icon: 'export'
    },
    {
      type: 'spacer',
      id: 'spacer-two',
      size: '1x'
    },
    {
      type: 'button',
      id: 'pandocDivOrSpan',
      title: trans('Insert Pandoc Div or Span'),
      icon: 'drag-handle',
      visible: getToolbarButtonDisplay('showPandocDivSpanButton')
    },
    {
      type: 'button',
      id: 'markdownComment',
      title: trans('Insert comment'),
      icon: 'code',
      visible: getToolbarButtonDisplay('showMarkdownCommentButton')
    },
    {
      type: 'button',
      id: 'markdownLink',
      title: trans('Insert link'),
      icon: 'link',
      visible: getToolbarButtonDisplay('showMarkdownLinkButton')
    },
    {
      type: 'button',
      id: 'markdownImage',
      title: trans('Insert image'),
      icon: 'image',
      visible: getToolbarButtonDisplay('showMarkdownImageButton')
    },
    {
      type: 'button',
      id: 'markdownMakeTaskList',
      title: trans('Insert task list'),
      icon: 'checkbox-list',
      visible: getToolbarButtonDisplay('showMarkdownMakeTaskListButton')
    },
    {
      type: 'button',
      id: 'insert-table',
      title: trans('Insert table'),
      icon: 'table',
      visible: getToolbarButtonDisplay('showInsertTableButton')
    },
    {
      type: 'button',
      id: 'insertFootnote',
      title: trans('Insert footnote'),
      icon: 'footnote',
      visible: getToolbarButtonDisplay('showInsertFootnoteButton')
    },
    {
      type: 'spacer',
      size: '3x'
    },
    {
      type: 'text',
      align: 'center',
      id: 'document-info',
      content: parsedDocumentInfo.value,
      visible: getToolbarButtonDisplay('showDocumentInfoText')
    },
    {
      type: 'spacer',
      size: '1x'
    },
    {
      type: 'ring',
      id: 'pomodoro',
      title: trans('Pomodoro timer'),
      // Good morning, we are verbose here
      progressPercent: pomodoro.value.phase.elapsed / pomodoro.value.durations[pomodoro.value.phase.type] * 100,
      colour: pomodoro.value.colour[pomodoro.value.phase.type],
      visible: getToolbarButtonDisplay('showPomodoroButton')
    },
    {
      type: 'iris-indicator',
      id: 'long-running-tasks',
      title: trans('Show tasks'),
      tasksInProgress: taskOngoing.value,
      tasksSuccess: taskSuccess.value,
      tasksFailed: taskError.value,
      tasksAborted: taskAborted.value,
      visible: hasTasks.value
    },
    {
      type: 'toggle',
      id: 'toggle-sidebar',
      title: trans('Toggle Sidebar'),
      icon: 'view-columns',
      initialState: sidebarVisible.value
    },
    {
      type: 'button',
      id: 'open-updater',
      title: trans('Update available'),
      showLabel: true,
      buttonText: trans('Update available'),
      icon: 'download',
      visible: isUpdateAvailable.value
    }
  ] satisfies ToolbarControl[]
})

const editorSidebarSplitComponent = ref<typeof SplitView|null>(null)
const fileManagerSplitComponent = ref<typeof SplitView|null>(null)
const globalSearchComponent = ref<typeof GlobalSearch|null>(null)
const paneConfiguration = computed(() => documentTreeStore.paneStructure)
const lastLeafId = computed(() => documentTreeStore.lastLeafId)
const distractionFree = computed<boolean>(() => windowStateStore.distractionFreeMode !== undefined)

watch(sidebarVisible, (newValue) => {
  if (newValue) {
    if (distractionFree.value) {
      if (windowStateStore.distractionFreeMode !== undefined) {
        windowStateStore.distractionFreeMode = undefined
      }
    }

    editorSidebarSplitComponent.value?.unhide()
  } else {
    editorSidebarSplitComponent.value?.hideView(2)
  }
})

watch(fileManagerVisible, (newValue) => {
  if (newValue) {
    if (distractionFree.value) {
      if (windowStateStore.distractionFreeMode !== undefined) {
        windowStateStore.distractionFreeMode = undefined
      }
    }

    fileManagerSplitComponent.value?.unhide()
  } else {
    fileManagerSplitComponent.value?.hideView(1)
  }
})

watch(mainSplitViewVisibleComponent, (newValue) => {
  if (newValue === 'globalSearch') {
    // The global search just became visible, so focus the query input
    nextTick().then(() => {
      globalSearchComponent.value?.focusQueryInput()
    }).catch(e => console.error(e))
  }
})

// AI-CREATED FOR MINT STYLUS: when any AI surface opens the panel (Summarize
// bubble, an AI command, the QQ flow, or the question bar), slide the AI panel
// into the left #view1 slot. We reveal the left pane (fileManagerVisible drives
// its visibility) so the panel is actually shown, and remember what was there
// before so closing the panel restores the previous left-pane component.
// AI-CREATED FOR MINT STYLUS: the selection range the Summarize bubble (or an
// AI command) captured at invocation time. The panel later emits the chosen
// replacement text; we apply it over THIS range (and keep it up to date as the
// range's contents change) rather than the live selection, which may have moved.
const pendingSummarizeSelection = ref<AISelection|null>(null)

// AI-CREATED FOR MINT STYLUS: the GLOBAL thinking-level (reasoning effort)
// selector shown top-right of the question-bar row. Backed by the reactive
// config store so it stays correct even if the value is changed from another
// window (e.g. Preferences). The main-process AIProvider reads ai.thinkingLevel
// on EVERY request, so all AI features pick the new level up immediately.
const thinkingLevel = computed<string>({
  get: () => String(configStore.config.ai.thinkingLevel ?? 'off'),
  set: (value: string) => { configStore.setConfigValue('ai.thinkingLevel', value) }
})

// AI-CREATED FOR MINT STYLUS: the GLOBAL AI-provider picker (top-right, before
// Model). Choose WHICH AI (provider) every request goes to. Backed by the reactive
// config store (ai.provider — the SAME key Preferences uses), so the top bar and
// Preferences never drift; the main-process AIProvider resolves the endpoint +
// default model from the provider on every request. Setting it triggers the
// existing `watch(ai.provider)` above, which reloads the Model datalist — matching
// Preferences' onProviderChange (which likewise reloads models and leaves ai.model
// alone). API keys are managed in Preferences → AI / onboarding, not here.
const providers = PROVIDERS
const providerSlugs = PROVIDER_SLUGS
const currentProvider = computed<string>({
  get: () => {
    const slug = String(configStore.config.ai.provider ?? '')
    return isProviderSlug(slug) ? slug : DEFAULT_PROVIDER
  },
  set: (value: string) => {
    if (isProviderSlug(value)) {
      configStore.setConfigValue('ai.provider', value)
    }
  }
})

const providerTitle = computed<string>(() => {
  const label = getProviderInfo(currentProvider.value).label
  return trans('AI provider: every request goes to %s. Switch providers here; set the provider\'s API key in Preferences → AI.', label)
})

// AI-CREATED FOR MINT STYLUS: the GLOBAL model picker (top-right, next to
// Thinking). A combobox: it is populated with the current provider's real model
// list (window.ai.listModels) but also accepts any typed model id. Backed by the
// reactive config store (ai.model — the SAME key Preferences uses), so the two
// surfaces never drift; the main-process AIProvider reads ai.model on every
// request. Empty = the provider's default model.
const currentModel = computed<string>({
  get: () => String(configStore.config.ai.model ?? ''),
  set: (value: string) => { configStore.setConfigValue('ai.model', value.trim()) }
})

// The Model control is a real <select> (like Context/AI/Thinking) so the model
// list is an obvious dropdown, not a bare text field. `modelCustomMode` swaps it
// for a text input when the user picks "Custom…", preserving the type-any-id
// ability. `modelCustomInput` lets us focus that box the instant it appears.
const modelCustomMode = ref<boolean>(false)
const modelCustomInput = ref<HTMLInputElement | null>(null)

// The options the <select> lists: the provider's fetched models, PLUS the current
// value if it is a custom id not in that list (so a model set in Preferences, or a
// just-typed custom id, is never hidden and stays selected).
const modelSelectOptions = computed<string[]>(() => {
  const opts = [...modelOptions.value]
  const cur = currentModel.value
  if (cur !== '' && !opts.includes(cur)) {
    opts.unshift(cur)
  }
  return opts
})

// Bridges the <select> to ai.model. '' = provider default. Picking "Custom…"
// (value "__custom__") does NOT write config — it reveals the text box instead.
const modelSelectValue = computed<string>({
  get: () => currentModel.value, // always '' or present in modelSelectOptions
  set: (value: string) => {
    if (value === '__custom__') {
      modelCustomMode.value = true
      void nextTick().then(() => modelCustomInput.value?.focus())
      return
    }
    modelCustomMode.value = false
    currentModel.value = value
  }
})

const modelTitle = computed<string>(() => {
  const provider = String(configStore.config.ai.provider ?? '')
  const m = currentModel.value
  return m !== ''
    ? trans('Model: %s (for every AI request). Pick from the list or type any id; blank = provider default.', m)
    : trans('Model: using the %s provider default. Pick from the list or type any model id.', provider || 'current')
})

// The provider's real model list, fetched from main (fails quietly when there is
// no key yet — the user can still type an id). Reloaded on mount and whenever the
// provider changes.
const modelOptions = ref<string[]>([])
async function loadModels (): Promise<void> {
  try {
    const raw = await window.ai.listModels(String(configStore.config.ai.provider ?? '') || undefined)
    const ids = (Array.isArray(raw) ? raw : [])
      .map((m: any) => String(m?.id ?? m?.name ?? m ?? '').trim())
      .filter((id: string) => id !== '')
    modelOptions.value = Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b)).slice(0, 300)
  } catch (err) {
    modelOptions.value = []
  }
}
watch(() => configStore.config.ai.provider, () => { void loadModels() })
onMounted(() => { void loadModels() })

// AI-CREATED FOR MINT STYLUS: WORKING-STATE health check. A picked provider/model
// is only meaningful if it actually responds — so we don't trust the commanded
// config; we PROBE it (a real minimal completion via window.ai.testConnection) and
// the top-bar badge reflects the verified result. Re-runs (debounced) on every
// provider/model change and on mount; the badge is also click-to-recheck (e.g.
// right after adding a key in Preferences, which doesn't change provider/model).
type AiHealthStatus = 'idle' | 'testing' | 'ok' | 'error'
const aiStatus = ref<AiHealthStatus>('idle')
const aiStatusError = ref<string>('')
// Monotonic token so a slow probe that returns after a newer one can't overwrite
// the fresher result (race guard).
let aiHealthSeq = 0
let aiHealthTimer: ReturnType<typeof setTimeout> | undefined

async function runAiHealthCheck (): Promise<void> {
  const seq = ++aiHealthSeq
  aiStatus.value = 'testing'
  aiStatusError.value = ''
  try {
    const res = await window.ai.testConnection({
      provider: currentProvider.value,
      model: currentModel.value
    })
    if (seq !== aiHealthSeq) {
      return // superseded by a newer check — ignore this stale result
    }
    if (res.ok) {
      aiStatus.value = 'ok'
    } else {
      aiStatus.value = 'error'
      aiStatusError.value = res.error ?? trans('The selected AI did not respond.')
    }
  } catch (err: any) {
    if (seq !== aiHealthSeq) {
      return
    }
    aiStatus.value = 'error'
    aiStatusError.value = err?.message ?? String(err)
  }
}

function scheduleAiHealthCheck (): void {
  if (aiHealthTimer !== undefined) {
    clearTimeout(aiHealthTimer)
  }
  aiHealthTimer = setTimeout(() => { void runAiHealthCheck() }, 600)
}

// Re-probe whenever the effective AI selection changes (provider, model, or the
// custom base URL for the Custom provider).
watch(
  () => [ configStore.config.ai.provider, configStore.config.ai.model, configStore.config.ai.baseURL ],
  () => { scheduleAiHealthCheck() }
)
onMounted(() => { void runAiHealthCheck() })

const aiStatusLabel = computed<string>(() => {
  switch (aiStatus.value) {
    case 'testing': return trans('Checking…')
    case 'ok': return trans('Ready')
    case 'error': return trans('Not working')
    default: return trans('Test AI')
  }
})

const aiStatusTitle = computed<string>(() => {
  switch (aiStatus.value) {
    case 'testing': return trans('Checking whether the selected AI actually responds…')
    case 'ok': return trans('Verified: the selected provider and model responded to a live request. Click to re-check.')
    case 'error': return trans('This AI is NOT working: %s — click to re-check (add a key in Preferences → AI if needed).', aiStatusError.value)
    default: return trans('Click to check whether the selected AI actually works (sends a tiny live request).')
  }
})

// AI-CREATED FOR MINT STYLUS: the GLOBAL context-source selector (top-right,
// next to Thinking). 'none' | 'folder' | 'mcp'. Backed by the reactive config
// store, so it reflects the active source even when changed from Preferences and
// so it AUTO-REVERTS when the user cancels a pick (the dropdown always mirrors
// what is actually configured). The main-process AIProvider reads ai.contextSource
// on every request and injects the folder/MCP context.
const contextSource = computed<string>({
  get: () => String(configStore.config.ai.contextSource ?? 'none'),
  set: (value: string) => { handleContextSelection(value) }
})

const contextTitle = computed<string>(() => {
  const value = contextSource.value
  if (value === 'folder') {
    const folder = String(configStore.config.ai.contextFolder ?? '')
    return folder !== ''
      ? trans('Context: pulling from your folder group (%s). Change it in Preferences → AI.', folder)
      : trans('Context: choose a local folder group to pull context from.')
  }
  if (value === 'mcp') {
    const url = String(configStore.config.ai.contextMcpUrl ?? '')
    return url !== ''
      ? trans('Context: querying your MCP server (%s). Change it in Preferences → AI.', url)
      : trans('Context: add an MCP server URL in Preferences → AI to pull context from.')
  }
  if (value === 'both') {
    return trans('Context: using BOTH your folder group and your MCP server. Configure them in Preferences → AI.')
  }
  return trans('Context: pick a folder group, an MCP server, or both to give the AI extra context on every request.')
})

/**
 * Handles a change of the context-source dropdown. Because the dropdown is bound
 * to the reactive config, doing nothing here (e.g. on cancel) leaves the select
 * showing whatever is actually configured — it auto-reverts.
 *
 *  - Folder with nothing configured → open the native folder picker; on success
 *    store the folder and turn the folder source ON.
 *  - MCP with nothing configured → open Preferences → AI (window.prompt is not
 *    available in Electron); entering a URL there turns MCP on and this dropdown
 *    re-syncs automatically.
 *  - An already-configured source, or None → just switch.
 *
 * @param  {string}  source  The newly-selected source.
 */
function handleContextSelection (source: string): void {
  if (source === 'folder') {
    // Use the synchronous config bridge for the existence check so it is always
    // current (the reactive store can lag a set by up to ~50ms). The dropdown's
    // displayed value stays bound to the reactive store for cross-window sync.
    const existing = String(window.config.get('ai.contextFolder') ?? '')
    if (existing === '') {
      window.ai.pickContextFolder()
        .then(folderPath => {
          if (folderPath !== '') {
            configStore.setConfigValue('ai.contextFolder', folderPath)
            configStore.setConfigValue('ai.contextSource', 'folder')
          }
          // Cancelled → change nothing; the dropdown mirrors config and reverts.
        })
        .catch(err => console.error('Folder pick failed', err))
      return
    }
    configStore.setConfigValue('ai.contextSource', 'folder')
    return
  }

  if (source === 'mcp') {
    const existing = String(window.config.get('ai.contextMcpUrl') ?? '')
    if (existing === '') {
      // No URL yet — route to the Preferences Context panel (which has a proper
      // URL field + Test). window.prompt throws under Electron, so never use it.
      ipcRenderer.invoke('application', { command: 'open-preferences' })
        .catch(e => console.error(e))
      return
    }
    configStore.setConfigValue('ai.contextSource', 'mcp')
    return
  }

  if (source === 'both') {
    // 'Both' uses whatever is configured; the main process degrades gracefully to
    // the source(s) that exist. Turn it on, then help fill in a missing half:
    // if there's no folder, open the picker; if nothing is configured at all,
    // open Preferences so the user can set up both sources there.
    const folder = String(window.config.get('ai.contextFolder') ?? '')
    const url = String(window.config.get('ai.contextMcpUrl') ?? '')
    configStore.setConfigValue('ai.contextSource', 'both')
    if (folder === '' && url === '') {
      ipcRenderer.invoke('application', { command: 'open-preferences' })
        .catch(e => console.error(e))
    } else if (folder === '') {
      window.ai.pickContextFolder()
        .then(folderPath => {
          if (folderPath !== '') {
            configStore.setConfigValue('ai.contextFolder', folderPath)
          }
        })
        .catch(err => console.error('Folder pick failed', err))
    }
    return
  }

  configStore.setConfigValue('ai.contextSource', 'none')
}

const leftComponentBeforeAI = ref<'fileManager'|'globalSearch'>('fileManager')
watch(() => aiStore.panelOpen, (isOpen) => {
  if (isOpen) {
    if (mainSplitViewVisibleComponent.value !== 'aiPanel') {
      leftComponentBeforeAI.value = mainSplitViewVisibleComponent.value
    }
    configStore.setConfigValue('window.fileManagerVisible', true)
    mainSplitViewVisibleComponent.value = 'aiPanel'
  } else if (mainSplitViewVisibleComponent.value === 'aiPanel') {
    // Restore whatever occupied the left pane before the AI panel opened.
    mainSplitViewVisibleComponent.value = leftComponentBeforeAI.value
  }
})

watch(distractionFree, (newValue) => {
  if (newValue) {
    // Enter distraction free mode
    sidebarsBeforeDistractionfree.value = {
      fileManager: fileManagerVisible.value,
      sidebar: sidebarVisible.value
    }
    configStore.setConfigValue('window.sidebarVisible', false)
    configStore.setConfigValue('window.fileManagerVisible', false)
  } else {
    // Leave distraction free mode
    configStore.setConfigValue('window.sidebarVisible', sidebarsBeforeDistractionfree.value.sidebar)
    configStore.setConfigValue('window.fileManagerVisible', sidebarsBeforeDistractionfree.value.fileManager)
  }
})

onMounted(() => {
  exportButton.value = document.querySelector('#toolbar-export')
  statsButton.value = document.querySelector('#toolbar-show-stats')
  tagsButton.value = document.querySelector('#toolbar-show-tag-cloud')
  tableButton.value = document.querySelector('#toolbar-insert-table')
  docInfoButton.value = document.querySelector('#toolbar-document-info')
  pomodoroButton.value = document.querySelector('#toolbar-pomodoro')
  tasksButton.value = document.querySelector('#toolbar-long-running-tasks')
  pandocButton.value = document.querySelector('#toolbar-pandocDivOrSpan')

  ipcRenderer.on('shortcut', (event, shortcut, payload?: unknown) => {
    // AI-CREATED FOR MINT STYLUS: the AI-command menu entries may arrive as a
    // `shortcut` with an { command } payload (depending on how the
    // menu-command-handlers seam forwards them). Handle that here in addition to
    // the dedicated `ai-command` channel registered below.
    if (shortcut === 'ai-command') {
      const preset = extractCommandPreset(payload)
      if (preset !== undefined) {
        runAICommandPreset(preset)
      }
      return
    }

    if (shortcut === 'toggle-sidebar') {
      configStore.setConfigValue('window.sidebarVisible', !sidebarVisible.value)
    } else if (shortcut === 'insert-id') {
      editorCommands.value.data = generateId(configStore.config.zkn.idGen)
      editorCommands.value.replaceSelection = !editorCommands.value.replaceSelection
    } else if (shortcut === 'copy-current-id' && documentTreeStore.lastLeafActiveFile !== undefined) {
      ipcRenderer.invoke('fsal', {
        command: 'get-descriptor',
        payload: documentTreeStore.lastLeafActiveFile.path
      })
        .then((descriptor: AnyDescriptor|undefined) => {
          if (descriptor?.type === 'file' && descriptor?.id !== '') {
            navigator.clipboard.writeText(descriptor.id).catch(err => console.error(err))
          }
        })
        .catch(err => console.error(err))
    } else if (shortcut === 'global-search') {
      configStore.setConfigValue('window.fileManagerVisible', true)
      mainSplitViewVisibleComponent.value = 'globalSearch'
      // Focus input
      nextTick()
        .then(() => { globalSearchComponent.value?.focusQueryInput() })
        .catch(err => console.error(err))
    } else if (shortcut === 'toggle-file-manager') {
      if (fileManagerVisible.value && mainSplitViewVisibleComponent.value === 'fileManager') {
        configStore.setConfigValue('window.fileManagerVisible', false)
      } else if (!fileManagerVisible.value) {
        configStore.setConfigValue('window.fileManagerVisible', true)
        mainSplitViewVisibleComponent.value = 'fileManager'
      } else if (mainSplitViewVisibleComponent.value === 'globalSearch') {
        mainSplitViewVisibleComponent.value = 'fileManager'
      }
    } else if (shortcut === 'filter-files') {
      // We need to immediately make the file manager visible, which will
      // -- in the next tick -- focus its filter input.
      configStore.setConfigValue('window.fileManagerVisible', true)
      mainSplitViewVisibleComponent.value = 'fileManager'
    } else if (shortcut === 'export') {
      showExportPopover.value = true
    } else if (shortcut === 'print') {
      if (activeFile.value !== undefined) {
        ipcRenderer.invoke('application', { command: 'print', payload: activeFile.value.path })
          .catch(err => console.error(err))
      }
    } else if (shortcut === 'navigate-back') {
      ipcRenderer.invoke('documents-provider', {
        command: 'navigate-back',
        payload: {
          windowId,
          leafId: lastLeafId.value
        }
      } as DocumentManagerIPCAPI).catch(err => console.error(err))
    } else if (shortcut === 'navigate-forward') {
      ipcRenderer.invoke('documents-provider', {
        command: 'navigate-forward',
        payload: {
          windowId,
          leafId: lastLeafId.value
        }
      } as DocumentManagerIPCAPI).catch(err => console.error(err))
    }
  })

  // AI-CREATED FOR MINT STYLUS -----------------------------------------------
  //
  // The AI selection bubble (a central CM6 extension with no access to the Pinia
  // store) re-broadcasts the user's selection as DOM CustomEvents on `window`.
  // We listen here, remember the exact {from,to,text} so we can later replace
  // precisely that range, and drive the AI store.
  window.addEventListener('mint-ai-summarize', handleSummarizeEvent as EventListener)
  window.addEventListener('mint-ai-command', handleCommandEvent as EventListener)
  window.addEventListener('mint-ai-run-command', handleRunCommandEvent as EventListener)

  // The AI-command menu entries run the main-process `ai-command` command, which
  // forwards to the renderer. We accept it on a dedicated `ai-command` channel
  // AND (defensively) as a `shortcut` payload, since the exact channel is owned
  // by the menu-command-handlers seam. Both resolve the current selection (or the
  // whole page) and run the command through the store.
  ipcRenderer.on('ai-command', (_event, payload?: unknown) => {
    const preset = extractCommandPreset(payload)
    if (preset !== undefined) {
      runAICommandPreset(preset)
    }
  })

  // Initially, we need to hide the sidebar, since the view will be visible
  // by default.
  if (!sidebarVisible.value) {
    editorSidebarSplitComponent.value?.hideView(2)
  }

  // Similarly, if the file manager is set to hidden, do that, too.
  if (!fileManagerVisible.value) {
    fileManagerSplitComponent.value?.hideView(1)
  }

  // Check if there is an update available.
  ipcRenderer.invoke('update-provider', { command: 'update-status' })
    .then((state: UpdateState) => {
      isUpdateAvailable.value = state.updateAvailable
    })
    .catch(err => console.error(err))

  // Also, listen for any changes in the update available state
  ipcRenderer.on('update-provider', (event, command: string, updateState: UpdateState) => {
    if (command === 'state-changed') {
      isUpdateAvailable.value = updateState.updateAvailable
    }
  })
})

function fileManagerSplitComponentResized (sizes: [number, number]): void {
  configStore.setConfigValue('ui.fileManagerSplitSize', sizes)
}

function editorSidebarSplitComponentResized (sizes: [number, number]): void {
  configStore.setConfigValue('ui.editorSidebarSplitSize', sizes)
}

function insertTable (spec: { rows: number, cols: number }): void {
  // Generate a simple table based on the info, and insert it.
  const align: Array<'center'|'left'|'right'|null> = Array(spec.cols).fill(null)
  const row = (): string[] => Array(spec.cols).fill('')
  const ast: string[][] = Array.from({ length: spec.rows }, row)

  editorCommands.value.data = buildPipeMarkdownTable(ast, align)
  editorCommands.value.replaceSelection = !editorCommands.value.replaceSelection
}

function insertPandoc (spec: { type: string, attributes: string }): void {
  editorCommands.value.data = spec
  editorCommands.value.insertPandoc = !editorCommands.value.insertPandoc
}

function genericJtl (lineNumber: number): void {
  // This function is called from the sidebar where we already know the file
  // is open (because its editor component has provided the table of
  // contents in the first place).
  const doc = documentTreeStore.lastLeafActiveFile
  if (doc !== undefined) {
    editorCommands.value.data = { filePath: doc.path, lineNumber }
    editorCommands.value.jumpToLine = !editorCommands.value.jumpToLine
  }
}

function jtl (filePath: string, lineNumber: number, newTab: boolean): void {
  // We need to make sure the given file is (a) open somewhere and (b) the
  // active file.

  // Simplest case: The file is already active somewhere
  const activeFileLeaf = documentTreeStore.paneData
    .find((pane: LeafNodeJSON) => pane.activeFile?.path === filePath)
  if (activeFileLeaf !== undefined) {
    // There is at least one leaf with the given file being active, so we
    // can simply emit the event
    editorCommands.value.data = { filePath, lineNumber }
    editorCommands.value.jumpToLine = !editorCommands.value.jumpToLine
    return
  }

  const WAIT_TIME = 100 // How long to wait before re-executing the jtl()

  // Next, let's see if the file is at least open somewhere
  const containingLeaf = documentTreeStore.paneData
    .find((pane: LeafNodeJSON) => {
      return pane.openFiles.find(doc => doc.path === filePath) !== undefined
    })
  if (containingLeaf !== undefined) {
    // Let's first make it the active file and then execute the command
    ipcRenderer.invoke('documents-provider', {
      command: 'open-file',
      payload: { path: filePath, windowId, leafId: containingLeaf.id }
    } as DocumentManagerIPCAPI)
      .then(() => {
        // Re-execute the jtl command
        setTimeout(() => jtl(filePath, lineNumber, newTab), WAIT_TIME)
      })
      .catch(e => console.error(e))
    return
  }

  // If we're here, the file was not open, so we have to do that first. At
  // least this both makes it an open file AND an active file somewhere in
  // the window.
  ipcRenderer.invoke('documents-provider', {
    command: 'open-file',
    payload: {
      path: filePath,
      windowId,
      leafId: lastLeafId.value,
      newTab
    }
  } as DocumentManagerIPCAPI)
    .then(() => {
      // Re-execute the jtl command
      setTimeout(() => jtl(filePath, lineNumber, newTab), WAIT_TIME)
    })
    .catch(e => console.error(e))
}

function moveSection (data: { from: number, to: number }): void {
  editorCommands.value.data = { from: data.from, to: data.to }
  editorCommands.value.moveSection = !editorCommands.value.moveSection
}

function startGlobalSearch (terms: string): void {
  mainSplitViewVisibleComponent.value = 'globalSearch'
  configStore.setConfigValue('window.fileManagerVisible', true)
  nextTick()
    .then(() => {
      globalSearchComponent.value?.startSearch(terms)
    })
    .catch(err => console.error(err))
}

// AI-CREATED FOR MINT STYLUS ---------------------------------------------------
//
// The top hover question bar emits `ask` with a trimmed question. We turn that
// into a brand-new conversation document, auto-named from a <=5-word slug the
// AIProvider generates, saved BESIDE the most-recently-active file, seeded with
// the question, and then we open the AI panel in conversation mode and kick off
// the exchange. All AI/HTTP work happens in main via the window.ai bridge; the
// renderer never touches a key.

/**
 * Returns the directory portion of an absolute path, coping with both POSIX and
 * Windows separators. We avoid importing node's `path` into the renderer (this
 * SFC never does) and only need a dirname here.
 *
 * @param   {string}  absPath  An absolute file path.
 * @return  {string}           The containing directory, or '' if none found.
 */
function dirnameOf (absPath: string): string {
  const idx = Math.max(absPath.lastIndexOf('/'), absPath.lastIndexOf('\\'))
  return idx > 0 ? absPath.slice(0, idx) : ''
}

async function handleAskQuestion (question: string): Promise<void> {
  const trimmed = question.trim()
  if (trimmed === '') {
    return
  }

  // 1) Ask the AIProvider (in main) for a <=5-word kebab-case filename slug.
  //    fiveWordSlugPrompt is a pure prompt builder; the actual model call
  //    happens in main behind window.ai.chat.
  let slug = 'new-conversation'
  try {
    const raw = await window.ai.chat({ messages: fiveWordSlugPrompt(trimmed) })
    // Normalise: first non-empty line, lower-kebab, strip anything unsafe.
    const candidate = raw
      .split('\n')
      .map(l => l.trim())
      .find(l => l.length > 0) ?? ''
    const cleaned = candidate
      .toLowerCase()
      .replace(/[^a-z0-9\- ]+/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    if (cleaned.length > 0) {
      slug = cleaned
    }
  } catch (err) {
    // A failed slug must not block the flow — fall back to the default name.
    console.error('Could not generate a filename slug for the new conversation', err)
  }

  // 2) Resolve the directory of the most-recently-active file so the new doc is
  //    saved BESIDE it. If nothing is open, file-new falls back to the current
  //    workspace / documents directory on its own (path left undefined).
  const lastPath = documentTreeStore.lastLeafActiveFile?.path
  const dir = lastPath !== undefined ? dirnameOf(lastPath) : ''

  // 3) Create + open the new markdown document via the existing file-new command
  //    bridge (same path handleClick uses). Providing `name` skips the save
  //    dialog; providing `path` saves it beside the last file.
  try {
    await ipcRenderer.invoke('application', {
      command: 'file-new',
      payload: {
        type: DocumentType.Markdown,
        name: `${slug}.md`,
        windowId,
        leafId: lastLeafId.value,
        ...(dir !== '' ? { path: dir } : {})
      }
    })
  } catch (err) {
    console.error('Could not create the new conversation document', err)
    return
  }

  // 4) Seed the freshly-opened (now active) document with the question, using
  //    the existing prop-as-event editor bridge. replaceSelection inserts the
  //    data at the cursor of the active editor (the new empty doc).
  editorCommands.value.data = `# ${trimmed}\n\n`
  editorCommands.value.replaceSelection = !editorCommands.value.replaceSelection

  // 5) Open the AI panel in conversation mode and start the exchange. openPanel
  //    (via askConversation) flips panelOpen, which our watcher turns into the
  //    left-pane AI panel becoming visible.
  aiStore.openPanel('conversation')
  await aiStore.askConversation(trimmed)
}

/**
 * Resolves the live CodeMirror EditorView backing the currently-active leaf, or
 * undefined when the active leaf has no Markdown editor mounted (e.g. it is
 * showing an image/PDF viewer, or nothing is open). The active leaf is the one
 * the document tree store last focused.
 *
 * @return  {import('@codemirror/view').EditorView|undefined}  The active view.
 */
function activeEditorView (): EditorView|undefined {
  const editor = getEditorForLeaf(documentTreeStore.lastLeafId)
  return editor?.instance
}

/**
 * Normalises the various payload shapes an `ai-command` message may arrive in
 * (a bare preset string, or an `{ command }` object) into a non-empty preset
 * string, or undefined when the payload carries no usable preset.
 *
 * @param   {unknown}          payload  The raw IPC payload.
 *
 * @return  {string|undefined}          The preset name, or undefined.
 */
function extractCommandPreset (payload: unknown): string|undefined {
  let preset: unknown
  if (typeof payload === 'string') {
    preset = payload
  } else if (payload !== null && typeof payload === 'object' && 'command' in payload) {
    preset = (payload as { command: unknown }).command
  }
  return typeof preset === 'string' && preset.length > 0 ? preset : undefined
}

/**
 * Handles the `mint-ai-summarize` DOM CustomEvent dispatched by the AI selection
 * bubble. Remembers the exact captured range so a chosen rewrite can later be
 * applied over it, then runs the Summarize flow through the store (which opens
 * the panel and requests the rewrite options).
 *
 * @param  {CustomEvent<AISelection>}  event  The selection payload.
 */
function handleSummarizeEvent (event: CustomEvent<AISelection>): void {
  const selection = event.detail
  if (selection === undefined || selection.text.trim() === '') {
    return
  }
  pendingSummarizeSelection.value = { ...selection }
  aiStore.runSummarize(selection.text).catch(err => console.error('AI Summarize failed', err))
}

/**
 * Handles the `mint-ai-command` DOM CustomEvent dispatched by the AI selection
 * bubble's "Command" button. We remember the range (so a command that produces
 * a replacement could reuse it), hand the selection text (+ the whole document
 * as page context) to the store as its pending selection, and open the panel in
 * command mode WITHOUT running anything yet: the panel then renders the command
 * chooser (the five preset buttons + a free-text instruction input) against
 * exactly this selection. NOTE: This event carries no preset — concrete presets
 * arrive via the `ai-command` IPC channel from the AI menu and route straight
 * through runAICommandPreset instead.
 *
 * @param  {CustomEvent<AISelection>}  event  The selection payload.
 */
function handleCommandEvent (event: CustomEvent<AISelection>): void {
  const selection = event.detail
  if (selection === undefined || selection.text.trim() === '') {
    return
  }
  pendingSummarizeSelection.value = { ...selection }
  const view = activeEditorView()
  aiStore.setPendingSelection({
    text: selection.text,
    pageContext: view !== undefined ? view.state.sliceDoc() : undefined
  })
  aiStore.openPanel('command')
}

/**
 * Handles the `mint-ai-run-command` DOM CustomEvent dispatched by the AI
 * selection bubble's quick command buttons (Shorten / Summarize / Synonyms /
 * Alternatives). Runs the chosen command directly on the selection — one click,
 * no chooser — passing the whole document as context. The command itself is
 * scoped to the selection in the store (buildCommandMessages), so it transforms
 * only the highlighted text while still seeing the full page.
 *
 * @param  {CustomEvent}  event  Detail: { commandId, selection }.
 */
function handleRunCommandEvent (event: CustomEvent<{ commandId: string, selection: AISelection }>): void {
  const detail = event.detail
  const selection = detail?.selection
  const commandId = detail?.commandId
  if (selection === undefined || typeof commandId !== 'string' || selection.text.trim() === '') {
    return
  }
  // One run at a time — a second quick-command click while one is in flight
  // would race the pending selection and clobber the panel mid-stream.
  if (aiStore.inFlight) {
    return
  }
  // Remember the exact range so a summarize-flow command's options can replace it.
  pendingSummarizeSelection.value = { ...selection }
  const view = activeEditorView()
  const pageContext = view !== undefined ? view.state.sliceDoc() : undefined
  aiStore.setPendingSelection({ text: selection.text, pageContext })
  aiStore.runCommand(commandId, selection.text, pageContext)
    .catch(err => console.error(`AI command "${commandId}" failed`, err))
}

/**
 * Runs a named AI command preset (from the AI menu, e.g. `SHORTEN`,
 * `CHALLENGE_IDEA`) against the current editor selection, falling back to the
 * whole page when there is no selection. The whole document is always passed as
 * page context. All model work happens in main behind the store.
 *
 * @param  {string}  preset  The command preset name.
 */
function runAICommandPreset (preset: string): void {
  const view = activeEditorView()
  if (view === undefined) {
    // Nothing to act upon (no Markdown editor active) — still open the panel so
    // the user gets feedback rather than a silent no-op.
    aiStore.openPanel('command')
    return
  }

  const sel = view.state.selection.main
  const pageContext = view.state.sliceDoc()
  let input: string
  if (!sel.empty) {
    input = view.state.sliceDoc(sel.from, sel.to)
    // Remember the range so a future "apply" could target it.
    pendingSummarizeSelection.value = { from: sel.from, to: sel.to, text: input }
    // Also mirror it into the store so the panel can show what the command is
    // acting on (and so the command chooser targets it after this run).
    aiStore.setPendingSelection({ text: input, pageContext })
  } else {
    input = pageContext
    pendingSummarizeSelection.value = null
    // The command acts on the whole page: mirror that into the store so the
    // panel shows the correct excerpt (and never a stale earlier selection).
    aiStore.setPendingSelection({ text: input, pageContext })
  }

  aiStore.runCommand(preset, input, pageContext).catch(err => console.error(`AI command "${preset}" failed`, err))
}

/**
 * Applies a chosen Summarize rewrite to the editor. The AIPanel emits the chosen
 * replacement text; App.vue owns the authoritative {from,to} of the pending
 * selection. We stash the original text onto the store's recover stack BEFORE
 * dispatching (so it can be recovered), dispatch the change, and advance the
 * pending range to cover the freshly-inserted text so a subsequent option
 * replaces the previous one rather than stale offsets.
 *
 * @param  {string}  insert  The chosen replacement text.
 */
function handleAIReplaceSelection (insert: string): void {
  const pending = pendingSummarizeSelection.value
  const view = activeEditorView()
  if (pending === null || view === undefined) {
    return
  }

  const docLength = view.state.doc.length
  // Clamp the remembered range to the current document bounds; the user may have
  // edited elsewhere since the selection was captured.
  const from = Math.min(pending.from, docLength)
  const to = Math.min(pending.to, docLength)
  if (from > to) {
    return
  }

  const original = view.state.sliceDoc(from, to)

  // INTEGRITY GUARD: only replace if the range still holds the exact text the
  // options were generated for. If the user edited the document (offsets have
  // shifted) or switched to a different file (the offsets address unrelated
  // text), the slice no longer matches and dispatching would silently corrupt
  // the wrong text. Bail instead — the user can re-select and re-run.
  if (original !== pending.text) {
    console.warn('[AI] Not applying the option: the selected text changed since the options were generated. Re-select and run again.')
    return
  }

  // Stash the original so it can be recovered. The stored {from,to} describes the
  // range the NEW text will occupy after this dispatch, so Recover can overwrite
  // exactly that with the original; `replacement` lets Recover verify the range
  // still holds this insert before reversing.
  aiStore.pushSummarizeReplacement({ from, to: from + insert.length, original, replacement: insert })

  view.dispatch({ changes: { from, to, insert } })

  // Advance the pending range so a further option click replaces the text we just
  // inserted, not the now-stale original span.
  pendingSummarizeSelection.value = { from, to: from + insert.length, text: insert }

  view.focus()
}

/**
 * Recovers a previously-replaced original. The AIPanel emits the stashed entry;
 * we dispatch the reverse change (re-inserting `entry.original` over the range
 * the replacement now occupies) and pop the store's recover stack. If the popped
 * entry is not the one clicked (the stack is LIFO), we still reverse the clicked
 * entry's range — the panel offers the most-recent entry first.
 *
 * @param  {AIRecoverEntry}  entry  The stashed original to restore.
 */
function handleAIRecover (entry: AIRecoverEntry): void {
  const view = activeEditorView()
  if (view === undefined) {
    return
  }

  const docLength = view.state.doc.length
  const from = Math.min(entry.from, docLength)
  const to = Math.min(entry.to, docLength)
  if (from > to) {
    return
  }

  // INTEGRITY GUARD (mirror of handleAIReplaceSelection): only reverse if the
  // range still holds the replacement we inserted. After unrelated edits or a
  // file switch the offsets address different text — bail rather than corrupt.
  if (typeof entry.replacement === 'string' && view.state.sliceDoc(from, to) !== entry.replacement) {
    console.warn('[AI] Not recovering: the document changed since this replacement was applied.')
    return
  }

  view.dispatch({ changes: { from, to, insert: entry.original } })

  // Pop the recover stack. The panel presents the most-recent entry first, which
  // is the top of the LIFO stack, so recoverLast() drops the entry we just
  // reversed in the common case.
  aiStore.recoverLast()

  // Keep the pending range coherent for any follow-up replace.
  pendingSummarizeSelection.value = { from, to: from + entry.original.length, text: entry.original }

  view.focus()
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function toggleFileList (): void {
  // This event can be used by various components to ask the file manager to
  // toggle its file list visibility
  fileManagerSplitComponent.value?.toggleFileList()
}

function handleClick (clickedID?: string): void {
  if (clickedID === 'root-open-workspaces') {
    ipcRenderer.invoke('application', { command: 'root-open-workspaces' })
      .catch(e => console.error(e))
  } else if (clickedID === 'open-preferences') {
    ipcRenderer.invoke('application', { command: 'open-preferences' })
      .catch(e => console.error(e))
  } else if (clickedID === 'new-file') {
    ipcRenderer.invoke('application', { command: 'file-new', payload: { type: DocumentType.Markdown } })
      .catch(e => console.error(e))
  } else if (clickedID === 'previous-file') {
    ipcRenderer.invoke('documents-provider', {
      command: 'navigate-back',
      payload: {
        windowId,
        leafId: lastLeafId.value
      }
    } as DocumentManagerIPCAPI).catch(err => console.error(err))
  } else if (clickedID === 'next-file') {
    ipcRenderer.invoke('documents-provider', {
      command: 'navigate-forward',
      payload: {
        windowId,
        leafId: lastLeafId.value
      }
    } as DocumentManagerIPCAPI).catch(err => console.error(err))
  } else if (clickedID === 'export') {
    showExportPopover.value = !showExportPopover.value
  } else if (clickedID === 'show-stats') {
    // The user wants to display the stats
    showStatsPopover.value = !showStatsPopover.value
  } else if (clickedID === 'show-tag-cloud') {
    showTagsPopover.value = !showTagsPopover.value
    // TODO startGlobalSearch('#' + data.searchForTag)
    // editorCommands.value.data = data.suggestions
    // editorCommands.value.addKeywords = !editorCommands.value.addKeywords
  } else if (clickedID === 'pomodoro') {
    showPomodoroPopover.value = !showPomodoroPopover.value
  } else if (clickedID === 'insert-table') {
    // Display the insertion popover
    showTablePopover.value = !showTablePopover.value
  } else if (clickedID === 'long-running-tasks') {
    // The tasks button is only mounted conditionally
    tasksButton.value = document.querySelector('#toolbar-long-running-tasks')
    showTasksPopover.value = !showTasksPopover.value
  } else if (clickedID === 'document-info') {
    showDocInfoPopover.value = !showDocInfoPopover.value
  } else if (clickedID === 'pandocDivOrSpan') {
    showPandocPopover.value = !showPandocPopover.value
  } else if (clickedID !== undefined && clickedID.startsWith('markdown') && clickedID.length > 8) {
    // The user clicked a command button, so we just have to run that.
    editorCommands.value.data = clickedID
    editorCommands.value.executeCommand = !editorCommands.value.executeCommand
  } else if (clickedID === 'insertFootnote') {
    editorCommands.value.data = clickedID
    editorCommands.value.executeCommand = !editorCommands.value.executeCommand
  } else if (clickedID === 'open-updater') {
    ipcRenderer.invoke('application', {
      command: 'open-update-window'
    })
      .catch(err => console.error(err))
  }
}

function setPomodoroConfig (config: PomodoroConfig): void {
  // Update the durations as necessary
  pomodoro.value.durations.task = config.durations.task
  pomodoro.value.durations.short = config.durations.short
  pomodoro.value.durations.long = config.durations.long

  const effectChanged = config.currentEffectFile !== pomodoro.value.currentEffectFile
  const volumeChanged = config.soundEffect.volume !== pomodoro.value.soundEffect.volume
  if (effectChanged) {
    pomodoro.value.currentEffectFile = config.currentEffectFile
    pomodoro.value.soundEffect = new Audio(config.currentEffectFile)
    pomodoro.value.soundEffect.volume = config.soundEffect.volume
  }
  if (!effectChanged && volumeChanged) {
    pomodoro.value.soundEffect.volume = config.soundEffect.volume
  }

  if (effectChanged || volumeChanged) {
    pomodoro.value.soundEffect.pause()
    pomodoro.value.soundEffect.currentTime = 0
    pomodoro.value.soundEffect.play().catch(_e => {
      /* We will be getting errors when pausing quickly */
    })
  }
}

function handleToggle (controlState: { id?: string, state?: string | boolean }): void {
  const { id, state } = controlState
  if (id === 'toggle-sidebar') {
    configStore.setConfigValue('window.sidebarVisible', state)
  } else if (id === 'toggle-file-manager') {
    // Since this is a three-way-toggle, we have to inspect the state.
    configStore.setConfigValue('window.fileManagerVisible', state !== undefined)
    if (typeof state === 'string' && (state === 'fileManager' || state === 'globalSearch')) {
      // Set the shown component to the correct one
      mainSplitViewVisibleComponent.value = state
    } else {
      console.warn(`Could not toggle main split component; expected state to be 'fileManager' or 'globalSearch', received ${state}`)
    }
  }
}

function startPomodoro (): void {
  pomodoro.value.soundEffect.pause()
  pomodoro.value.soundEffect.currentTime = 0
  // Starts a new pomodoro timer
  pomodoro.value.phase.type = 'task'
  pomodoro.value.phase.elapsed = 0

  pomodoro.value.intervalHandle = setInterval(() => {
    pomodoroTick()
  }, 1000)
}

function pomodoroTick (): void {
  // Progresses the pomodoro counter by one second
  pomodoro.value.phase.elapsed += 1

  const currentPhaseDur = pomodoro.value.durations[pomodoro.value.phase.type]
  const phaseIsFinished = pomodoro.value.phase.elapsed === currentPhaseDur

  if (phaseIsFinished) {
    pomodoro.value.phase.elapsed = 0
    pomodoro.value.counter[pomodoro.value.phase.type] += 1

    if (pomodoro.value.phase.type === 'task' && pomodoro.value.counter.task % 4 === 0) {
      pomodoro.value.phase.type = 'long'
    } else if (pomodoro.value.phase.type === 'task') {
      pomodoro.value.phase.type = 'short'
    } else {
      // Both breaks lead to a new task
      pomodoro.value.phase.type = 'task'
    }

    pomodoro.value.soundEffect.play().catch(_e => { /* We will be getting errors when pausing quickly */ })
  }

  // Finally handle the popover logic
  if (pomodoro.value.popover !== undefined && pomodoro.value.popover.isClosed() === false) {
    // The popover is visible, so let's update the data. Good thing is, we
    // only really need to update two things: The current task, and the
    // elapsed time.
    pomodoro.value.popover.updateData({
      internalCurrentPhase: pomodoro.value.phase.type,
      internalElapsed: pomodoro.value.phase.elapsed
    })
  } else if (pomodoro.value.popover !== undefined && pomodoro.value.popover.isClosed() === true) {
    pomodoro.value.popover = undefined // Cleanup
  }
}

function stopPomodoro (): void {
  pomodoro.value.soundEffect.pause()
  pomodoro.value.soundEffect.currentTime = 0
  // Stops the pomodoro timer
  pomodoro.value.phase.type = 'task'
  pomodoro.value.phase.elapsed = 0
  pomodoro.value.counter.task = 0
  pomodoro.value.counter.short = 0
  pomodoro.value.counter.long = 0

  if (pomodoro.value.intervalHandle !== undefined) {
    clearInterval(pomodoro.value.intervalHandle)
    pomodoro.value.intervalHandle = undefined
  }
}

function getToolbarButtonDisplay (configName: keyof ConfigOptions['displayToolbarButtons']): boolean {
  return configStore.config.displayToolbarButtons[configName]
}
</script>

<style lang="css" scoped>
/* AI-CREATED FOR MINT STYLUS: keep the question bar auto-height and let the
   editor/sidebar split fill the remaining height of the right pane. */
.editor-with-question-bar {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.editor-with-question-bar .editor-sidebar-split {
  flex: 1 1 auto;
  min-height: 0;
}

/* AI-CREATED FOR MINT STYLUS: the question bar and the global thinking-level
   dropdown share one slim top row; the dropdown hugs the right edge. */
.question-bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  row-gap: 4px;
  padding: 0 8px;
  /* Never let the AI controls (esp. the working-state badge) clip off the right
     edge on a narrow window: wrap to a second line instead. On a wide window the
     question bar grows and everything stays on one line. */
  flex-wrap: wrap;
}

.question-bar-row .ai-question-bar {
  /* Small flex-basis (NOT its 100%/480px width) so, with flex-wrap on the row,
     the question bar shares the first line with the AI controls and only wraps
     them to a second line when the window is genuinely too narrow — rather than
     claiming the whole first line and pushing every control down. It still grows
     to fill leftover space on a wide window. */
  flex: 1 1 120px;
  min-width: 0;
}

.ai-thinking-level {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  opacity: 0.75;
  cursor: pointer;
}

.ai-thinking-level:hover {
  opacity: 1;
}

.ai-thinking-level .ai-thinking-level-label {
  white-space: nowrap;
}

.ai-thinking-level select {
  height: 20px;
  font-size: 11px;
  /* Opaque, theme-correct colours. Previously this used `color: inherit` +
     a translucent background, which the native OS <option> popup composited
     to white-on-white in the dark theme (the near-transparent background
     rendered as solid white while the inherited text was also white). Both
     the closed control and the option popup now get solid, contrasting
     colours in each theme. */
  color: var(--grey-7);
  background-color: var(--grey-0);
  border: 1px solid var(--grey-2);
  border-radius: 10px;
  padding: 0 4px;
  cursor: pointer;
}

/* The native option popup takes these explicit opaque colours so it can never
   fall back to a translucent (white-on-white) background. */
.ai-thinking-level select option {
  color: var(--grey-7);
  background-color: var(--grey-0);
}

body.dark .ai-thinking-level select,
body.dark .ai-thinking-level select option {
  color: var(--grey-0);
  background-color: var(--grey-6);
  border-color: var(--grey-5);
}

/* The top-bar model combobox mirrors the select styling (legible in both themes)
   and is a touch wider since model ids are long. */
.ai-thinking-level .ai-model-input {
  height: 20px;
  width: 130px;
  font-size: 11px;
  color: var(--grey-7);
  background-color: var(--grey-0);
  border: 1px solid var(--grey-2);
  border-radius: 10px;
  padding: 0 6px;
}

.ai-thinking-level .ai-model-input::placeholder {
  color: var(--grey-4);
  opacity: 0.8;
}

body.dark .ai-thinking-level .ai-model-input {
  color: var(--grey-0);
  background-color: var(--grey-6);
  border-color: var(--grey-5);
}

/* Model ids can be long (e.g. ~anthropic/claude-fable-latest). Bound the model
   <select> width so a long selected id can't blow out the top-bar flex row; the
   native control clips/ellipsises the closed label, the popup still shows full. */
.ai-thinking-level.ai-model-picker select {
  max-width: 130px;
}

/* Working-state status badge: a coloured dot + label showing the VERIFIED health
   of the selected AI — green = a live request succeeded, red = it failed (tooltip
   has the reason), amber pulse = checking. It's a <button> (click to re-check) so
   it reads as an action, not another config select. */
.ai-thinking-level.ai-status-badge {
  border: none;
  background: transparent;
  font: inherit;
  padding: 0 4px;
  gap: 5px;
}
.ai-status-badge .ai-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: 0 0 auto;
  background-color: var(--grey-4);
}
.ai-status-ok .ai-status-dot { background-color: #2ecc71; }
.ai-status-error .ai-status-dot { background-color: #e74c3c; }
.ai-status-testing .ai-status-dot {
  background-color: #f39c12;
  animation: ai-status-pulse 1s ease-in-out infinite;
}
@keyframes ai-status-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
}
</style>
