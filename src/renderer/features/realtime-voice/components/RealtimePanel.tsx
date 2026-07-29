// RealtimePanel - settings panel rendered inside the Advanced section.
//
// Mirrors the VoicePanel structure: a collapsible accordion with source /
// model / persona selectors. Only StepFun AI sources are eligible since the
// Realtime API is StepFun-only at this time.
//
// Like VoiceConfig, RealtimeConfig references an existing AISource by id
// and reuses its apiKey - no new credentials are stored here.

import { useMemo, useState } from 'react'
import { AudioLines, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslation } from '../../../i18n'
import { useAppStore } from '../../../stores/app.store'
import { REALTIME_MODELS, REALTIME_MODES } from '../types'
import type { RealtimeConfig } from '../../../types'

// Providers that support StepFun Realtime API. For now only StepFun itself.
const REALTIME_CAPABLE_PROVIDERS = new Set(['stepfun'])

interface RealtimePanelProps {
  realtime: RealtimeConfig | undefined
  onChange: (realtime: RealtimeConfig) => void
}

export function RealtimePanel({ realtime, onChange }: RealtimePanelProps) {
  const { t } = useTranslation()
  const aiSources = useAppStore((state) => state.config?.aiSources)
  const [open, setOpen] = useState(false)

  // Filter sources that can power Realtime (StepFun provider + has apiKey).
  const realtimeCapableSources = useMemo(() => {
    if (!aiSources) return []
    return aiSources.sources.filter(
      (s) => REALTIME_CAPABLE_PROVIDERS.has(s.provider) && !!s.apiKey,
    )
  }, [aiSources])

  // Merge saved config with defaults so partial / old configs still render.
  const current: RealtimeConfig = {
    sourceId: realtime?.sourceId ?? null,
    realtimeModel: realtime?.realtimeModel ?? REALTIME_MODELS[0].id,
    persona: realtime?.persona ?? 'default',
    mode: realtime?.mode ?? 'audio-chat',
  }

  const isConfigured = !!current.sourceId

  const handleSourceChange = (sourceId: string) => {
    onChange({ ...current, sourceId })
  }

  const handleModelChange = (realtimeModel: string) => {
    onChange({ ...current, realtimeModel })
  }

  const handleModeChange = (mode: string) => {
    onChange({ ...current, mode: mode as RealtimeConfig['mode'] })
  }

  const handlePersonaChange = (persona: 'default' | 'friendly') => {
    onChange({ ...current, persona })
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <AudioLines className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">{t('Realtime Voice')}</span>
          {isConfigured && (
            <span className="text-xs text-muted-foreground">
              ({t('Configured')})
            </span>
          )}
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-3">
          {realtimeCapableSources.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('No StepFun AI source configured. Add a StepFun source with an API key to enable realtime voice.')}
            </p>
          ) : (
            <>
              {/* Source selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {t('AI Source')}
                </label>
                <select
                  value={current.sourceId ?? ''}
                  onChange={(e) => handleSourceChange(e.target.value)}
                  className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">{t('Select a source…')}</option>
                  {realtimeCapableSources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {isConfigured ? (
                <>
                  {/* Model selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      {t('Realtime Model')}
                    </label>
                    <select
                      value={current.realtimeModel}
                      onChange={(e) => handleModelChange(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {REALTIME_MODELS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {t(m.label)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Persona selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      {t('Persona')}
                    </label>
                    <select
                      value={current.persona}
                      onChange={(e) =>
                        handlePersonaChange(e.target.value as 'default' | 'friendly')
                      }
                      className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="default">{t('Default')}</option>
                      <option value="friendly">{t('Friendly')}</option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      {t("Persona adjusts the AI's conversational tone and voice.")}
                    </p>
                  </div>

                  {/* Mode selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      {t('Mode')}
                    </label>
                    <select
                      value={current.mode}
                      onChange={(e) => handleModeChange(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="audio-chat">{t('Audio Chat')}</option>
                      <option value="voice-chat">{t('Voice Chat')}</option>
                    </select>
                    <p className="text-xs text-muted-foreground">
                      {t('Audio Chat uses the voice model directly. Voice Chat transcribes speech and routes it through the normal chat brain for context and tools.')}
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground mt-2">
                  {t('Select a source to configure realtime voice.')}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
