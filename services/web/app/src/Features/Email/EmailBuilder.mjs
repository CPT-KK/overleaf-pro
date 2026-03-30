import _ from 'lodash'
import settings from '@overleaf/settings'
import moment from 'moment'
import EmailMessageHelper from './EmailMessageHelper.mjs'
import StringHelper from '../Helpers/StringHelper.mjs'
import BaseWithHeaderEmailLayout from './Layouts/BaseWithHeaderEmailLayout.mjs'
import SpamSafe from './SpamSafe.mjs'
import ctaEmailBody from './Bodies/cta-email.mjs'
import NoCTAEmailBody from './Bodies/NoCTAEmailBody.mjs'

function _emailBodyPlainText(content, opts, ctaEmail) {
  let emailBody = `${content.greeting(opts, true)}`
  emailBody += `\r\n\r\n`
  emailBody += `${content.message(opts, true).join('\r\n\r\n')}`

  if (ctaEmail) {
    emailBody += `\r\n\r\n`
    emailBody += `${content.ctaText(opts, true)}: ${content.ctaURL(opts, true)}`
  }

  if (
    content.secondaryMessage(opts, true) &&
    content.secondaryMessage(opts, true).length > 0
  ) {
    emailBody += `\r\n\r\n`
    emailBody += `${content.secondaryMessage(opts, true).join('\r\n\r\n')}`
  }

  emailBody += `\r\n\r\n`
  emailBody += `此致，\r\n${settings.appName} 团队 - ${settings.siteUrl}`

  if (
    settings.email &&
    settings.email.template &&
    settings.email.template.customFooter
  ) {
    emailBody += `\r\n\r\n`
    emailBody += settings.email.template.customFooter
  }

  return emailBody
}

function ctaTemplate(content) {
  if (
    !content.ctaURL ||
    !content.ctaText ||
    !content.message ||
    !content.subject
  ) {
    throw new Error('missing required CTA email content')
  }
  if (!content.title) {
    content.title = () => {}
  }
  if (!content.greeting) {
    content.greeting = () => '你好，'
  }
  if (!content.secondaryMessage) {
    content.secondaryMessage = () => []
  }
  if (!content.gmailGoToAction) {
    content.gmailGoToAction = () => {}
  }
  return {
    subject(opts) {
      return content.subject(opts)
    },
    layout: BaseWithHeaderEmailLayout,
    plainTextTemplate(opts) {
      return _emailBodyPlainText(content, opts, true)
    },
    compiledTemplate(opts) {
      return ctaEmailBody({
        title: content.title(opts),
        greeting: content.greeting(opts),
        message: content.message(opts),
        secondaryMessage: content.secondaryMessage(opts),
        ctaText: content.ctaText(opts),
        ctaURL: content.ctaURL(opts),
        gmailGoToAction: content.gmailGoToAction(opts),
        StringHelper,
      })
    },
  }
}

function NoCTAEmailTemplate(content) {
  if (content.greeting == null) {
    content.greeting = () => '你好，'
  }
  if (!content.message) {
    throw new Error('missing message')
  }
  return {
    subject(opts) {
      return content.subject(opts)
    },
    layout: BaseWithHeaderEmailLayout,
    plainTextTemplate(opts) {
      return `\
${content.greeting(opts)}

${content.message(opts, true).join('\r\n\r\n')}

此致，
${settings.appName} 团队 - ${settings.siteUrl}\
      `
    },
    compiledTemplate(opts) {
      return NoCTAEmailBody({
        title:
          typeof content.title === 'function' ? content.title(opts) : undefined,
        greeting: content.greeting(opts),
        highlightedText:
          typeof content.highlightedText === 'function'
            ? content.highlightedText(opts)
            : undefined,
        message: content.message(opts),
        StringHelper,
      })
    },
  }
}

function buildEmail(templateName, opts) {
  const template = templates[templateName]
  opts.siteUrl = settings.siteUrl
  opts.body = template.compiledTemplate(opts)
  return {
    subject: template.subject(opts),
    html: template.layout(opts),
    text: template.plainTextTemplate && template.plainTextTemplate(opts),
  }
}

const templates = {}

templates.registered = ctaTemplate({
  subject() {
    return `激活你的 ${settings.appName} 账户`
  },
  message(opts) {
    return [
      `你的 ${
        settings.appName
      } 账户已创建，邮箱地址为 '${_.escape(opts.to)}'。`,
      '点击此处设置密码并登录：',
    ]
  },
  secondaryMessage() {
    return [
      `如果你有任何问题，请联系 ${settings.adminEmail}`,
    ]
  },
  ctaText() {
    return '设置密码'
  },
  ctaURL(opts) {
    return opts.setNewPasswordUrl
  },
})

