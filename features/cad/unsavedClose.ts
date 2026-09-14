import { modal } from '@/components/ui'

export type CadUnsavedChoice = 'save' | 'discard' | 'cancel'

export function confirmCadUnsaved(labels: {
  title: string
  message: string
  save: string
  discard: string
  cancel: string
}): Promise<CadUnsavedChoice> {
  return new Promise((resolve) => {
    modal.open({
      title: labels.title,
      content: labels.message,
      dismissible: false,
      showClose: true,
      widthClassName: 'w-[min(380px,calc(100vw-2rem))]',
      actions: [
        { id: 'save', label: labels.save, primary: true },
        { id: 'discard', label: labels.discard },
        { id: 'cancel', label: labels.cancel },
      ],
      onClose: ({ reason, actionId }) => {
        if (reason === 'action' && actionId === 'save') resolve('save')
        else if (reason === 'action' && actionId === 'discard') resolve('discard')
        else resolve('cancel')
      },
    })
  })
}
