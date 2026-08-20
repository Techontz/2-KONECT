/**
 * The glyph set the sourcing and tracking surfaces share.
 *
 * Inline SVG rather than an icon package: these are the handful of shapes the
 * marketplace actually uses, and shipping a whole library to draw nine of them
 * costs a phone more than it is worth.
 */

type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function PinIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1116 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function GlobeIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
    </svg>
  );
}

export function PlaneIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10.2 13.8L3 11.4l1.6-1.6 3.9.8 3-3-6.2-3.4L7 2.5l8.4 2.6 2.6-2.6a2 2 0 112.8 2.8l-2.6 2.6L20.8 16l-1.7 1.7-3.4-6.2-3 3 .8 3.9-1.6 1.6-2.4-7.2z" />
    </svg>
  );
}

export function ShipIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 17.5c1.6 0 1.6 1.5 3.2 1.5s1.6-1.5 3.2-1.5 1.6 1.5 3.2 1.5 1.6-1.5 3.2-1.5 1.6 1.5 3.2 1.5" />
      <path d="M4.5 14L6 9h12l1.5 5" />
      <path d="M12 9V4H9" />
    </svg>
  );
}

export function TruckIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 16V6h11v10M14 9h4l3 3.5V16h-7" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </svg>
  );
}

export function ClockIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.2 2" />
    </svg>
  );
}

export function CheckIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className} strokeWidth={2.2}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export function ShieldIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3l7 3v5.5c0 4.4-3 8.1-7 9.5-4-1.4-7-5.1-7-9.5V6l7-3z" />
      <path d="M9.3 12.2l1.9 1.9 3.6-3.7" />
    </svg>
  );
}

export function LockIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" />
      <path d="M8 10.5V7.8a4 4 0 018 0v2.7" />
    </svg>
  );
}

export function BoxIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M21 8.2L12 3 3 8.2v7.6L12 21l9-5.2V8.2z" />
      <path d="M3 8.2l9 5.2 9-5.2M12 13.4V21" />
    </svg>
  );
}

export function ReceiptIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 3h12v18l-2.4-1.6L13.2 21l-2.4-1.6L8.4 21 6 19.4V3z" />
      <path d="M9.2 8h5.6M9.2 12h5.6" />
    </svg>
  );
}

export function SendIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M21 3L10.5 13.5M21 3l-6.8 18-3.7-7.5L3 9.8 21 3z" />
    </svg>
  );
}

export function FlagIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5 21V4M5 4h11l-1.6 3.4L16 11H5" />
    </svg>
  );
}

export function WarehouseIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 21V9.5L12 5l9 4.5V21" />
      <path d="M8 21v-6h8v6M8 17.5h8" />
    </svg>
  );
}

export function XIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className} strokeWidth={2}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function RefundIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

export function DotIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Map a backend `icon` name onto a component. */
export const JOURNEY_ICONS: Record<string, (props: IconProps) => React.JSX.Element> = {
  receipt: ReceiptIcon,
  package: BoxIcon,
  send: SendIcon,
  plane: PlaneIcon,
  flag: FlagIcon,
  shield: ShieldIcon,
  warehouse: WarehouseIcon,
  truck: TruckIcon,
  check: CheckIcon,
  x: XIcon,
  refund: RefundIcon,
  dot: DotIcon,
};
