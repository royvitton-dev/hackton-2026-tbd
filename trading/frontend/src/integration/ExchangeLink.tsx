export interface ExchangeLinkProps {
  /** Explicit standalone exchange URL, supplied by the host application. */
  href: string
  className?: string
  label?: string
}

/** Optional host-app adapter. It is not mounted by the standalone exchange. */
export function ExchangeLink({ href, className, label = '휴가 거래소' }: ExchangeLinkProps) {
  return (
    <a
      href={href}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} (새 탭에서 열기)`}
    >
      {label} <span aria-hidden="true">↗</span>
    </a>
  )
}
