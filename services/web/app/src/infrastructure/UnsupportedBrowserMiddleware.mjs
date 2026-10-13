import Bowser from 'bowser'
import Settings from '@overleaf/settings'
import Url from 'node:url'
import UrlHelper from '../Features/Helpers/UrlHelper.mjs'
import { z, parseReq } from './Validation.mjs'

const { getSafeRedirectPath } = UrlHelper
const unsupportedBrowserPath = /^\/unsupported-browser\/?$/i

// middleware schema is non-strict: it validates only the header this
// middleware consumes, applied globally to every route
const unsupportedBrowserMiddlewareSchema = z.object({
  headers: z.object({
    'user-agent': z.string().optional(),
  }),
})

const renderUnsupportedBrowserPageSchema = z.object({
  query: z.object({
    fromURL: z.string().optional(),
  }),
})

function isUnsupportedBrowser(req) {
  if (!Settings.unsupportedBrowsers) return false

  const { headers } = parseReq(req, unsupportedBrowserMiddlewareSchema, {
    logOnly: true,
  })
  const userAgent = headers['user-agent']

  if (!userAgent) return false

  const parser = Bowser.getParser(userAgent)

  // Allow bots through by only ignoring bots or unrecognised UA strings
  const isBot = parser.isPlatform('bot') || !parser.getBrowserName()
  if (isBot) return false

  return Boolean(parser.satisfies(Settings.unsupportedBrowsers))
}

function unsupportedBrowserMiddleware(req, res, next) {
  // Match Express routing, including case and an optional trailing slash.
  if (unsupportedBrowserPath.test(req.path)) return next()

  if (isUnsupportedBrowser(req)) {
    return res.redirect(
      Url.format({
        pathname: '/unsupported-browser',
        query: { fromURL: req.originalUrl },
      })
    )
  }

  next()
}

function renderUnsupportedBrowserPage(req, res) {
  const { query } = parseReq(req, renderUnsupportedBrowserPageSchema, {
    logOnly: true,
  })
  let fromURL
  let redirectPath = '/'
  if (typeof query.fromURL === 'string') {
    try {
      redirectPath = getSafeRedirectPath(query.fromURL) || '/'
      fromURL = Settings.siteUrl + redirectPath
    } catch (e) {}
  }
  if (!isUnsupportedBrowser(req)) {
    // Stale return links must not redirect back to the warning page.
    if (
      unsupportedBrowserPath.test(new URL(redirectPath, Settings.siteUrl).pathname)
    ) {
      redirectPath = '/'
    }
    return res.redirect(redirectPath)
  }

  res.render('general/unsupported-browser', { fromURL })
}

export default {
  renderUnsupportedBrowserPage,
  unsupportedBrowserMiddleware,
}
