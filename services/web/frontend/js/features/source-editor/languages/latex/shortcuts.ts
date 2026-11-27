import { Prec } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { toggleRanges } from '../../commands/ranges'
import { buildCursorPosition } from '../../extensions/cursor-position'

export const shortcuts = () => {
  return Prec.high(
    keymap.of([
      {
        key: 'Ctrl-b',
        mac: 'Mod-b',
        preventDefault: true,
        run: toggleRanges('\\textbf'),
      },
      {
        key: 'Ctrl-i',
        mac: 'Mod-i',
        preventDefault: true,
        run: toggleRanges('\\textit'),
      },
      {
        key: 'Ctrl-Alt-j',
        mac: 'Mod-Alt-j',
        run(view) {
          window.dispatchEvent(
            new CustomEvent('cursor:editor:syncToPdf', {
              detail: buildCursorPosition(view.state),
            })
          )
          return true
        },
      },
    ])
  )
}