templates.canceledSubscription = ctaTemplate({
  subject() {
    return `关于 ${settings.appName} 的反馈`
  },
  message() {
    return [
      `很遗憾看到你取消了 ${settings.appName} 高级订阅。你愿意通过这份简短问卷告诉我们目前产品还有哪些不足吗？`,
    ]
  },
  secondaryMessage() {
    return ['先谢谢你的帮助！']
  },
  ctaText() {
    return '提交反馈'
  },
  ctaURL(opts) {
    return 'https://docs.google.com/forms/d/e/1FAIpQLSfa7z_s-cucRRXm70N4jEcSbFsZeb0yuKThHGQL8ySEaQzF0Q/viewform?usp=sf_link'
  },
})

templates.canceledSubscriptionOrAddOn = ctaTemplate({
  subject() {
    return `关于 ${settings.appName} 的反馈`
  },
  message() {
    return [
      `很遗憾看到你取消了 ${settings.appName} 订阅。你愿意通过这份简短问卷告诉我们目前产品还有哪些不足吗？`,
    ]
  },
  secondaryMessage() {
    return ['先谢谢你的帮助！']
  },
  ctaText() {
    return '提交反馈'
  },
  ctaURL(opts) {
    return 'https://digitalscience.qualtrics.com/jfe/form/SV_2n2aSlWgvoxXdGK'
  },
})

templates.reactivatedSubscription = ctaTemplate({
  subject() {
    return `订阅已重新激活 - ${settings.appName}`
  },
  message(opts) {
    return ['你的订阅已成功重新激活。']
  },
  ctaText() {
    return '查看订阅面板'
  },
  ctaURL(opts) {
    return `${settings.siteUrl}/user/subscription`
  },
})

templates.passwordResetRequested = ctaTemplate({
  subject() {
    return `密码重置 - ${settings.appName}`
  },
  title() {
    return '重置密码'
  },
  message() {
    return [`我们收到了重置你 ${settings.appName} 密码的请求。`]
  },
  secondaryMessage() {
    return [
      '如果你忽略此邮件，你的密码不会被修改。',
      '如果这不是你发起的密码重置请求，请告知我们。',
    ]
  },
  ctaText() {
    return '重置密码'
  },
  ctaURL(opts) {
    return opts.setNewPasswordUrl
  },
})

templates.confirmEmail = ctaTemplate({
  subject() {
    return `确认邮箱 - ${settings.appName}`
  },
  title() {
    return '确认邮箱'
  },
  message(opts) {
    return [
      `请确认你已将新邮箱 ${opts.to} 添加到你的 ${settings.appName} 账户。`,
    ]
  },
  secondaryMessage() {
    return [
      `如果这不是你发起的请求，请通过 <a href="mailto:${settings.adminEmail}">${settings.adminEmail}</a> 告知我们。`,
      `如果你在确认邮箱时遇到问题，请联系支持团队：${settings.adminEmail}。`,
    ]
  },
  ctaText() {
    return '确认邮箱'
  },
  ctaURL(opts) {
    return opts.confirmEmailUrl
  },
})

templates.confirmCode = NoCTAEmailTemplate({
  greeting(opts) {
    return ''
  },
  subject(opts) {
    return `在 Overleaf 确认你的邮箱地址（${opts.confirmCode}）`
  },
  title(opts) {
    return '确认你的邮箱地址'
  },
  message(opts, isPlainText) {
    const msg = opts.welcomeUser
      ? [
          '欢迎来到 Overleaf！很高兴你加入我们。',
          '请使用这个 6 位验证码完成设置。',
        ]
      : ['请使用这个 6 位验证码确认你的邮箱地址。']

    if (isPlainText && opts.confirmCode) {
      msg.push(opts.confirmCode)
    }
    return msg
  },
  highlightedText(opts) {
    return opts.confirmCode
  },
})

