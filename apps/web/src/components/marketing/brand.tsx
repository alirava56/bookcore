import Image from "next/image";
import Link from "next/link";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link className={`brand-logo ${light ? "brand-logo--light" : ""}`} href="/" prefetch={false} tabIndex={0}>
      <span className="brand-mark">
        <Image src="/assets/vaghtimo-mark.webp" width={144} height={122} unoptimized alt="" />
      </span>
      <span className="brand-wordmark">
        <strong>وقتیمو</strong>
        <bdi lang="en">Vaghtimo</bdi>
      </span>
      <span className="sr-only">صفحهٔ اصلی</span>
    </Link>
  );
}
