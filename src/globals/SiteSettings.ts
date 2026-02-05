import type { GlobalConfig } from 'payload'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  label: {
    en: 'Site Settings',
    sv: 'Webbplatsinställningar',
    fi: 'Sivuston asetukset',
  },
  fields: [
    {
      name: 'associationName',
      type: 'text',
      required: true,
      localized: true,
      defaultValue: 'Österbottens Whiskysällskap rf.',
    },
    {
      name: 'tagline',
      type: 'text',
      localized: true,
    },
    {
      name: 'landingContent',
      type: 'richText',
      localized: true,
    },
    {
      name: 'membershipIntro',
      type: 'richText',
      localized: true,
    },
  ],
}