templates.projectInvite = ctaTemplate({
  subject(opts) {
    const safeName = SpamSafe.isSafeProjectName(opts.project.name)
    const safeEmail = SpamSafe.isSafeEmail(opts.owner.email)

    if (safeName && safeEmail) {
      return `"${opts.project.name}" — 共享者：${_.escape(opts.owner.email)}`
    }
    if (safeName) {
      return `${settings.appName} 项目已与你共享 — "${_.escape(
        opts.project.name
      )}"`
    }
    if (safeEmail) {
      return `${_.escape(opts.owner.email)} 向你共享了一个 ${
        settings.appName
      } 项目`
    }

    return `一个 ${settings.appName} 项目已与你共享`
  },
  title(opts) {
    return '项目邀请'
  },
  greeting(opts) {
    return ''
  },
  message(opts, isPlainText) {
    // build message depending on spam-safe variables
    const message = [`你已被邀请加入一个 ${settings.appName} 项目。`]

    if (SpamSafe.isSafeProjectName(opts.project.name)) {
      message.push('<br/> 项目：')
      message.push(`<b>${_.escape(opts.project.name)}</b>`)
    }

    if (SpamSafe.isSafeEmail(opts.owner.email)) {
      message.push('<br/> 共享者：')
      message.push(`<b>${_.escape(opts.owner.email)}</b>`)
    }

    if (message.length === 1) {
      message.push('<br/> 请查看项目了解更多信息。')
    }

    return message.map(m => {
      return EmailMessageHelper.cleanHTML(m, isPlainText)
    })
  },
  ctaText() {
    return '查看项目'
  },
  ctaURL(opts) {
    return opts.inviteUrl
  },
  gmailGoToAction(opts) {
    return {
      target: opts.inviteUrl,
      name: '查看项目',
      description: `加入 ${_.escape(
        SpamSafe.safeProjectName(opts.project.name, '项目')
      )}（${settings.appName}）`,
    }
  },
})

templates.reconfirmEmail = ctaTemplate({
  subject() {
    return `重新确认邮箱 - ${settings.appName}`
  },
  title() {
    return '重新确认邮箱'
  },
  message(opts) {
    return [
      `请在你的 ${settings.appName} 账户中重新确认邮箱地址 ${opts.to}。`,
    ]
  },
  secondaryMessage() {
    return [
      '如果这不是你发起的请求，你可以直接忽略此邮件。',
      `如果你在确认邮箱时遇到问题，请联系支持团队：${settings.adminEmail}。`,
    ]
  },
  ctaText() {
    return '重新确认邮箱'
  },
  ctaURL(opts) {
    return opts.confirmEmailUrl
  },
})

templates.verifyEmailToJoinTeam = ctaTemplate({
  subject(opts) {
    return `${opts.reminder ? '提醒：' : ''}${_.escape(
      _formatUserNameAndEmail(opts.inviter, '一位协作者')
    )} 邀请你加入 ${settings.appName} 的团队订阅`
  },
  title(opts) {
    return `${opts.reminder ? '提醒：' : ''}${_.escape(
      _formatUserNameAndEmail(opts.inviter, '一位协作者')
    )} 邀请你加入 ${settings.appName} 的团队订阅`
  },
  message(opts) {
    return [
      `请点击下方按钮加入团队订阅，享受升级版 ${settings.appName} 账户带来的权益。`,
    ]
  },
  ctaText(opts) {
    return '立即加入'
  },
  ctaURL(opts) {
    return opts.acceptInviteUrl
  },
})

templates.verifyEmailToJoinManagedUsers = ctaTemplate({
  subject(opts) {
    return `${
      opts.reminder ? '提醒：' : ''
    }${_.escape(
      _formatUserNameAndEmail(opts.inviter, '一位协作者')
    )} 邀请你加入 ${settings.appName} 团队订阅。`
  },
  title(opts) {
    return `${
      opts.reminder ? '提醒：' : ''
    }${_.escape(
      _formatUserNameAndEmail(opts.inviter, '一位协作者')
    )} 邀请你加入 ${settings.appName} 团队订阅。`
  },
  message(opts) {
    return [
      `加入该团队后，你将可使用 ${settings.appName} 高级功能，例如更多协作者、更长的最大编译时长以及实时修订追踪。`,
    ]
  },
  secondaryMessage(opts, isPlainText) {
    const changeProjectOwnerLink = EmailMessageHelper.displayLink(
      '变更项目所有者',
      `${settings.siteUrl}/learn/how-to/How_to_Transfer_Project_Ownership`,
      isPlainText
    )

    return [
      `<b>本团队中的用户账户由 ${_.escape(
        _formatUserNameAndEmail(opts.admin, '管理员')
      )} 管理</b>`,
      `如果你接受邀请，你的 ${settings.appName} 账户将转由团队订阅所有者管理，对方将拥有你的账户管理员权限并可管理你的相关内容。`,
      `如果你希望将 ${settings.appName} 账户中的个人项目单独保留，也没问题。你可以使用个人邮箱新建一个账户，并把个人项目所有权转移到新账户。了解如何${changeProjectOwnerLink}。`,
    ]
  },
  ctaURL(opts) {
    return opts.acceptInviteUrl
  },
  ctaText(opts) {
    return '接受邀请'
  },
  greeting() {
    return ''
  },
})

