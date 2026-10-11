import Image from "next/image";
import { cx } from "@/components/ui/primitives";

export const BRAND_NAME = "PieroloOS";
export const BRAND_DESCRIPTOR = "Business Intelligence & Formation Platform";
export const BRAND_TAGLINE = "From Business Idea to Business Infrastructure";

type BrandLogoProps = {
  /** "mark" renders the emblem only; "lockup" adds wordmark and descriptor. */
  variant?: "mark" | "lockup";
  size?: "sm" | "md" | "lg" | "xl";
  /** Use when the adjacent text already names the brand. */
  decorative?: boolean;
  priority?: boolean;
  className?: string;
};

export function BrandLogo({
  variant = "lockup",
  size = "md",
  decorative = false,
  priority = false,
  className,
}: BrandLogoProps) {
  const mark = (
    <span className={cx("brand-mark", `brand-mark-${size}`)}>
      <Image
        src="/brand/pierolocorp-logo.jpg"
        alt={decorative || variant === "lockup" ? "" : `${BRAND_NAME} emblem`}
        width={192}
        height={192}
        sizes="(min-width: 1024px) 192px, 96px"
        priority={priority}
        className="brand-mark-image"
      />
    </span>
  );

  if (variant === "mark") return <span className={cx("brand-logo-root", className)}>{mark}</span>;

  return (
    <span className={cx("brand-logo-root", "brand-lockup-inline", className)}>
      {mark}
      <span className="brand-text">
        <span className="brand-name">{BRAND_NAME.toUpperCase()}</span>
        <span className="brand-subtitle">{BRAND_DESCRIPTOR}</span>
      </span>
    </span>
  );
}
