const numbers = new Intl.NumberFormat("fa-IR");

export function faNumber(value: number) {
  return numbers.format(value);
}

export const sampleDays = [
  {
    id: "monday",
    title: "دوشنبه",
    date: "دوشنبه، ۱۰ آذر",
    sessions: [
      { id: "group-training", title: "تمرین گروهی", time: "۰۹:۰۰", capacity: 12, booked: 8 },
      { id: "trainer-session", title: "جلسه با مربی", time: "۱۱:۳۰", capacity: 4, booked: 2 },
      { id: "pilates", title: "کلاس پیلاتس", time: "۱۷:۰۰", capacity: 10, booked: 10 },
    ],
  },
  {
    id: "wednesday",
    title: "چهارشنبه",
    date: "چهارشنبه، ۱۲ آذر",
    sessions: [
      { id: "beginner-pilates", title: "پیلاتس مقدماتی", time: "۱۰:۰۰", capacity: 10, booked: 6 },
      { id: "strength-training", title: "تمرین قدرتی", time: "۱۶:۳۰", capacity: 8, booked: 8 },
      { id: "evening-training", title: "تمرین گروهی", time: "۱۸:۰۰", capacity: 12, booked: 9 },
    ],
  },
] as const;

export type SampleSession = (typeof sampleDays)[number]["sessions"][number];
export const today = sampleDays[0];
