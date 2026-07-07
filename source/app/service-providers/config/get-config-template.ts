/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        getConfigTemplate utility function
 * CVM-Role:        <none>
 * Maintainer:      Hendrik Erz
 * License:         GNU GPL v3
 *
 * Description:     Returns a functional template to be used by the config provider.
 *
 * END HEADER
 */

import { app, nativeTheme } from 'electron'
import * as bcp47 from 'bcp-47'
import { v4 as uuid4 } from 'uuid'
import getLanguageFile from '@common/util/get-language-file'
import { defaultAICommands, type AICommandConfig } from '@providers/ai/ai-commands'

export type MarkdownTheme = 'berlin'|'frankfurt'|'bielefeld'|'karl-marx-stadt'|'bordeaux'

// This is a handy interface to add groups of file types to the settings in
// order to allow users to display them in filemanager and/or sidebar, and open
// internally or externally.
// NOTE: The generics are meant so that you can restrict certain groupings.
// E.g., FileTypeSettings<true, false, 'zettlr'> enforces these values for the
// three properties.
interface FileTypeSettings<F = boolean, S = boolean, O = 'zettlr'|'system'> {
  showInFilemanager: F
  showInSidebar: S
  openWith: O
}

/**
 * This type describes an entry of the ignored rules array in the config. We
 * define this type here, and not in the LanguageTool command, because if we
 * change its structure, bad things could happen. By colocating it with the
 * config, it is harder for us to forget to write a migration rule if we ever
 * change this structure.
 */
export interface LanguageToolIgnoredRuleEntry {
  /**
   * The description of the rule (usually localized).
   */
  description: string
  /**
   * The unique ID of this rule.
   */
  id: string
  /**
   * The category for this rule.
   */
  category: string
}

export interface ConfigOptions {
  version: string
  buildDate: string
  uuid: string
  appLang: string

  darkMode: boolean
  darkModeEditor: 'match'|'light'|'dark'
  autoDarkMode: 'off'|'system'|'schedule'
  autoDarkModeStart: string
  autoDarkModeEnd: string

  openDirectory: string|null
  attachmentExtensions: string[]
  alwaysReloadFiles: boolean
  muteLines: boolean

  // NOTE to everyone: These options (and possibly others) that pertain to the
  // file manager should slowly be migrated into the fileManager group below.
  fileManagerMode: 'thin'|'combined'|'expanded'
  fileManagerShowFiles: boolean
  fileManagerShowWorkspaces: boolean
  fileMeta: boolean
  fileMetaTime: 'modtime'|'creationtime'
  sorting: 'natural'|'ascii'
  sortFoldersFirst: boolean
  fileNameDisplay: 'filename'|'title'|'heading'|'title+heading'

  // NOTE to everyone: The various filemanager options (see above) should over
  // time be migrated into this group.
  fileManager: {
    twoStepCollapseWorkspaces: boolean
    // If this is true, the config will never attempt to auto-sort workspaces.
    sortWorkspacesManually: boolean
  }

  newFileNamePattern: string
  newFileDontPrompt: boolean
  selectedDicts: string[]

  debug: boolean
  checkForBeta: boolean

  app: {
    openFiles: string[]
    openWorkspaces: string[]
  }

