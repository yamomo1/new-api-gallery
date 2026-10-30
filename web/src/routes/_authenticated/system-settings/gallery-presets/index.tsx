import { createFileRoute } from '@tanstack/react-router'

import { GalleryPresetsPage } from '@/features/system-settings/gallery-presets/gallery-presets-page'

export const Route = createFileRoute(
  '/_authenticated/system-settings/gallery-presets/',
)({
  component: GalleryPresetsPage,
})
