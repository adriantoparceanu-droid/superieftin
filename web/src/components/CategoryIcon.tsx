import {
  Laptop, Wrench, Recycle, TabletSmartphone, Cable, Plug, Smartphone,
  BatteryFull, Shield, BatteryCharging, Mouse, Package, Usb, ShieldCheck,
  Sparkles, KeyRound, Car, CarFront, Zap, Layers, Speaker, BatteryMedium,
  PlugZap, ShoppingCart, Headphones, Monitor, Watch, Camera, Gamepad2, Tv,
  type LucideIcon,
} from 'lucide-react'

// Iconitele disponibile pentru categorii. Cheia (kebab-case) se salveaza in
// categories.icon si se alege din dropdown in /admin/categorii.
const ICONS: Record<string, LucideIcon> = {
  'laptop': Laptop,
  'smartphone': Smartphone,
  'tableta-touchscreen': TabletSmartphone,
  'recond': Wrench,
  'second-hand': Recycle,
  'cablu': Cable,
  'incarcator': Plug,
  'incarcator-rapid': PlugZap,
  'baterie': BatteryMedium,
  'baterie-plina': BatteryFull,
  'baterie-incarcare': BatteryCharging,
  'folie-protectie': Shield,
  'folie-verificata': ShieldCheck,
  'mouse-periferice': Mouse,
  'accesorii': Package,
  'usb': Usb,
  'nou': Sparkles,
  'licenta': KeyRound,
  'auto': Car,
  'suport-auto': CarFront,
  'powerbank': Zap,
  'husa': Layers,
  'boxa': Speaker,
  'casti': Headphones,
  'monitor': Monitor,
  'smartwatch': Watch,
  'camera': Camera,
  'gaming': Gamepad2,
  'tv': Tv,
  'cos': ShoppingCart,
}

export const CATEGORY_ICON_NAMES = Object.keys(ICONS)

export function CategoryIcon({ name, className }: { name?: string | null; className?: string }) {
  const Icon = (name && ICONS[name]) || ShoppingCart
  return <Icon className={className} aria-hidden="true" />
}