templates.inviteNewUserToJoinManagedUsers = ctaTemplate({
  subject(opts) {
    return `${
      opts.reminder ? '提醒：' : ''
    }${_.escape(
      _formatUserNameAndEmail(opts.inviter, '一位协作者')
    )} 邀请你加入 ${settings.appName} 团队订阅。`
  },
  title(opts) {
    return `${
      opts.reminder ? '提醒：' : ''
    }${_.escape(
      _formatUserNameAndEmail(opts.inviter, '一位协作者')
    )} 邀请你加入 ${settings.appName} 团队订阅。`
  },
  message(opts) {
    return ['']
  },
  secondaryMessage(opts) {
    return [
      `<b>本团队中的用户账户由 ${_.escape(
        _formatUserNameAndEmail(opts.admin, '管理员')
      )} 管理。</b>`,
      `如果你接受邀请，团队订阅所有者将拥有你的账户管理员权限并可管理你的相关内容。`,
      `<b>${settings.appName} 是什么？</b>`,
      `${settings.appName} 是深受研究人员和技术写作者喜爱的在线协作 LaTeX 编辑器。它提供海量现成模板与丰富的 LaTeX 学习资源，帮助你快速上手。`,
    ]
  },
  ctaURL(opts) {
    return opts.acceptInviteUrl
  },
  ctaText(opts) {
    return '接受邀请'
  },
  greeting() {
    return ''
  },
})

templates.groupSSOLinkingInvite = ctaTemplate({
  subject(opts) {
    const subjectPrefix = opts.reminder ? '提醒：' : '需要操作：'
    return `${subjectPrefix}验证你的 Overleaf 账户`
  },
  title(opts) {
    const titlePrefix = opts.reminder ? '提醒：' : ''
    return `${titlePrefix}单点登录已启用`
  },
  message(opts) {
    return [
      `你好，
      <div>
        你的团队管理员已为团队启用单点登录（SSO）。
      </div>
      </br>
      <div>
        <strong>这对你意味着什么？</strong>
      </div>
      </br>
      <div>
        你无需再单独记住用于登录 Overleaf 的邮箱和密码。
        你只需要通过 SSO 提供方验证你现有的 Overleaf 账户。
      </div>
      `,
    ]
  },
  secondaryMessage(opts) {
    return [``]
  },
  ctaURL(opts) {
    return opts.authenticateWithSSO
  },
  ctaText(opts) {
    return '使用 SSO 验证'
  },
  greeting() {
    return ''
  },
})

templates.groupSSOReauthenticate = ctaTemplate({
  subject(opts) {
    return '需要操作：重新验证你的 Overleaf 账户'
  },
  title(opts) {
    return '需要操作：重新进行 SSO 验证'
  },
  message(opts) {
    return [
      `你好，
      <div>
      你的 Overleaf 团队单点登录（SSO）配置已更新。
      这意味着你需要通过团队的 SSO 提供方重新验证你的 Overleaf 账户。
      </div>
      `,
    ]
  },
  secondaryMessage(opts) {
    if (!opts.isManagedUser) {
      return ['']
    } else {
      const passwordResetUrl = `${settings.siteUrl}/user/password/reset`
      return [
        `如果你当前未登录 Overleaf，则需要先<a href="${passwordResetUrl}">设置新密码</a>后再完成重新验证。`,
      ]
    }
  },
  ctaURL(opts) {
    return opts.authenticateWithSSO
  },
  ctaText(opts) {
    return '立即重新验证'
  },
  greeting() {
    return ''
  },
})

