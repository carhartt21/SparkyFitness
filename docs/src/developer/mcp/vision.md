---
title: Food Photo and Label Tools
description: Current image input, analysis and explicit logging behavior.
---

# Food photo and label tools

These tools use a configured image-capable AI service for X on Track. They belong to the full API-key registry and the in-app vision category; they are not published by the reviewed read-only/OAuth MCP surface. A photo estimate is not verified nutrition. Review quantities and names before saving.

## `sparky_analyze_food_image`

Analyzes a food image and returns an estimate/review result. In-app chat supplies the attached image automatically. For a full-key MCP call, `image_url` must contain a base64 data URL or base64 image data; the handler rejects remote HTTP(S) image URLs rather than fetching them.

Optional context:

- `description`: the user's dish/ingredient/preparation description or correction. Pass it when the user corrects an earlier identification.
- `total_weight`: user-supplied weight with unit, such as `400 g`.
- `meal_type`: the intended meal slot/name.
- `entry_date`: intended calendar day (`YYYY-MM-DD`); an in-app review card otherwise defaults to the account's current day.

Analysis can produce a review card. It does not authorize an additional automatic logging call in the same turn.

## `sparky_log_food_photo`

Logs the most recent analysis only when the user explicitly requests logging **after** reviewing it. Do not also log a card the user has already saved; that would duplicate the meal.

`save_mode` is `ingredients_and_meal` (reusable ingredient foods and a meal) or `one_food` (a combined food). The handler keeps resolved database matches and per-ingredient nutrition in a transaction rather than asking the assistant to retype approximate numbers. Missing a usable analysis/weight returns an error; it is not silently treated as zero nutrition.

## `sparky_scan_label`

Extracts label nutrition from an attached image or base64 `image_url`. Remote HTTP(S) image URLs are rejected here too. Review extracted serving units and per-100-g/per-100-ml values before using them.

If no appropriate AI service is configured, the tools report unavailability. Attachments sent for analysis are processed by that configured provider; do not describe self-hosting as preventing that transfer.

Source contracts: `XoTServer/ai/tools/schemas/vision.ts`; analysis/logging and input checks: `XoTServer/ai/tools/visionTools.ts`.
