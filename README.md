# X on Track

**Keep getting better.**

X on Track is a self-hosted personal health and performance companion for nutrition, training, activity, and longitudinal progress. It helps you understand your current patterns against your own history and goals. It does not rank people or invent a score when the underlying data is unavailable.

The application comprises an Expo/React Native mobile app in [`SparkyFitnessMobile`](SparkyFitnessMobile), a React web app in [`SparkyFitnessFrontend`](SparkyFitnessFrontend), an Express API in [`SparkyFitnessServer`](SparkyFitnessServer), and shared contracts in [`shared`](shared). Package directory names, bundle IDs, API paths, storage keys, URL schemes, and the Expo project/slug remain stable for compatibility with installed apps and existing data. See the [identity and migration record](docs/brand/x-on-track-rebrand.md).

The approved X/track artwork in [`SparkyFitnessMobile/assets/brand`](SparkyFitnessMobile/assets/brand) is the current visual reference. Product and copy principles are in [`PRODUCT.md`](PRODUCT.md).

This repository is based on [CodeWithCJ/SparkyFitness](https://github.com/CodeWithCJ/SparkyFitness). Its [LICENSE](LICENSE), copyright notices, and attribution remain in effect; the software is source-available under non-commercial terms. The [upstream README](docs/upstream/README.md) is retained as historical project and installation documentation. Verify deployment commands against the selected revision before use.

For package-specific build, test, and development instructions, read the applicable `AGENTS.md` files. This rebrand changes presentation identity; it does not deploy production services or migrate personal health records.