  dialogPaths: {
    askFileDialog: string
    askDirDialog: string
    askLangFileDialog: string
  }
  export: {
    dir: 'temp'|'cwd'|'ask'
    stripTags: boolean
    autoOpenExportedFiles: boolean
    enforceMarkSupport: boolean
    stripLinks: 'full'|'unlink'|'no'
    cslLibrary: string
    cslStyle: string
    useBundledPandoc: boolean
    exportQmdWithQuarto: boolean
    customCommands: Array<{ displayName: string, command: string }>
    selectedProfiles: Array<{ filePath: string, profile: string }>
    lastUsedProfile: string
  }
  zkn: {
    idRE: string
    idGen: string
    linkAddFileTitle: boolean
    linkWithIDIfPossible: boolean
    linkFormat: 'link|title'|'title|link'
    autoSearch: boolean
    customDirectory: string
  }
  editor: {
    autocompleteSuggestEmojis: boolean
    snippetAutocompleteTriggerCharacter: ':'
    autoSave: 'off'|'immediately'|'delayed'
    citeStyle: 'in-text'|'in-text-suffix'|'regular'
    autoCloseBrackets: boolean
    showLinkPreviews: boolean
    showStatusbar: boolean
    showFormattingToolbar: boolean
    showWhitespace: boolean
    showMarkdownLineNumbers: boolean
    defaultSaveImagePath: string
    enableTableHelper: boolean
    indentUnit: number
    indentWithTabs: boolean
    alwaysIndentLineOnTab: boolean
    fontSize: number
    countChars: boolean
    inputMode: 'default'|'vim'|'emacs'
    boldFormatting: '**'|'__'
    italicFormatting: '_'|'*'
    highlightFormatting: 'span'|'=='
    readabilityAlgorithm: 'dale-chall'|'gunning-fog'|'coleman-liau'|'automated-readability'
    lint: {
      markdown: boolean
      languageTool: {
        active: boolean
        level: 'picky'|'default'
        motherTongue: string // e.g., en-US, de-DE
        variants: {
          en: string
          de: string
          pt: string
          ca: string
        }
        ignoredRules: LanguageToolIgnoredRuleEntry[]
        provider: 'official'|'custom'
        customServer: string
        username: string
        apiKey: string
      }
    }
    autoCorrect: {
      active: boolean
      magicQuotes: {
        primary: string
        secondary: string
      }
      replacements: Array<{ key: string, value: string }>
      matchWholeWords: boolean
    }
  }
  display: {
    theme: MarkdownTheme
    hideToolbarInDistractionFree: boolean
    markdownFileExtensions: boolean
    previewModeShowSyntaxWhenCursorIsAdjacent: boolean
    imageWidth: number
    imageHeight: number
    renderingMode: 'preview'|'raw'
    renderCitations: boolean
    renderIframes: boolean
    renderImages: boolean
    renderLinks: boolean
    renderMath: boolean
    renderTasks: boolean
    renderHTags: boolean
    renderEmphasis: boolean
    renderPandoc: boolean
    renderHorizontalRules: boolean
  }
  files: {
    // Built-in files cannot be shown in the sidebar, will always be shown in
    // the file manager, and will always be opened with Mint Stylus.
    builtin: FileTypeSettings<true, false, 'zettlr'>
    // Images and PDFs can be entirely hidden or shown everywhere, and opened
    // with the system default, or in Mint Stylus
    images: FileTypeSettings
    pdf: FileTypeSettings
    // These file types can be shown anywhere, but are not open-able by Mint Stylus.
    msoffice: FileTypeSettings<boolean, boolean, 'system'>
    openOffice: FileTypeSettings<boolean, boolean, 'system'>
    dataFiles: FileTypeSettings<boolean, boolean, 'system'>
    dotFiles: FileTypeSettings<boolean, boolean>
  }
  watchdog: {
    activatePolling: boolean
    stabilityThreshold: number
  }
  window: {
    nativeAppearance: boolean
    vibrancy: boolean
    sidebarVisible: boolean
    fileManagerVisible: boolean
    currentSidebarTab: 'toc'|'references'|'relatedFiles'|'attachments'
    recentGlobalSearches: string[]
  }
  // Mint Stylus AI configuration (added for the AI-native fork). All HTTP calls
  // and API keys live exclusively in the main-process AIProvider; the renderer
  // never sees a key. The base URL and model are derived AUTOMATICALLY from the
  // provider (see PROVIDERS in @common/util/ai-providers) — baseURL/model are
  // optional advanced overrides (empty by default), never surfaced in the UI.
  ai: {
    provider: 'openrouter'|'zai'|'ollama-cloud'|'ollama-local'|'custom'
    baseURL: string
    model: string
    searchProvider: 'tavily'|'brave'|'none'
    styleFilePath: string
    // Global reasoning-effort level applied to EVERY AI request (all features).
    // 'off' sends no reasoning fields at all; providers that don't support
    // reasoning ignore the field harmlessly.
    thinkingLevel: 'off'|'low'|'medium'|'high'
    // The user-editable AI commands (the five built-ins plus any the user adds).
    // Each carries an editable prompt and a `flow` (summarize|stream). See
    // DEFAULT via defaultAICommands() in @providers/ai/ai-commands.
    commands: AICommandConfig[]
    // Extra context injected into every AI request. 'none' = off; 'folder' =
    // grep the selected local folder group; 'mcp' = query the MCP server URL.
    // Auto-switches on when a folder is picked or an MCP URL is entered.
    contextSource: 'none'|'folder'|'mcp'
    contextFolder: string
    contextMcpUrl: string
  }
  ui: {
    fileManagerSplitSize: [number, number]
    editorSidebarSplitSize: [number, number]
  }
  system: {
    deleteOnFail: boolean
    leaveAppRunning: boolean
    avoidNewTabs: boolean
    iframeWhitelist: string[]
    checkForUpdates: boolean
    zoomBehavior: 'gui'|'editor'
  }
  displayToolbarButtons: {
    showOpenPreferencesButton: boolean
    showNewFileButton: boolean
    showPreviousFileButton: boolean
    showNextFileButton: boolean
    showPandocDivSpanButton: boolean
    showMarkdownCommentButton: boolean
    showMarkdownLinkButton: boolean
    showMarkdownImageButton: boolean
    showMarkdownMakeTaskListButton: boolean
    showInsertTableButton: boolean
    showInsertFootnoteButton: boolean
    showDocumentInfoText: boolean
    showPomodoroButton: boolean
  }
}

