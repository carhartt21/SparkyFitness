---
layout: home

hero:
  name: "X on Track"
  text: "Log. Understand. Improve."
  tagline: "Keep getting better."
  image:
    src: /logo.png
    alt: X on Track logo
  actions:
    - theme: brand
      text: Get started
      link: /install/docker-compose
    - theme: alt
      text: Explore features
      link: /features/diary/meals

features:
  - title: Nutrition
    details: Capture meals, log foods, and understand nutrient patterns over time.
    link: /features/diary/meals
    linkText: Explore Nutrition Diary →
  - title: Training
    details: Record workouts and see how your training develops against your own history.
    link: /features/exercises/exercise-search
    linkText: Explore Exercises →
  - title: Food tools
    details: Search food sources and use optional AI tools when you choose to.
    link: /features/ai-assistant
    linkText: Explore food tools →
  - title: Cycle Hub
    details: Track cycle information and symptoms privately where that is useful to you.
    link: /features/cycle-hub/
    linkText: Explore Cycle Hub →
  - title: Trusted access
    details: Choose whether to share selected records with people you trust.
    link: /features/family-friends-sharing
    linkText: View Sharing Features →
  - title: Integrations
    details: Connect supported health sources and optional developer tools.
    link: /features/mcp-server
    linkText: View integrations →
  - title: Mobile and web
    details: Use X on Track on your own server and supported devices.
    link: /mobile-app/mobile-app
    linkText: Mobile App Setup →
  - title: Settings
    details: Choose the tracking, reminders, and connections that matter to you.
    link: /features/settings/preferences
    linkText: View Integrations →
  - title: Source and attribution
    details: Review the upstream project and its source-available license.
    link: /features/comparison
    linkText: View upstream comparison →
---

## Overview

Welcome to the documentation for **X on Track**, a self-hosted companion for nutrition, training, activity, and progress relative to your own baseline. The current implementation is based on SparkyFitness; existing backend and package identifiers remain for data continuity.

::: info
**Upstream project**: Installation and feature references in this documentation originated with [CodeWithCJ/SparkyFitness](https://github.com/CodeWithCJ/SparkyFitness). The upstream [Discord community](https://discord.gg/vcnMT5cPEA) and [GitHub Discussions](https://github.com/CodeWithCJ/SparkyFitness/discussions) are not X on Track support channels.
:::

## Documentation Navigation

- **[Installation & Deployment](./install/docker-compose)** - Docker Compose, Coolify, Portainer, Synology NAS, TrueNAS, and Kubernetes guides.
- **[Interactive .env Generator](./install/env-generator)** - Generate production-ready configuration in seconds with client-side cryptography.
- **[Features Overview](./features/comparison)** - Complete feature documentation, diary tracking, and comparison matrices.
- **[Mobile Application](./mobile-app/mobile-app)** - iOS & Android mobile setup and network proxy configuration.
- **[Developer Guide](./developer/getting-started)** - Database schema, security tiers, testing patterns, and API references.
