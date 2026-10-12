import Bowser from 'bowser'
import Settings from '@overleaf/settings'
import Url from 'node:url'
import UrlHelper from '../Features/Helpers/UrlHelper.mjs'

const { getSafeRedirectPath } = UrlHelper
const unsupportedBrowserPath = /^\/unsupported-browser\/?$/i

function isUnsupportedBrowser(req) {
  if (!Settings.unsupportedBrowsers) return false

  const userAgent = req.headers['user-agent']

  if (!userAgent) return false

  const parser = Bowser.getParser(userAgent)

  // Allow bots through by only ignoring bots or unrecognised UA strings
  const isBot = parser.isPlatform('bot') || !parser.getBrowserName()
  if (isBot) return false

  return Boolean(parser.satisfies(Settings.unsupportedBrowsers))
}

function unsupportedBrowserMiddleware(req, res, next) {
  // Match the route's optional trailing slash and case-insensitive spelling.
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
  let fromURL
  let redirectPath = '/'
  if (typeof req.query.fromURL === 'string') {
    try {
      redirectPath = getSafeRedirectPath(req.query.fromURL) || '/'
      fromURL = Settings.siteUrl + redirectPath
    } catch (e) {}
  }

  if (!isUnsupportedBrowser(req)) {
    // Old links may point back to this page, which would cause a redirect loop.
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