templates.groupSSODisabled = ctaTemplate({
  subject(opts) {
    if (opts.userIsManaged) {
      return '需要操作：设置你的 Overleaf 密码'
    } else {
      return '你的 Overleaf 登录方式已变更'
    }
  },
  title(opts) {
    return '单点登录已停用'
  },
  message(opts, isPlainText) {
    const loginUrl = `${settings.siteUrl}/login`
    let whatDoesThisMeanExplanation = [
      `你仍然可以通过其他<a href="${loginUrl}" style="color: #0F7A06; text-decoration: none;">登录方式</a>，或使用邮箱和密码登录 Overleaf。`,
      '如果你还没有密码，现在就可以设置。',
    ]
    if (opts.userIsManaged) {
      whatDoesThisMeanExplanation = [
        '你现在需要使用邮箱地址和密码登录你的 Overleaf 账户。',
      ]
    }

    const message = [
      '你的团队管理员已停用该团队的单点登录（SSO）。',
      '<br/>',
      '<b>这对你意味着什么？</b>',
      ...whatDoesThisMeanExplanation,
    ]

    return message.map(m => {
      return EmailMessageHelper.cleanHTML(m, isPlainText)
    })
  },
  secondaryMessage(opts) {
    return [``]
  },
  ctaURL(opts) {
    return opts.setNewPasswordUrl
  },
  ctaText(opts) {
    return '设置新密码'
  },
})

templates.surrenderAccountForManagedUsers = ctaTemplate({
  subject(opts) {
    const admin = _.escape(_formatUserNameAndEmail(opts.admin, '管理员'))

    const toGroupName = opts.groupName ? ` 到 ${opts.groupName}` : ''

    return `${
      opts.reminder ? '提醒：' : ''
    }${admin} 邀请你转移 ${settings.appName} 账户的管理权${toGroupName}`
  },
  title(opts) {
    const admin = _.escape(_formatUserNameAndEmail(opts.admin, '管理员'))

    const toGroupName = opts.groupName ? ` 到 ${opts.groupName}` : ''

    return `${
      opts.reminder ? '提醒：' : ''
    }${admin} 邀请你转移 ${settings.appName} 账户的管理权${toGroupName}`
  },
  message(opts, isPlainText) {
    const admin = _.escape(_formatUserNameAndEmail(opts.admin, '管理员'))

    const managedUsersLink = EmailMessageHelper.displayLink(
      '用户账户管理',
      `${settings.siteUrl}/learn/how-to/Understanding_Managed_Overleaf_Accounts`,
      isPlainText
    )

    return [
      `你的 ${settings.appName} 账户 ${_.escape(
        opts.to
      )} 属于 ${admin} 的团队。对方已为团队启用${managedUsersLink}，以确保有人离开团队时项目不会丢失。`,
    ]
  },
  secondaryMessage(opts, isPlainText) {
    const transferProjectOwnershipLink = EmailMessageHelper.displayLink(
      '变更项目所有者',
      `${settings.siteUrl}/learn/how-to/How_to_Transfer_Project_Ownership`,
      isPlainText
    )

    return [
      '<b>这对你意味着什么？</b>',
      `如果你接受邀请，你的 ${settings.appName} 账户将转由团队订阅所有者管理，对方将拥有你的账户管理员权限并可管理你的相关内容。`,
      `如果你希望将 ${settings.appName} 账户中的个人项目单独保留，也没问题。你可以使用个人邮箱新建一个账户，并把个人项目所有权转移到新账户。了解如何${transferProjectOwnershipLink}。`,
      '如果你认为此邀请发送有误，请联系你的团队管理员。',
    ]
  },
  ctaURL(opts) {
    return opts.acceptInviteUrl
  },
  ctaText(opts) {
    return '接受邀请'
  },
  greeting() {
    return ''
  },
})

templates.testEmail = ctaTemplate({
  subject() {
    return `${settings.appName} 测试邮件`
  },
  title() {
    return `${settings.appName} 测试邮件`
  },
  greeting() {
    return '你好，'
  },
  message() {
    return [`这是一封来自 ${settings.appName} 的测试邮件。`]
  },
  ctaText() {
    return `打开 ${settings.appName}`
  },
  ctaURL() {
    return settings.siteUrl
  },
})

