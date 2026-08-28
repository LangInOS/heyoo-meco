/**
 * ProviderCapabilityBadge — inline capability indicator for provider list items.
 *
 * Renders small icons showing which extra features a provider supports.
 * Currently shows a Mic icon for voice/STT capability.
 *
 * Kept separate from the dropdown so it can be reused in AISourcesSection
 * and anywhere else providers are listed.
 */

import { Mic } from 'lucide-react'
import { useTranslation } from '../../i18n'
import { PROVIDER_CAPABILITIES } from '../../../shared/constants/provider-capabilities'

interface ProviderCapabilityBadgeProps {
  providerId: string
}

export function ProviderCapabilityBadge({ providerId }: ProviderCapabilityBadgeProps) {
  const { t } = useTranslation()
  const caps = PROVIDER_CAPABILITIES[providerId]

  if (!caps?.voice) return null

  return (
    <Mic className="w-3 h-3 text-primary" title={t('Supports voice & TTS')} />
  )
}
