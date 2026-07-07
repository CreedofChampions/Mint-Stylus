<template>
  <div class="ai-commands-control">
    <p class="ai-commands-intro">{{ introText }}</p>

    <div
      v-for="(cmd, idx) in commands"
      v-bind:key="cmd.id"
      class="ai-command-card"
    >
      <div class="ai-command-row">
        <input
          v-model="cmd.name"
          type="text"
          class="ai-command-name"
          v-bind:placeholder="namePlaceholder"
          autocomplete="off"
          spellcheck="false"
          v-on:change="persist"
          v-on:blur="persist"
        >
        <select
          v-model="cmd.flow"
          class="ai-command-flow"
          v-bind:title="flowSelectTitle"
          v-on:change="persist"
        >
          <option value="summarize">{{ flowSummarizeLabel }}</option>
          <option value="stream">{{ flowStreamLabel }}</option>
        </select>
        <button
          v-if="cmd.builtin"
          type="button"
          class="ai-command-btn"
          v-bind:title="resetTitle"
          v-on:click="resetCommand(idx)"
        >{{ resetLabel }}</button>
        <button
          type="button"
          class="ai-command-btn ai-command-delete"
          v-bind:title="deleteTitle"
          v-on:click="removeCommand(idx)"
        >{{ deleteLabel }}</button>
      </div>

      <textarea
        v-model="cmd.prompt"
        class="ai-command-prompt"
        rows="5"
        v-bind:placeholder="promptPlaceholder"
        spellcheck="true"
        v-on:change="persist"
        v-on:blur="persist"
      ></textarea>

      <p class="ai-command-flow-hint">{{ flowHint(cmd) }}</p>
    </div>

    <div class="ai-commands-actions">
      <button type="button" class="ai-command-add" v-on:click="addCommand">{{ addLabel }}</button>
      <button type="button" class="ai-command-btn" v-on:click="resetAll">{{ resetAllLabel }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @ignore
 * BEGIN HEADER
 *
 * Contains:        AICommandsControl
 * CVM-Role:        View
 * Maintainer:      Mint Stylus
 * License:         GNU GPL v3
 *
 * Description:     The "AI Commands" editor for the AI preferences tab. Lists the
 *                  user's AI commands (the five built-ins plus any they added) and
 *                  lets them:
 *                    - rename a command,
 *                    - rewrite its prompt (the instruction the model follows),
 *                    - change its flow (summarize → clickable replace options, or
 *                      stream → a full written answer),
 *                    - add a new command (defaults to the summarize flow),
 *                    - delete a command,
 *                    - reset a built-in to its shipped default, or reset them all.
 *
 *                  The whole set is persisted to config under `ai.commands`. No
 *                  keys / HTTP / files are touched here — the command set is plain
 *                  data the main-process AIProvider later reads a prompt from.
 *
 *                  ==== AI-created for Mint Stylus ====
 *
 * END HEADER
 */

import { ref } from 'vue'
import { trans } from '@common/i18n-renderer'
import {
  reconcileCommands,
  defaultAICommands,
  defaultCommandById,
  makeNewCommand,
  type AICommandConfig
} from '@providers/ai/ai-commands'

/**
 * The working copy of the command list. Seeded from config (reconciled to a
 * clean, non-empty list) and written straight back on every edit via persist().
 */
const commands = ref<AICommandConfig[]>(reconcileCommands(window.config.get('ai.commands')))

const introText = trans('These are the commands offered when you highlight text and choose "Command", and in the AI menu. Rename them, rewrite their prompts, change how their output appears, or add your own. New commands default to the option-list flow.')
const namePlaceholder = trans('Command name')
const promptPlaceholder = trans('The instruction the AI follows for this command…')
const flowSummarizeLabel = trans('Options to replace selection')
const flowStreamLabel = trans('Full written answer')
const flowSelectTitle = trans('How this command\'s output is shown')
const resetLabel = trans('Reset')
const resetTitle = trans('Restore this built-in command to its default name, prompt and flow')
const deleteLabel = trans('Delete')
const deleteTitle = trans('Remove this command')
const addLabel = trans('+ Add command')
const resetAllLabel = trans('Reset all to defaults')

/**
 * A one-line explanation of the selected flow, shown under each command.
 *
 * @param   {AICommandConfig}  cmd  The command.
 *
 * @return  {string}                The hint text.
 */
function flowHint (cmd: AICommandConfig): string {
  return cmd.flow === 'summarize'
    ? trans('Output is a list of choices; clicking one replaces your selection.')
    : trans('Output is written into the AI panel as a full answer.')
}

/**
 * Serialises the working list into plain objects and writes it to config. Called
 * after every edit so changes take effect immediately (the main window's chooser
 * re-reads ai.commands whenever it opens).
 */
function persist (): void {
  const plain = commands.value.map(c => ({
    id: c.id,
    name: c.name.trim() === '' ? trans('Untitled command') : c.name,
    prompt: c.prompt,
    flow: c.flow,
    builtin: c.builtin
  }))
  window.config.set('ai.commands', plain)
}

/**
 * Appends a new, empty custom command (summarize flow) and persists.
 */
function addCommand (): void {
  commands.value.push(makeNewCommand(commands.value))
  persist()
}

/**
 * Removes the command at `idx`. Refuses to remove the last remaining command so
 * the list is never empty (which would otherwise re-seed to defaults on reload).
 *
 * @param  {number}  idx  The index to remove.
 */
function removeCommand (idx: number): void {
  if (commands.value.length <= 1) {
    window.alert(trans('You need at least one command. Reset to defaults instead of deleting the last one.'))
    return
  }
  commands.value.splice(idx, 1)
  persist()
}

/**
 * Resets a built-in command back to its shipped default (name, prompt, flow).
 *
 * @param  {number}  idx  The index of the command to reset.
 */
function resetCommand (idx: number): void {
  const cmd = commands.value[idx]
  if (cmd === undefined) {
    return
  }
  const def = defaultCommandById(cmd.id)
  if (def === undefined) {
    return
  }
  commands.value[idx] = { ...def }
  persist()
}

/**
 * Restores the entire command set to the shipped defaults after confirmation.
 */
function resetAll (): void {
  if (!window.confirm(trans('Reset ALL AI commands to their defaults? Any commands you added will be removed.'))) {
    return
  }
  commands.value = defaultAICommands()
  persist()
}
</script>

<style lang="less">
.ai-commands-control {
  .ai-commands-intro {
    font-size: 12px;
    color: rgb(120, 120, 120);
    margin: 0 0 12px 0;
  }

  .ai-command-card {
    border: 1px solid rgba(128, 128, 128, 0.35);
    border-radius: 8px;
    padding: 10px;
    margin-bottom: 10px;

    .ai-command-row {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 8px;

      .ai-command-name {
        flex: 1 1 auto;
        min-width: 0;
        padding: 6px 8px;
        border-radius: 6px;
        font-weight: bold;
      }

      .ai-command-flow {
        flex: 0 0 auto;
        padding: 5px 6px;
        border-radius: 6px;
      }

      .ai-command-btn {
        flex: 0 0 auto;
        padding: 5px 10px;
        border-radius: 6px;
        border: 1px solid rgba(128, 128, 128, 0.4);
        background-color: transparent;
        color: inherit;
        cursor: pointer;
        font-size: 12px;

        &:hover { background-color: rgba(128, 128, 128, 0.15); }
      }

      .ai-command-delete:hover {
        background-color: rgba(217, 65, 65, 0.18);
      }
    }

    .ai-command-prompt {
      width: 100%;
      box-sizing: border-box;
      resize: vertical;
      min-height: 90px;
      padding: 8px;
      border-radius: 6px;
      border: 1px solid rgba(128, 128, 128, 0.4);
      background-color: transparent;
      color: inherit;
      font-family: var(--font-monospace, monospace);
      font-size: 12px;
      line-height: 1.45;
    }

    .ai-command-flow-hint {
      margin: 6px 0 0 0;
      font-size: 11px;
      color: rgb(131, 131, 131);
    }
  }

  .ai-commands-actions {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 4px;

    .ai-command-add {
      padding: 6px 14px;
      border-radius: 6px;
      border: 1px solid rgba(128, 128, 128, 0.4);
      background-color: transparent;
      color: inherit;
      cursor: pointer;
      font-size: 13px;

      &:hover { background-color: rgba(128, 128, 128, 0.15); }
    }

    .ai-command-btn {
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid rgba(128, 128, 128, 0.4);
      background-color: transparent;
      color: inherit;
      cursor: pointer;
      font-size: 13px;

      &:hover { background-color: rgba(128, 128, 128, 0.15); }
    }
  }
}
</style>
