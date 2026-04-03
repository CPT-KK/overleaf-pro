import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import getMeta from '@/utils/meta'
import { resources } from '@/i18n-resources/writefull'
import moment from 'moment'

const LANG = getMeta('ol-i18n').currentLangCode

// Set moment.js locale to match i18n language
const momentLocalePromise = (async () => {
  if (LANG === 'zh-CN') {
    await import('moment/locale/zh-cn')
    moment.locale('zh-cn')
  } else if (LANG === 'cs') {
    await import('moment/locale/cs')
    moment.locale('cs')
  } else if (LANG === 'da') {
    await import('moment/locale/da')
    moment.locale('da')
  } else if (LANG === 'de') {
    await import('moment/locale/de')
    moment.locale('de')
  } else if (LANG === 'es') {
    await import('moment/locale/es')
    moment.locale('es')
  } else if (LANG === 'fi') {
    await import('moment/locale/fi')
    moment.locale('fi')
  } else if (LANG === 'fr') {
    await import('moment/locale/fr')
    moment.locale('fr')
  } else if (LANG === 'it') {
    await import('moment/locale/it')
    moment.locale('it')
  } else if (LANG === 'ja') {
    await import('moment/locale/ja')
    moment.locale('ja')
  } else if (LANG === 'ko') {
    await import('moment/locale/ko')
    moment.locale('ko')
  } else if (LANG === 'nl') {
    await import('moment/locale/nl')
    moment.locale('nl')
  } else if (LANG === 'no') {
    await import('moment/locale/nb') // Norwegian Bokmål
    moment.locale('nb')
  } else if (LANG === 'pl') {
    await import('moment/locale/pl')
    moment.locale('pl')
  } else if (LANG === 'pt') {
    await import('moment/locale/pt')
    moment.locale('pt')
  } else if (LANG === 'ru') {
    await import('moment/locale/ru')
    moment.locale('ru')
  } else if (LANG === 'sv') {
    await import('moment/locale/sv')
    moment.locale('sv')
  } else if (LANG === 'tr') {
    await import('moment/locale/tr')
    moment.locale('tr')
  }
  // English is the default, no need to load locale
})()

// Since we are rendering React from Angular, the initialisation is
// synchronous on page load (but hidden behind the loading screen). This
// means that translations must be initialised without any actual
// translation strings, and load those manually ourselves later

i18n.use(initReactI18next).init({
  lng: LANG,

  // still using the v3 plural suffixes
  compatibilityJSON: 'v3',

  react: {
    // Since we are manually waiting on the translations data to
    // load, we don't need to use Suspense
    useSuspense: false,

    // Trigger a re-render when a language is added. Since we load the
    // translation strings asynchronously, we need to trigger a re-render once
    // they've loaded
    bindI18nStore: 'added',

    // Disable automatic conversion of basic markup to React components
    transSupportBasicHtmlNodes: false,
  },

  interpolation: {
    // We use the legacy v1 JSON format, so configure interpolator to use
    // underscores instead of curly braces
    prefix: '__',
    suffix: '__',
    unescapeSuffix: 'HTML',

    // Disable nesting in interpolated values, preventing user input
    // injection via another nested value
    skipOnVariables: true,

    // Do not escape values, as `t` + React will already escape them
    // (`escapeValue: true` and `shouldUnescape` must be set on each use of `Trans`)
    escapeValue: false,

    defaultVariables: {
      appName: getMeta('ol-ExposedSettings').appName,
    },
  },
})

// The webpackChunkName here will name this chunk (and thus the requested
// script) according to the file name. See https://webpack.js.org/api/module-methods/#magic-comments
// for details
const localesPromise = Promise.all([
  momentLocalePromise,
  import(
    /* webpackChunkName: "[request]" */ `../../locales/${LANG}.json`
  ),
]).then(([, lang]) => {
  i18n.addResourceBundle(LANG, 'translation', lang)
  i18n.addResourceBundle(
    LANG,
    'writefull',
    LANG === 'es' ? resources.es.writefull : resources.en.writefull
  )
})

export default localesPromise