templates.ownershipTransferConfirmationPreviousOwner = NoCTAEmailTemplate({
  subject(opts) {
    return `项目所有权转移 - ${settings.appName}`
  },
  title(opts) {
    const projectName = _.escape(
      SpamSafe.safeProjectName(opts.project.name, '你的项目')
    )
    return `${projectName} - 所有者变更`
  },
  message(opts, isPlainText) {
    const nameAndEmail = _.escape(
      _formatUserNameAndEmail(opts.newOwner, '一位协作者')
    )
    const projectName = _.escape(
      SpamSafe.safeProjectName(opts.project.name, '你的项目')
    )
    const projectNameDisplay = isPlainText
      ? projectName
      : `<b>${projectName}</b>`
    return [
      `根据你的请求，我们已将 ${nameAndEmail} 设为 ${projectNameDisplay} 的所有者。`,
      `如果你并未请求变更 ${projectNameDisplay} 的所有者，请通过 ${settings.adminEmail} 联系我们。`,
    ]
  },
})

templates.ownershipTransferConfirmationNewOwner = ctaTemplate({
  subject(opts) {
    return `项目所有权转移 - ${settings.appName}`
  },
  title(opts) {
    const projectName = _.escape(
      SpamSafe.safeProjectName(opts.project.name, '你的项目')
    )
    return `${projectName} - 所有者变更`
  },
  message(opts, isPlainText) {
    const nameAndEmail = _.escape(
      _formatUserNameAndEmail(opts.previousOwner, '一位协作者')
    )
    const projectName = _.escape(
      SpamSafe.safeProjectName(opts.project.name, '一个项目')
    )
    const projectNameEmphasized = isPlainText
      ? projectName
      : `<b>${projectName}</b>`
    return [
      `${nameAndEmail} 已将你设为 ${projectNameEmphasized} 的所有者。你现在可以管理 ${projectName} 的共享设置。`,
    ]
  },
  ctaText(opts) {
    return '查看项目'
  },
  ctaURL(opts) {
    const projectUrl = `${
      settings.siteUrl
    }/project/${opts.project._id.toString()}`
    return projectUrl
  },
})

templates.userOnboardingEmail = NoCTAEmailTemplate({
  subject(opts) {
    return `充分利用 ${settings.appName}`
  },
  greeting(opts) {
    return ''
  },
  title(opts) {
    return `充分利用 ${settings.appName}`
  },
  message(opts, isPlainText) {
    const learnLatexLink = EmailMessageHelper.displayLink(
      '30 分钟学会 LaTeX',
      `${settings.siteUrl}/learn/latex/Learn_LaTeX_in_30_minutes?utm_source=overleaf&utm_medium=email&utm_campaign=onboarding`,
      isPlainText
    )
    const templatesLinks = EmailMessageHelper.displayLink(
      '查找精美模板',
      `${settings.siteUrl}/latex/templates?utm_source=overleaf&utm_medium=email&utm_campaign=onboarding`,
      isPlainText
    )
    const collaboratorsLink = EmailMessageHelper.displayLink(
      '与协作者一起工作',
      `${settings.siteUrl}/learn/how-to/Sharing_a_project?utm_source=overleaf&utm_medium=email&utm_campaign=onboarding`,
      isPlainText
    )
    const siteLink = EmailMessageHelper.displayLink(
      'www.overleaf.com',
      settings.siteUrl,
      isPlainText
    )
    const userSettingsLink = EmailMessageHelper.displayLink(
      '这里',
      `${settings.siteUrl}/user/email-preferences`,
      isPlainText
    )
    const onboardingSurveyLink = EmailMessageHelper.displayLink(
      '加入用户反馈计划',
      'https://forms.gle/DB7pdk2B1VFQqVVB9',
      isPlainText
    )
    return [
      `感谢你最近注册 ${settings.appName}。希望你已经感受到它的价值！以下是一些关键功能，帮助你更好地使用本服务：`,
      `${learnLatexLink}：本教程将带你快速、轻松入门 LaTeX，无需任何先验知识。完成后，你就能写出第一份 LaTeX 文档！`,
      `${templatesLinks}：如果你正在寻找起步模板或示例，我们的模板库提供了大量选择，包括简历、项目报告、期刊论文等。`,
      `${collaboratorsLink}：Overleaf 的核心功能之一是项目共享与多人协作。通过这份简明指南，了解如何与同事共享项目。`,
      `${onboardingSurveyLink}，帮助我们把 Overleaf 做得更好！`,
      '再次感谢你使用 Overleaf :)',
      `Lee`,
      `Lee Shalit<br />CEO<br />${siteLink}<hr>`,
      `你收到这封邮件，是因为你最近注册了 Overleaf 账户。如果你此前订阅了产品优惠、公司新闻和活动邮件，可在${userSettingsLink}取消订阅。`,
    ]
  },
})

