'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronUp, Compass, Folder, FolderOpen } from 'lucide-react'
import { Button, Input, Panel, closeModal, openModal } from '@/components/ui'
import { winChromeSunken } from '@/lib/winChrome'
import { cn } from '@/lib/cn'
import { getParentPath, joinPath, normalizePath, vfs, type FileNode } from '@/lib/vfs'
import { CAD_DIR, CAD_EXT } from '../types'
import { ensureCadFileName, isCadPath } from '../io'

type Mode = 'open' | 'save'

type PickOptions = {
  mode: Mode
  title: string
  confirmLabel: string
  nameLabel: string
  emptyLabel: string
  defaultName?: string
  defaultPath?: string
}

function splitDefault(path?: string, fallbackName?: string): { dir: string; name: string } {
  if (!path) return { dir: CAD_DIR, name: fallbackName ?? '' }
  const trimmed = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path
  const last = trimmed.slice(trimmed.lastIndexOf('/') + 1)
  if (last.includes('.')) return { dir: getParentPath(trimmed), name: last }
  return { dir: trimmed || '/', name: fallbackName ?? '' }
}

function FileDialogForm({
  mode,
  confirmLabel,
  nameLabel,
  emptyLabel,
  defaultName,
  defaultPath,
  onCancel,
  onConfirm,
}: {
  mode: Mode
  confirmLabel: string
  nameLabel: string
  emptyLabel: string
  defaultName?: string
  defaultPath?: string
  onCancel: () => void
  onConfirm: (payload: { path: string }) => void
}) {
  const tModal = useTranslations('modal')
  const t = useTranslations('cad')
  const { dir: initialDir, name: initialName } = splitDefault(defaultPath, defaultName)
  const [cwd, setCwd] = useState(initialDir || CAD_DIR)
  const [nodes, setNodes] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Nullable<string>>(null)
  const [filename, setFilename] = useState(initialName)
  const [error, setError] = useState('')

  const loadDir = useCallback(
    async (path: string) => {
      setLoading(true)
      setError('')
      try {
        const list = await vfs.readDir(path)
        setCwd(path)
        setNodes(list)
        setSelected(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('loadFail'))
      } finally {
        setLoading(false)
      }
    },
    [t],
  )

  useEffect(() => {
    void loadDir(initialDir || CAD_DIR)
  }, [initialDir, loadDir])

  const parentPath = useMemo(() => (cwd === '/' ? null : getParentPath(cwd)), [cwd])
  const visible = nodes.filter((n) => n.isDirectory || isCadPath(n.path))

  const confirm = () => {
    if (mode === 'open') {
      const node = nodes.find((n) => n.path === selected)
      if (!node || node.isDirectory || !isCadPath(node.path)) {
        setError(t('pickFileFirst'))
        return
      }
      onConfirm({ path: node.path })
      return
    }
    const name = filename.trim()
    if (!name) {
      setError(nameLabel)
      return
    }
    try {
      onConfirm({ path: joinPath(cwd, ensureCadFileName(name)) })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadFail'))
    }
  }

  return (
    <div className='flex flex-col gap-2 min-h-0'>
      <div className='flex items-center gap-1'>
        <Button size='sm' disabled={!parentPath} onClick={() => parentPath && void loadDir(parentPath)}>
          <ChevronUp size={12} />
        </Button>
        <div
          className={cn(
            winChromeSunken,
            'min-w-0 flex-1 flex items-center gap-1 text-[11px] px-2 py-0.5 bg-field truncate',
          )}
        >
          <FolderOpen size={12} className='shrink-0' />
          <span className='truncate'>{cwd}</span>
        </div>
      </div>

      <Panel inset padded={false} className='h-52 overflow-auto bg-field'>
        {loading ? (
          <p className='p-3 text-[11px] text-muted'>{t('loading')}</p>
        ) : visible.length === 0 ? (
          <p className='p-3 text-[11px] text-muted'>{emptyLabel}</p>
        ) : (
          <ul>
            {visible.map((node) => {
              const active = selected === node.path
              const Icon = node.isDirectory ? Folder : Compass
              return (
                <li key={node.path}>
                  <button
                    type='button'
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1 text-left text-xs',
                      'hover:bg-[var(--window-title-active)]/20',
                      active && 'bg-[var(--window-title-active)] text-[var(--window-title-text)]',
                    )}
                    onClick={() => {
                      setSelected(node.path)
                      setError('')
                      if (!node.isDirectory) setFilename(node.name)
                    }}
                    onDoubleClick={() => {
                      if (node.isDirectory) {
                        void loadDir(node.path)
                        return
                      }
                      onConfirm({ path: node.path })
                    }}
                  >
                    <Icon size={14} className='shrink-0' />
                    <span className='truncate'>{node.name}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      {mode === 'save' ? (
        <label className='flex items-center gap-2 text-[11px]'>
          <span className='shrink-0'>{nameLabel}</span>
          <Input size='sm' value={filename} onChange={(e) => setFilename(e.target.value)} />
        </label>
      ) : null}

      {error ? <p className='text-[11px] text-red-700 dark:text-red-400'>{error}</p> : null}

      <div className='flex justify-end gap-2'>
        <Button size='sm' onClick={onCancel}>
          {tModal('cancel')}
        </Button>
        <Button size='sm' onClick={confirm}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}

export function pickCadFile(options: PickOptions): Promise<Nullable<{ path: string; name: string }>> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (v: Nullable<{ path: string; name: string }>) => {
      if (settled) return
      settled = true
      resolve(v)
    }

    const id = openModal({
      title: options.title,
      dismissible: true,
      showClose: true,
      widthClassName: 'w-[min(420px,calc(100vw-2rem))]',
      content: (
        <FileDialogForm
          mode={options.mode}
          confirmLabel={options.confirmLabel}
          nameLabel={options.nameLabel}
          emptyLabel={options.emptyLabel}
          defaultName={options.defaultName}
          defaultPath={options.defaultPath}
          onCancel={() => {
            finish(null)
            closeModal(id)
          }}
          onConfirm={(payload) => {
            const path = normalizePath(payload.path)
            finish({
              path,
              name: path.slice(path.lastIndexOf('/') + 1) || `untitled.${CAD_EXT}`,
            })
            closeModal(id)
          }}
        />
      ),
      onClose: () => finish(null),
    })
  })
}
