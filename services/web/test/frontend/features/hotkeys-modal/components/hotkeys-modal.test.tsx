import { render, screen } from '@testing-library/react'
import { ComponentProps } from 'react'
import { SplitTestProvider } from '@/shared/context/split-test-context'
import HotkeysModal from '../../../../../frontend/js/features/hotkeys-modal/components/hotkeys-modal'
import { expect } from 'chai'
import sinon from 'sinon'

const modalProps = {
  show: true,
  handleHide: sinon.stub(),
  trackChangesVisible: false,
}

function renderModal(props: Partial<ComponentProps<typeof HotkeysModal>> = {}) {
  return render(
    <SplitTestProvider>
      <HotkeysModal {...modalProps} {...props} />
    </SplitTestProvider>
  )
}

describe('<HotkeysModal />', function () {
  it('renders the translated modal title on cm6', async function () {
    const { baseElement } = renderModal()

    expect(baseElement.querySelector('.modal-title')?.textContent).to.equal(
      'Hotkeys'
    )
  })

  it('renders translated heading with embedded code', function () {
    const { baseElement } = renderModal()

    const results = baseElement.querySelectorAll('h3 code')
    expect(results).to.have.length(1)
  })

  it('renders the hotkey descriptions', function () {
    const { baseElement } = renderModal()

    const hotkeys = baseElement.querySelectorAll(
      '[data-test-selector="hotkey"]'
    )
    expect(hotkeys).to.have.length(21)
    expect(screen.getByText('Go to code location in PDF')).to.exist
    expect(screen.getByText('Go to PDF location in code')).to.exist
  })

  it('adds extra hotkey descriptions when Track Changes is enabled', function () {
    const { baseElement } = renderModal({ trackChangesVisible: true })

    const hotkeys = baseElement.querySelectorAll(
      '[data-test-selector="hotkey"]'
    )
    expect(hotkeys).to.have.length(24)
  })

  it('uses Ctrl for non-macOS', function () {
    renderModal()

    expect(screen.getAllByText(/Ctrl/)).to.have.length(18)
    expect(screen.queryByText(/Cmd/)).to.not.exist
    expect(screen.getByText('Ctrl + Alt + J')).to.exist
    expect(screen.getByText('Ctrl + Click')).to.exist
  })

  it('uses Cmd for macOS', function () {
    renderModal({ isMac: true })

    expect(screen.getAllByText(/Cmd/)).to.have.length(14)
    expect(screen.getAllByText(/Ctrl/)).to.have.length(4)
    expect(screen.getByText('Cmd + Option + J')).to.exist
    expect(screen.getByText('Cmd + Click')).to.exist
  })
})
