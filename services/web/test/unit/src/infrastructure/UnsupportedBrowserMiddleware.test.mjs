import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'
import {
  InvalidRequestError,
  setReqValidationModeForTests,
} from '@overleaf/validation-tools'
import MockRequest from '../helpers/MockRequest.mjs'
import MockResponse from '../helpers/MockResponse.mjs'

const MODULE_PATH =
  '../../../../app/src/infrastructure/UnsupportedBrowserMiddleware.mjs'

describe('UnsupportedBrowserMiddleware', function () {
  beforeEach(async function (ctx) {
    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.settings = {
        unsupportedBrowsers: { chrome: '<50' },
        siteUrl: 'https://www.overleaf.com',
      }),
    }))

    ctx.UnsupportedBrowserMiddleware = (await import(MODULE_PATH)).default
    ctx.req = new MockRequest(vi)
    ctx.req.path = '/project'
    ctx.res = new MockResponse(vi)
    ctx.next = sinon.stub()
  })

  afterEach(function () {
    setReqValidationModeForTests(null)
  })

  describe('unsupportedBrowserMiddleware', function () {
    describe('request validation', function () {
      beforeEach(function (ctx) {
        setReqValidationModeForTests('enforce')
        ctx.req.headers = { 'user-agent': ['a', 'b'] }
      })

      it('rejects a non-string user-agent header', function (ctx) {
        let error
        try {
          ctx.UnsupportedBrowserMiddleware.unsupportedBrowserMiddleware(
            ctx.req,
            ctx.res,
            ctx.next
          )
        } catch (err) {
          error = err
        }
        expect(error).to.be.instanceOf(InvalidRequestError)
        sinon.assert.notCalled(ctx.next)
      })
    })
  })

  describe('warning page redirects', function () {
    const chrome = version =>
      `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version}.0.0.0 Safari/537.36`

    beforeEach(function (ctx) {
      setReqValidationModeForTests('enforce')
      ctx.req.headers = { 'user-agent': chrome(121) }
    })

    for (const [fromURL, destination] of [
      [undefined, '/'],
      ['', '/'],
      ['/project/abc?view=editor#section', '/project/abc?view=editor#section'],
      ['https://evil.com/login?foo=bar#form', '/login?foo=bar#form'],
      ['//evil.com/login', '/login'],
      ['http://[', '/'],
      ['/unsupported-browser', '/'],
      ['/unsupported-browser?fromURL=/login', '/'],
      ['/UNSUPPORTED-BROWSER/#fragment', '/'],
    ]) {
      it(`redirects ${String(fromURL)} to ${destination}`, function (ctx) {
        ctx.req.query = fromURL === undefined ? {} : { fromURL }
        ctx.UnsupportedBrowserMiddleware.renderUnsupportedBrowserPage(
          ctx.req,
          ctx.res
        )
        expect(ctx.res.redirect).toHaveBeenCalledWith(destination)
        expect(ctx.res.render).not.toHaveBeenCalled()
      })
    }

    it('retains upstream query validation', function (ctx) {
      ctx.req.query = { fromURL: ['a', 'b'] }
      expect(() =>
        ctx.UnsupportedBrowserMiddleware.renderUnsupportedBrowserPage(
          ctx.req,
          ctx.res
        )
      ).to.throw(InvalidRequestError)
      expect(ctx.res.redirect).not.toHaveBeenCalled()
    })

    it('renders the warning and a safe link for an unsupported browser', function (ctx) {
      ctx.req.headers = { 'user-agent': chrome(40) }
      ctx.req.query = { fromURL: 'https://evil.com/project/abc' }
      ctx.UnsupportedBrowserMiddleware.renderUnsupportedBrowserPage(
        ctx.req,
        ctx.res
      )
      expect(ctx.res.render).toHaveBeenCalledWith(
        'general/unsupported-browser',
        {
          fromURL: 'https://www.overleaf.com/project/abc',
        }
      )
      expect(ctx.res.redirect).not.toHaveBeenCalled()
    })

    for (const path of [
      '/unsupported-browser',
      '/unsupported-browser/',
      '/UNSUPPORTED-BROWSER',
    ]) {
      it(`does not loop for ${path}`, function (ctx) {
        ctx.req.path = path
        ctx.req.headers = { 'user-agent': chrome(40) }
        ctx.UnsupportedBrowserMiddleware.unsupportedBrowserMiddleware(
          ctx.req,
          ctx.res,
          ctx.next
        )
        sinon.assert.calledOnce(ctx.next)
        expect(ctx.res.redirect).not.toHaveBeenCalled()
      })
    }

    it('redirects an unsupported browser to the warning page', function (ctx) {
      ctx.req.originalUrl = '/project/abc?view=editor'
      ctx.req.headers = { 'user-agent': chrome(40) }
      ctx.UnsupportedBrowserMiddleware.unsupportedBrowserMiddleware(
        ctx.req,
        ctx.res,
        ctx.next
      )
      expect(ctx.res.redirect).toHaveBeenCalledWith(
        '/unsupported-browser?fromURL=%2Fproject%2Fabc%3Fview%3Deditor'
      )
      sinon.assert.notCalled(ctx.next)
    })

    for (const userAgent of [undefined, 'unknown', chrome(121)]) {
      it(`allows ${String(userAgent)} through`, function (ctx) {
        ctx.req.headers = userAgent ? { 'user-agent': userAgent } : {}
        ctx.UnsupportedBrowserMiddleware.unsupportedBrowserMiddleware(
          ctx.req,
          ctx.res,
          ctx.next
        )
        sinon.assert.calledOnce(ctx.next)
      })
    }

    it('redirects away when browser checks are disabled', function (ctx) {
      ctx.settings.unsupportedBrowsers = undefined
      ctx.req.headers = { 'user-agent': chrome(40) }
      ctx.UnsupportedBrowserMiddleware.renderUnsupportedBrowserPage(
        ctx.req,
        ctx.res
      )
      expect(ctx.res.redirect).toHaveBeenCalledWith('/')
    })
  })
})
