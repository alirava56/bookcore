import Image from "next/image";

export function HeroArt() {
  return (
    <figure className="hero-art">
      <div className="hero-halo" aria-hidden="true">
        <svg viewBox="0 0 918 460" fill="none" focusable="false">
          <defs>
            <linearGradient id="hero-halo-main" x1="98" y1="48" x2="736" y2="434" gradientUnits="userSpaceOnUse">
              <stop stopColor="#A78BFA" />
              <stop offset=".56" stopColor="#C4B5FD" />
              <stop offset="1" stopColor="#DDD6FE" />
            </linearGradient>
            <linearGradient id="hero-halo-front" x1="309" y1="113" x2="727" y2="442" gradientUnits="userSpaceOnUse">
              <stop stopColor="#A78BFA" />
              <stop offset=".54" stopColor="#C4B5FD" />
              <stop offset="1" stopColor="#EDE9FE" />
            </linearGradient>
          </defs>
          <path opacity=".52" fill="url(#hero-halo-main)" d="M76 249C35 159 139 55 250 67C319 75 347 89 432 65C488 49 516 39 557 57C604 77 624 106 637 151C655 212 656 218 720 241C778 261 815 292 813 335C809 374 774 407 728 420C677 435 621 435 568 429C511 423 479 410 445 403C408 395 377 400 337 409C270 430 207 423 158 403C104 381 75 333 76 249Z" />
          <path opacity=".59" fill="url(#hero-halo-front)" d="M267 265C216 202 252 145 300 116C355 84 435 81 492 106C547 131 565 172 613 200C646 220 674 221 710 222C762 225 809 255 824 296C845 349 804 393 754 415C707 435 646 441 587 429C536 420 506 404 470 409C417 416 374 418 338 393C299 367 279 321 267 265Z" />
        </svg>
      </div>
      <picture>
        <source media="(max-width: 40rem)" srcSet="/assets/sporty-planner-560.webp" />
        <Image src="/assets/sporty-planner.webp" width={1380} height={1037}
          alt="کاراکتر ورزشی وقتیمو کنار نمای نمونهٔ برنامهٔ جلسات"
          loading="eager" fetchPriority="high" unoptimized />
      </picture>
    </figure>
  );
}