templates.securityAlert = NoCTAEmailTemplate({
  subject(opts) {
    return `Overleaf 安全提醒：${opts.action}`
  },
  title(opts) {
    return opts.action.charAt(0).toUpperCase() + opts.action.slice(1)
  },
  message(opts, isPlainText) {
    const dateFormatted = moment().format('dddd D MMMM YYYY')
    const timeFormatted = moment().format('HH:mm')
    const helpLink = EmailMessageHelper.displayLink(
      '快速指南',
      `${settings.siteUrl}/learn/how-to/Keeping_your_account_secure`,
      isPlainText
    )

    const actionDescribed = EmailMessageHelper.cleanHTML(
      opts.actionDescribed,
      isPlainText
    )

    if (!opts.message) {
      opts.message = []
    }
    const message = opts.message.map(m => {
      return EmailMessageHelper.cleanHTML(m, isPlainText)
    })

    return [
      `特此通知：${actionDescribed}，时间为 ${dateFormatted} ${timeFormatted}（GMT）。`,
      ...message,
      '如果这是你本人操作，可忽略此邮件。',
      `如果这不是你本人操作，建议尽快联系支持团队 ${settings.adminEmail}，报告为账户可疑活动。`,
      `我们也建议你阅读${helpLink}，帮助保障你的 ${settings.appName} 账户安全。`,
    ]
  },
})

templates.SAMLDataCleared = ctaTemplate({
  subject(opts) {
    return `机构登录已取消关联 - ${settings.appName}`
  },
  title(opts) {
    return '机构登录已取消关联'
  },
  message(opts, isPlainText) {
    return [
      `特此通知：由于我们系统中的一个缺陷，我们暂时停用了你通过所属机构登录 ${settings.appName} 的功能。`,
      `如需恢复使用，请在设置中将你的机构邮箱重新关联到 ${settings.appName} 账户。`,
    ]
  },
  secondaryMessage() {
    return [
      `如果你平时通过所属机构登录 ${settings.appName} 账户，可能需要先设置或重置密码以恢复访问。`,
      '该问题不会影响账户安全，但可能影响了少量用户的许可证权益。对此带来的不便，我们深表歉意。',
      `如有任何问题，请联系支持团队 ${settings.adminEmail}，或直接回复本邮件。`,
    ]
  },
  ctaText(opts) {
    return '更新我的邮箱与机构信息'
  },
  ctaURL(opts) {
    return `${settings.siteUrl}/user/settings`
  },
})

templates.welcome = ctaTemplate({
  subject() {
    return `欢迎使用 ${settings.appName}`
  },
  title() {
    return `欢迎使用 ${settings.appName}`
  },
  greeting() {
    return '你好，'
  },
  message(opts, isPlainText) {
    const logInAgainDisplay = EmailMessageHelper.displayLink(
      '重新登录',
      `${settings.siteUrl}/login`,
      isPlainText
    )
    const helpGuidesDisplay = EmailMessageHelper.displayLink(
      '帮助指南',
      `${settings.siteUrl}/learn`,
      isPlainText
    )
    const templatesDisplay = EmailMessageHelper.displayLink(
      '模板',
      `${settings.siteUrl}/templates`,
      isPlainText
    )

    return [
      `感谢注册 ${settings.appName}！如果你之后找不到入口，可使用邮箱 '${opts.to}' ${logInAgainDisplay}。`,
      `如果你刚接触 LaTeX，欢迎查看我们的${helpGuidesDisplay}和${templatesDisplay}。`,
      `也请花一点时间确认你在 ${settings.appName} 的邮箱地址：`,
    ]
  },
  secondaryMessage() {
    return [
      `附言：我们很乐意和用户交流 ${settings.appName} 的使用体验。无论任何原因，欢迎直接回复本邮件联系我们。问题、建议、反馈都欢迎！`,
    ]
  },
  ctaText() {
    return '确认邮箱'
  },
  ctaURL(opts) {
    return opts.confirmEmailUrl
  },
})

