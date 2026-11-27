import {
  CalendarCheck2, CalendarDays, ChartNoAxesColumnIncreasing, Layers3, UsersRound,
} from "lucide-react";

export const navLinks = [
  { href: "#features", label: "امکانات" },
  { href: "#solutions", label: "راهکارها" },
  { href: "#pricing", label: "تعرفه‌ها" },
  { href: "#support", label: "پشتیبانی" },
] as const;

export const values = [
  { icon: CalendarDays, title: "رزرو آنلاین جلسات", description: "ثبت و مدیریت رزرو در یک مسیر ساده" },
  { icon: CalendarCheck2, title: "برنامه‌ریزی یکپارچه", description: "جلسات و زمان‌بندی در یک محیط منظم" },
  { icon: UsersRound, title: "کنترل ظرفیت", description: "ظرفیت و جای خالی هر جلسه در یک نگاه" },
  { icon: Layers3, title: "مدیریت شعبه‌ها", description: "چند شعبه و تیم را یک‌جا مدیریت کنید" },
] as const;

export const features = [
  { id: "booking", icon: CalendarCheck2, title: "رزرو آنلاین جلسات", description: "اعضا جلسات منتشرشده را می‌بینند و با حساب خود رزرو می‌کنند." },
  { id: "branches", icon: Layers3, title: "مدیریت چند شعبه", description: "شعبه‌ها و اعضای تیم هر مجموعه را یک‌جا مدیریت کنید." },
  { id: "team", icon: UsersRound, title: "مدیریت مربیان و منابع", description: "نقش اعضای تیم، منابع و برنامهٔ کاری مجموعه را تعریف کنید." },
  { id: "reports", icon: ChartNoAxesColumnIncreasing, title: "گزارش‌های عملیاتی", description: "وضعیت جلسات و رزروها را در بازهٔ دلخواه بررسی کنید." },
] as const;

export const solutions = [
  { image: "strength", title: "باشگاه‌های ورزشی", subtitle: "مدیریت کلاس‌ها، مربیان و رزرو اعضا" },
  { image: "academy", title: "آکادمی‌های ورزشی", subtitle: "برنامه‌ریزی دوره‌ها و جلسات آموزشی", description: "جلسات آموزشی را با برنامهٔ مربیان هماهنگ کنید." },
  { image: "pilates", title: "یوگا و پیلاتس", subtitle: "رزرو کلاس‌ها با ظرفیت مشخص", description: "زمان برگزاری و ظرفیت کلاس‌ها را مشخص کنید." },
  { image: "swimming", title: "استخر و مجموعه‌های آبی", subtitle: "مدیریت سانس و ظرفیت پذیرش", description: "سانس‌ها و ظرفیت پذیرش مجموعه را تنظیم کنید." },
] as const;

export const steps = [
  { id: "setup", number: "۱", title: "ثبت مجموعه", description: "اطلاعات باشگاه یا شعبه خود را وارد کنید." },
  { id: "schedule", number: "۲", title: "تعریف خدمات و جلسات", description: "زمان برگزاری کلاس و ظرفیت آن را تنظیم کنید." },
  { id: "booking", number: "۳", title: "دریافت و مدیریت رزروها", description: "وضعیت رزرو اعضا را مشاهده کنید و رزروها را مدیریت نمایید." },
] as const;

export const questions = [
  {
    title: "وقتیمو برای چه مجموعه‌هایی مناسب است؟",
    answer: "وقتیمو برای مجموعه‌های ورزشی با جلسات یا سانس‌های زمان‌بندی‌شده طراحی شده است، از جمله باشگاه‌ها، آکادمی‌ها، استودیوهای یوگا و پیلاتس و مجموعه‌های آبی.",
  },
  {
    title: "مدیریت ظرفیت جلسات چگونه انجام می‌شود؟",
    answer: "مجموعه ظرفیت هر جلسه را هنگام تعریف آن مشخص می‌کند. جای خالی جلسه با توجه به رزروهای ثبت‌شده مشخص می‌شود و وقتی ظرفیت پر شود، رزرو تازه پذیرفته نمی‌شود.",
  },
  {
    title: "آیا می‌توان چند شعبه را مدیریت کرد؟",
    answer: "بله. هر مجموعه می‌تواند شعبه‌های خودش را تعریف کند و برنامه‌ها و اعضای تیم را در همان فضای کاری مدیریت کند.",
  },
] as const;
