interface BrandMarkProps {
  size?: number;
  className?: string;
}

/** Static identity, separate from any measured goal. */
export default function BrandMark({ size = 36, className }: BrandMarkProps) {
  return (
    <span role="img" aria-label="X on Track" className={className}>
      <img
        src="/images/brand/progression-x-light.png"
        width={size}
        height={size}
        className="dark:hidden"
        alt=""
      />
      <img
        src="/images/brand/progression-x.png"
        width={size}
        height={size}
        className="hidden dark:block"
        alt=""
      />
    </span>
  );
}