templates.welcomeWithoutCTA = NoCTAEmailTemplate({
  subject() {
    return `欢迎使用 ${settings.appName}`
  },
  title() {
    return `欢迎使用 ${settings.appName}`
  },
  greeting() {
    return '你好，'
  },
  message(opts, isPlainText) {
    const logInAgainDisplay = EmailMessageHelper.displayLink(
      '重新登录',
      `${settings.siteUrl}/login`,
      isPlainText
    )
    const helpGuidesDisplay = EmailMessageHelper.displayLink(
      '帮助指南',
      `${settings.siteUrl}/learn`,
      isPlainText
    )
    const templatesDisplay = EmailMessageHelper.displayLink(
      '模板',
      `${settings.siteUrl}/templates`,
      isPlainText
    )

    return [
      `感谢注册 ${settings.appName}！如果你之后找不到入口，可使用邮箱 '${opts.to}' ${logInAgainDisplay}。`,
      `如果你刚接触 LaTeX，欢迎查看我们的${helpGuidesDisplay}和${templatesDisplay}。`,
      `附言：我们很乐意和用户交流 ${settings.appName} 的使用体验。无论任何原因，欢迎直接回复本邮件联系我们。问题、建议、反馈都欢迎！`,
    ]
  },
})

templates.removeGroupMember = NoCTAEmailTemplate({
  subject(opts) {
    return `你的 ${settings.appName} 账户已从 ${opts.adminName} 的团队中移除`
  },
  title(opts) {
    return `你的 ${settings.appName} 账户已从 ${opts.adminName} 的团队中移除`
  },
  greeting() {
    return ''
  },
  message() {
    const passwordResetUrl = `${settings.siteUrl}/user/password/reset`

    return [
      '请放心，你的账户和项目仍可访问，但有以下变更需要注意：',
      '<ul>' +
        `<li>你的账户将恢复为 ${settings.appName} 免费方案。</li>`,
      `<li>项目协作者将被设置为只读（免费方案下每个项目可邀请 1 位协作者）。</li>`,
      `<li>如果你之前通过 SSO 登录，则需要<a href="${passwordResetUrl}">设置密码</a>后才能访问账户。</li>` +
        '</ul>',
      '如果你认为这是误操作，请联系你的团队管理员。',
      '谢谢！',
      `${settings.appName} 团队`,
    ]
  },
})

templates.taxExemptCertificateRequired = NoCTAEmailTemplate({
  subject(opts) {
    return `需要操作：Overleaf 免税资质验证 [${opts.ein}]`
  },
  title() {
    return '需要操作：免税资质验证'
  },
  greeting() {
    return ''
  },
  message(opts) {
    return [
      '感谢你告知我们贵机构为免税主体。为完成确认，我们还需要补充验证材料。',
      '请回复此邮件，并附上以下任一文件：',
      '<ul>',
      '<li>IRS 认定函（适用于非营利机构及类似组织）</li>',
      '<li>州级转售或免税证明</li>',
      '</ul>',
      `以上材料需与您提供的 EIN 一致：${opts.ein}。`,
      '如有疑问，请直接回复本邮件联系我们。',
      '<br/>',
      '此致，',
      'Overleaf 团队',
      '<br/>',
      `参考编号：${opts.stripeCustomerId}`,
    ]
  },
})

templates.groupMemberLimitWarning = ctaTemplate({
  subject(opts) {
    return `${opts.groupName || '你的团队'} 即将达到成员上限`
  },
  title(opts) {
    return `${opts.groupName || '你的团队'} 即将达到成员上限`
  },
  greeting(opts) {
    return opts.firstName ? `你好，${opts.firstName}：` : '你好，'
  },
  message(opts) {
    return [
      `你的团队“${opts.groupName}”即将达到成员上限。`,
      `<b>当前使用情况：</b>已使用 ${opts.currentMembers}/${opts.membersLimit} 个席位（剩余 ${opts.remainingSeats} 个）`,
      '启用域名捕获后，来自你域名且邮箱已验证的用户可通过 SSO 自动加入团队。达到成员上限后，新用户将无法加入。',
    ]
  },
  secondaryMessage() {
    return [
      '为确保用户访问不中断，建议你增加席位或移除不活跃成员。',
    ]
  },
  ctaText() {
    return '增加席位'
  },
  ctaURL() {
    return `${settings.siteUrl}/user/subscription/group/add-users`
  },
})

function _formatUserNameAndEmail(user, placeholder) {
  if (user.first_name && user.last_name) {
    const fullName = `${user.first_name} ${user.last_name}`
    if (SpamSafe.isSafeUserName(fullName)) {
      if (SpamSafe.isSafeEmail(user.email)) {
        return `${fullName} (${user.email})`
      } else {
        return fullName
      }
    }
  }
  return SpamSafe.safeEmail(user.email, placeholder)
}

export default {
  templates,
  ctaTemplate,
  NoCTAEmailTemplate,
  buildEmail,
}
