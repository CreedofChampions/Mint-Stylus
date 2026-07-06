<template>
  <h1 id="logo-heading">
    {{ pageHeading }} <img src="../../../resources/icons/png/256x256.png" />
  </h1>

  <p>
    {{ para1 }}
  </p>

  <p>
    {{ para2 }}
  </p>

  <p>
    {{ para3 }}
  </p>

  <p class="small">
    {{ attribution }}
  </p>
</template>

<script setup lang="ts">
import { trans } from 'source/common/i18n-renderer'

const pageHeading = trans('Hello!')
const para1 = trans('Thank your for choosing Mint Stylus as your new one-stop publication workbench.')
const para2 = trans('Before we get started, let us first make sure Mint Stylus looks and feels as you expect it to.')
const para3 = trans('On the following pages, we guide you through adjusting a set of vital settings for a great writing experience. Mint Stylus ships with sensible defaults, so you may skip this wizard at any time, and adjust your settings later on.')
const attribution = trans('Mint Stylus is based on Zettlr (GPL v3).')
</script>

<style lang="less">
h1#logo-heading {
  display: flex;
  height: 40px;
  gap: 20px;
}
</style>
