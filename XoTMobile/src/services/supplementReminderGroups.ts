import i18n from '../localization/i18n';

export interface IntakeReminderPlan {
  body: string;
  triggerDate: Date;
  data: Record<string, string>;
  itemLabel: string;
}

/** Group payloads contain occurrence IDs, never names or doses. */
export function supplementGroupMembers(
  data: Record<string, unknown> | undefined
): string[] | null {
  if (
    data?.supplementGroupVersion !== '1' ||
    typeof data.memberKeys !== 'string'
  )
    return null;
  try {
    const parsed: unknown = JSON.parse(data.memberKeys);
    if (
      !Array.isArray(parsed) ||
      parsed.length < 2 ||
      !parsed.every(
        (key): key is string =>
          typeof key === 'string' && key.startsWith('med_')
      ) ||
      new Set(parsed).size !== parsed.length
    )
      return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isIntakeReminder(
  data: Record<string, unknown> | undefined
): boolean {
  return (
    typeof data?.medicationId === 'string' ||
    data?.supplementGroupVersion === '1'
  );
}

/** Same account, intake day and exact firing instant; no rounding or time window. */
export function groupSupplementReminders(
  plans: IntakeReminderPlan[]
): IntakeReminderPlan[] {
  const slots = new Map<string, IntakeReminderPlan[]>();
  for (const plan of plans) {
    if (plan.data.isSupplement !== 'true') continue;
    const slot = JSON.stringify([
      plan.data.serverConfigId,
      plan.data.accountUserId,
      plan.data.entryDate,
      plan.triggerDate.getTime(),
    ]);
    const members = slots.get(slot) ?? [];
    members.push(plan);
    slots.set(slot, members);
  }
  const replacements = new Map<IntakeReminderPlan, IntakeReminderPlan | null>();
  for (const members of slots.values()) {
    if (members.length < 2) continue;
    const ordered = [...members].sort((a, b) =>
      a.data.key < b.data.key ? -1 : a.data.key > b.data.key ? 1 : 0
    );
    const first = ordered[0];
    const count = ordered.length;
    const onlyFollowUps = ordered.every((member) =>
      Boolean(member.data.repeatNumber)
    );
    const body =
      first.data.hideNames === 'true'
        ? i18n.t('medications.notificationSupplementGroupPrivate', {
            defaultValue:
              'Check {{count}} planned supplement intakes in the app.',
            defaultValue_one:
              'Check {{count}} planned supplement intake in the app.',
            defaultValue_other:
              'Check {{count}} planned supplement intakes in the app.',
            count,
          })
        : onlyFollowUps
          ? i18n.t('medications.notificationSupplementGroupRepeatNamed', {
              defaultValue:
                'Already recorded? Check {{items}} in your supplement list.',
              items: ordered.map((member) => member.itemLabel).join(', '),
            })
          : i18n.t('medications.notificationSupplementGroupNamed', {
              defaultValue:
                'Your planned supplements: {{items}}. Open the list to record your intake.',
              items: ordered.map((member) => member.itemLabel).join(', '),
            });
    const common = Object.fromEntries(
      Object.entries(first.data).filter(
        ([key]) =>
          !['medicationId', 'scheduleId', 'baseKey', 'repeatNumber'].includes(
            key
          )
      )
    );
    // Never leave a single-item action target attached to a combined reminder.
    const group: IntakeReminderPlan = {
      body,
      triggerDate: first.triggerDate,
      itemLabel: '',
      data: {
        ...common,
        key: `supplements_${first.data.entryDate}_${first.triggerDate.getTime()}`,
        supplementGroupVersion: '1',
        memberKeys: JSON.stringify(ordered.map((member) => member.data.key)),
        triggerAt: String(first.triggerDate.getTime()),
        count: String(count),
        followUp: String(onlyFollowUps),
      },
    };
    // Keep the first input's position, while names/membership sort independently.
    members.forEach((member, index) =>
      replacements.set(member, index === 0 ? group : null)
    );
  }
  return plans.flatMap((plan) => {
    if (!replacements.has(plan)) return [plan];
    const replacement = replacements.get(plan);
    return replacement ? [replacement] : [];
  });
}