export function getConfigTemplate (): ConfigOptions {
  // Before returning the settings object, we have to make sure we retrieve a
  // locale that is both installed as a translation AND more or less the user's
  // wish.
  let locale = app.getLocale()
  let locSchema = bcp47.parse(locale)
  if (locSchema.language === undefined) {
    // Fall back to en-US
    locale = 'en-US'
  } else {
    // Return the best match that the app can find (only the tag).
    locale = getLanguageFile(locale).tag
  }

  // Return the complete configuration object
  return {
    version: app.getVersion(), // Useful for migrating
    buildDate: __BUILD_DATE__,
    app: {
      openFiles: [],
      openWorkspaces: []
    },
    openDirectory: null, // Save last opened dir path here
    dialogPaths: {
      askFileDialog: '',
      askDirDialog: '',
      askLangFileDialog: ''
    },
    window: {
      // Only use native window appearance by default on macOS. If this value
      // is false, this means that Mint Stylus will display the menu bar and window
      // controls as defined in the HTML.
      nativeAppearance: process.platform === 'darwin', // Linux only
      vibrancy: false,
      // Store a few GUI related settings here as well
      // Mint Stylus: file manager is closed by default.
      fileManagerVisible: false,
      sidebarVisible: false,
      currentSidebarTab: 'toc',
      recentGlobalSearches: []
    },
    ui: {
      fileManagerSplitSize: [ 20, 80 ],
      editorSidebarSplitSize: [ 80, 20 ]
    },
    // Mint Stylus AI defaults. The API key is stored securely by the main
    // process (never here, never in the renderer).
    ai: {
      provider: 'openrouter', // openrouter|zai|ollama-cloud|ollama-local|custom
      // The base URL is derived AUTOMATICALLY from the provider (see PROVIDERS
      // in @common/util/ai-providers). Empty by default; a non-empty value is an
      // advanced override that is never surfaced in the UI.
      baseURL: '',
      // Empty means "use the provider's default model" (see PROVIDERS).
      model: '',
      searchProvider: 'tavily', // tavily|brave|none
      styleFilePath: '', // Optional path to a user-provided style guide file
      thinkingLevel: 'off', // off|low|medium|high — global reasoning effort
      // The editable AI command set. Seeded with the five built-ins; the user
      // can rename/rewrite/re-flow them, add new commands, and reset built-ins.
      commands: defaultAICommands(),
      // Extra-context source for AI requests. Off by default; flips on to
      // 'folder'/'mcp' the moment the user picks a folder or enters an MCP URL.
      contextSource: 'none', // none|folder|mcp
      contextFolder: '', // absolute path to a local folder group
      contextMcpUrl: '' // MCP server URL (Streamable HTTP)
    },
    // Visible attachment filetypes
    attachmentExtensions: [],
    // UI related options
    darkMode: nativeTheme.shouldUseDarkColors,
    darkModeEditor: 'match', // Possible values: 'match', 'light', 'dark'
    alwaysReloadFiles: true, // Should Mint Stylus automatically load remote changes?
    autoDarkMode: 'system', // Possible values: 'off', 'system', 'schedule', 'auto'
    autoDarkModeStart: '21:00', // Switch into dark mode at this time
    autoDarkModeEnd: '06:00', // Switch to light mode at this time
    fileMeta: true,
    fileMetaTime: 'modtime', // The time to be displayed in file meta
    sorting: 'natural', // Can be natural or based on ASCII values
    sortFoldersFirst: true, // should folders be shown first in combined fileview
    muteLines: true, // Should the editor mute lines in distraction free mode?
    fileManagerMode: 'combined', // thin = Preview or directories visible --- expanded = both visible --- combined = tree view displays also files
    fileManagerShowFiles: true, // Allow users to persistently collapse or uncollapse the files and workspaces sections.
    fileManagerShowWorkspaces: true,
    fileNameDisplay: 'title+heading', // Controls what info is displayed as filenames
    fileManager: {
      twoStepCollapseWorkspaces: false,
      sortWorkspacesManually: false // By default, let Mint Stylus sort workspaces
    },
    newFileNamePattern: '%id.md',
    newFileDontPrompt: false, // If true immediately creates files
    export: {
      dir: 'temp', // Can either be "temp", "cwd" (current working directory) or "ask"
      stripTags: false, // Strip tags a.k.a. #tag
      autoOpenExportedFiles: true,
      enforceMarkSupport: true,
      stripLinks: 'full', // Strip internal links: "full" - remove completely, "unlink" - only remove brackets, "no" - don't alter
      cslLibrary: '', // Path to a CSL JSON library file
      cslStyle: '', // Path to a CSL Style file
      useBundledPandoc: true, // Whether to use the bundled Pandoc
      exportQmdWithQuarto: false, // Whether .qmd-files should be exported with Quarto
      customCommands: [], // Custom commands that the user can use to run arbitrary exports
      selectedProfiles: [], // Remembers the last chosen exporter per file for easy re-exporting
      lastUsedProfile: 'HTML.yaml' // Remembers the last chosen exporter for easy re-exporting
    },
    // Zettelkasten stuff (IDs, as well as link matchers)
    zkn: {
      idRE: '(\\d{14})',
      idGen: '%Y%M%D%h%m%s',
      linkAddFileTitle: true,
      linkWithIDIfPossible: false,
      linkFormat: 'link|title', // Determines what internal links ([[link|title]]) look like
      autoSearch: true, // Automatically start a search upon following a link?
      customDirectory: '' // If present, saves auto-created files here
    },
    // Editor related stuff
    editor: {
      autoSave: 'off',
      autocompleteSuggestEmojis: true,
      snippetAutocompleteTriggerCharacter: ':',
      autoCloseBrackets: true,
      showLinkPreviews: true, // Whether to fetch link previews in the editor
      showWhitespace: false,
      showMarkdownLineNumbers: false,
      defaultSaveImagePath: '',
      citeStyle: 'regular', // Determines how autocomplete will complete citations
      enableTableHelper: true, // Enable the table helper plugin
      indentUnit: 4, // The number of spaces to be added
      indentWithTabs: false,
      alwaysIndentLineOnTab: false, // Whether `Tab` always indents the current line
      fontSize: 18, // The editor's font size in pixels
      countChars: false, // Set to true to enable counting characters instead of words
      inputMode: 'default', // Can be default, vim, emacs
      boldFormatting: '**', // Can be ** or __
      italicFormatting: '_', // Can be * or _
      highlightFormatting: '==', // Can be 'span' or ==
      readabilityAlgorithm: 'dale-chall', // The algorithm to use with readability mode.
      showStatusbar: true,
      showFormattingToolbar: true,
      lint: {
        markdown: true, // Should Markdown be linted?
        languageTool: {
          active: false, // Utilize languageTool?
          level: 'picky', // API: https://languagetool.org/http-api/#!/default/post_check
          motherTongue: '', // Optional motherTongue property
          variants: {
            // These defaults are taken from LT's extension
            en: 'en-US',
            de: 'de-DE',
            pt: 'pt-PT',
            ca: 'ca-ES'
          },
          // This is an (initially empty) array of rules the user chose to
          // ignore globally.
          ignoredRules: [],
          provider: 'official',
          customServer: '',
          username: '',
          apiKey: ''
        }
      },
      autoCorrect: {
        active: true, // AutoCorrect is on by default
        magicQuotes: {
          // Can be various quote pairs. The default characters (" and ')
          // will disable magic quotes.
          primary: '"…"',
          secondary: "'…'"
        },
        replacements: [
          // Arrows
          { key: '-->', value: '→' },
          { key: '–>', value: '→' }, // For Word mode arrows
          { key: '<--', value: '←' },
          { key: '<->', value: '↔' },
          { key: '<-->', value: '↔' },
          { key: '==>', value: '⇒' },
          { key: '<==', value: '⇐' },
          { key: '<=>', value: '⇔' },
          { key: '<==>', value: '⇔' },
          // Mathematical symbols
          { key: '!=', value: '≠' },
          { key: '<>', value: '≠' },
          { key: '+-', value: '±' },
          { key: ':time:', value: '×' },
          { key: ':division:', value: '÷' },
          { key: '<=', value: '≤' },
          { key: '>=', value: '≥' },
          { key: '1/2', value: '½' },
          { key: '1/3', value: '⅓' },
          { key: '2/3', value: '⅔' },
          { key: '1/4', value: '¼' },
          { key: '3/4', value: '¾' },
          { key: '1/8', value: '⅛' },
          { key: '3/8', value: '⅜' },
          { key: '5/8', value: '⅝' },
          { key: '7/8', value: '⅞' },
          // Units
          { key: 'mm2', value: 'mm²' },
          { key: 'cm2', value: 'cm²' },
          { key: 'm2', value: 'm²' },
          { key: 'km2', value: 'km²' },
          { key: 'mm3', value: 'mm³' },
          { key: 'cm3', value: 'cm³' },
          { key: 'ccm', value: 'cm³' },
          { key: 'm3', value: 'm³' },
          { key: 'km3', value: 'km³' },
          { key: ':sup2:', value: '²' },
          { key: ':sup3:', value: '³' },
          { key: ':deg:', value: '°' },
          // Currencies
          { key: ':eur', value: '€' },
          { key: ':gbp', value: '£' },
          { key: ':yen', value: '¥' },
          { key: ':cent', value: '¢' },
          { key: ':inr:', value: '₹' },
          // Special symbols
          { key: '(c)', value: '©' },
          { key: '(tm)', value: '™' },
          { key: '(r)', value: '®' },
          // Interpunctation
          { key: '...', value: '…' },
          { key: '--', value: '–' },
          { key: '---', value: '—' }
        ],
        matchWholeWords: false // Whether to only autocorrect entire words, not parts
      } // END autoCorrect options
    },
    display: {
      theme: 'berlin', // The theme, can be berlin|frankfurt|bielefeld|karl-marx-stadt|bordeaux
      hideToolbarInDistractionFree: false,
      markdownFileExtensions: false,
      previewModeShowSyntaxWhenCursorIsAdjacent: true,
      imageWidth: 100, // Maximum preview image width
      imageHeight: 50, // Maximum preview image height
      renderingMode: 'preview',
      renderCitations: true,
      renderIframes: true,
      renderImages: true,
      renderLinks: true,
      renderMath: true,
      renderTasks: true,
      renderHTags: true,
      renderEmphasis: true,
      renderPandoc: true,
      renderHorizontalRules: true
    },
    files: {
      builtin: { showInFilemanager: true, showInSidebar: false, openWith: 'zettlr' },
      images: { showInFilemanager: false, showInSidebar: true, openWith: 'system' },
      pdf: { showInFilemanager: false, showInSidebar: true, openWith: 'system' },
      msoffice: { showInFilemanager: false, showInSidebar: true, openWith: 'system' },
      openOffice: { showInFilemanager: false, showInSidebar: true, openWith: 'system' },
      dataFiles: { showInFilemanager: false, showInSidebar: true, openWith: 'system' },
      dotFiles: { showInFilemanager: false, showInSidebar: false, openWith: 'system' }
    },
    // Language
    selectedDicts: [], // By default no spell checking is active to speed up first start.
    appLang: locale,
    debug: false,
    watchdog: {
      activatePolling: false, // Set to true to enable polling in chokidar
      stabilityThreshold: 1000 // Positive int in milliseconds
    },
    system: {
      deleteOnFail: false, // Whether to delete files if trashing them fails
      leaveAppRunning: false, // Whether to leave app running in the notification area (tray)
      avoidNewTabs: false, // Whether to avoid opening new tabs for documents if possible
      iframeWhitelist: [ 'www.youtube.com', 'player.vimeo.com' ], // Contains a list of whitelisted iFrame prerendering domains
      checkForUpdates: true,
      zoomBehavior: 'gui' // Used to determine what gets zoomed: The GUI or the editor
    },
    checkForBeta: false, // Should the user be notified of beta releases?
    displayToolbarButtons: {
      showOpenPreferencesButton: true,
      showNewFileButton: true,
      showPreviousFileButton: true,
      showNextFileButton: true,
      showPandocDivSpanButton: true,
      showMarkdownCommentButton: true,
      showMarkdownLinkButton: true,
      showMarkdownImageButton: true,
      showMarkdownMakeTaskListButton: true,
      showInsertTableButton: true,
      showInsertFootnoteButton: true,
      showDocumentInfoText: true,
      showPomodoroButton: true
    },
    uuid: uuid4() // The app's unique anonymous identifier
  }
}
