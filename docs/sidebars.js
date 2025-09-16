/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */

// @ts-check

/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  // By default, Docusaurus generates a sidebar from the docs folder structure
  tutorialSidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'getting-started',
        'authentication',
        'rate-limiting',
      ],
    },
    {
      type: 'category',
      label: 'API Guide',
      items: [
        {
          type: 'category',
          label: 'Core Resources',
          items: [
            'api/employees',
            'api/schedules',
            'api/rules',
            'api/notifications',
          ],
        },
        {
          type: 'category',
          label: 'AI Features',
          items: [
            'api/natural-language',
            'api/schedule-generation',
            'api/optimization',
            'api/analytics',
          ],
        },
        {
          type: 'category',
          label: 'Real-time',
          items: [
            'api/websockets',
            'api/webhooks',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Code Examples',
      items: [
        'examples',
        {
          type: 'category',
          label: 'Language SDKs',
          items: [
            'examples/javascript',
            'examples/python',
            'examples/php',
            'examples/go',
            'examples/ruby',
          ],
        },
        {
          type: 'category',
          label: 'Framework Integration',
          items: [
            'examples/react',
            'examples/vue',
            'examples/django',
            'examples/laravel',
            'examples/rails',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Tutorials',
      items: [
        'tutorials/quick-start',
        'tutorials/employee-management',
        'tutorials/schedule-automation',
        'tutorials/nlp-rules',
        'tutorials/real-time-updates',
        'tutorials/analytics-dashboard',
      ],
    },
    {
      type: 'category',
      label: 'Advanced',
      items: [
        'advanced/webhooks',
        'advanced/bulk-operations',
        'advanced/performance',
        'advanced/security',
        'advanced/error-handling',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'changelog',
        'migration-guides',
        'faq',
        'troubleshooting',
        'support',
      ],
    },
  ],
};

module.exports = sidebars;