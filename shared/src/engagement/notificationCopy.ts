import type { EngagementReminderKindV3 } from "../schemas/api/Engagement.api.zod.ts";

/** Reviewed prompts shared by local and remote delivery. No inferred health claims. */
export const ENGAGEMENT_NOTIFICATION_COPY = {
  coaching_digest: {
    titleKey: "coaching.digestTitle",
    bodyKey: "coaching.digestBody",
    en: {
      title: "Recommendations",
      body: "Recommendations are ready for your review.",
    },
    de: {
      title: "Empfehlungen",
      body: "Deine Empfehlungen stehen zur Prüfung bereit.",
    },
  },
  coaching_action: {
    titleKey: "coaching.actionTitle",
    bodyKey: "coaching.actionBody",
    en: {
      title: "Your next step",
      body: "An accepted action is due. Open it to review your next step.",
    },
    de: {
      title: "Dein nächster Schritt",
      body: "Eine angenommene Aufgabe ist fällig. Öffne sie für deinen nächsten Schritt.",
    },
  },
  check_in: {
    titleKey: "engagement.checkinReminderTitle",
    bodyKey: "engagement.checkinReminderBody",
    en: {
      title: "📝 Your daily check-in",
      body: "How are you today? A few details are enough.",
    },
    de: {
      title: "📝 Dein Tages-Check-in",
      body: "Wie geht es dir heute? Ein paar Angaben genügen.",
    },
  },
  habit: {
    titleKey: "engagement.habitReminderTitle",
    bodyKey: "engagement.habitReminderBody",
    en: {
      title: "🌱 Your habit",
      body: "Already done? Record your planned habit when you are ready.",
    },
    de: {
      title: "🌱 Deine Gewohnheit",
      body: "Schon erledigt? Erfasse deine geplante Gewohnheit, wenn du soweit bist.",
    },
  },
  weigh_in: {
    titleKey: "engagement.weighInReminderTitle",
    bodyKey: "engagement.weighInReminderBody",
    en: {
      title: "⚖️ Record your weight",
      body: "Would you like to record today’s weight? Open your check-in.",
    },
    de: {
      title: "⚖️ Gewicht erfassen",
      body: "Möchtest du dein heutiges Gewicht erfassen? Öffne deinen Check-in.",
    },
  },
  hydration: {
    titleKey: "notifications.hydration.title",
    bodyKey: "notifications.hydration.body",
    en: {
      title: "💧 Log a drink",
      body: "Had something to drink? Record it when it works for you.",
    },
    de: {
      title: "💧 Dein Getränk",
      body: "Schon etwas getrunken? Erfasse dein Getränk, wenn es für dich passt.",
    },
  },
  meal_capture: {
    titleKey: "engagement.captureReminderTitle",
    bodyKey: "engagement.captureReminderBody",
    en: {
      title: "🍽️ Your meal check-in",
      body: "Have you eaten? Record your meal or take a photo. You can also mark “No meal”.",
    },
    de: {
      title: "🍽️ Dein Mahlzeiten-Check-in",
      body: "Hast du gegessen? Erfasse deine Mahlzeit oder mach ein Foto. Auch „Keine Mahlzeit“ ist möglich.",
    },
  },
  meal_review: {
    titleKey: "engagement.reviewReminderTitle",
    bodyKey: "engagement.reviewReminderBody",
    en: {
      title: "📷 Review your meal photo",
      body: "Your meal photo is saved. Add the details when you have a moment.",
    },
    de: {
      title: "📷 Dein Mahlzeitenfoto",
      body: "Dein Mahlzeitenfoto ist gespeichert. Ergänze die Angaben, wenn du einen Moment Zeit hast.",
    },
  },
  movement_break: {
    titleKey: "engagement.movementReminderTitle",
    bodyKey: "engagement.movementReminderBody",
    en: {
      title: "🚶 A moment to move?",
      body: "If it fits your day, open a short movement-break timer.",
    },
    de: {
      title: "🚶 Zeit für eine Bewegungspause?",
      body: "Wenn es in deinen Tag passt, öffne den Timer für eine kurze Bewegungspause.",
    },
  },
  mobility: {
    titleKey: "mobility.reminderTitle",
    bodyKey: "mobility.reminderBody",
    en: {
      title: "🧘 Your mobility routine",
      body: "Your planned routine is ready. Open it when it works for you.",
    },
    de: {
      title: "🧘 Deine Mobilitätsroutine",
      body: "Deine geplante Routine steht bereit. Öffne sie, wenn es für dich passt.",
    },
  },
} as const satisfies Record<
  EngagementReminderKindV3,
  {
    titleKey: string;
    bodyKey: string;
    en: { title: string; body: string };
    de: { title: string; body: string };
  }
>;
