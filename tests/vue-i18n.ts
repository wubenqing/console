export function useI18n() {
  return {
    t(key: string, params?: Record<string, string | number>) {
      if (!params) {
        return key
      }

      return Object.entries(params).reduce(
        (text, [paramKey, value]) => text.replaceAll(`{${paramKey}}`, String(value)),
        key
      )
    },
  }
}
