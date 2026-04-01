// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  "person.2.fill": "people",
  "briefcase.fill": "business-center",
  "chart.bar.fill": "bar-chart",
  "ticket.fill": "confirmation-number",
  "doc.text.fill": "description",
  "envelope.fill": "email",
  "gear": "settings",
  "plus.circle.fill": "add-circle",
  "magnifyingglass": "search",
  "phone.fill": "phone",
  "calendar": "event",
  "cube.box.fill": "inventory",
  "xmark.circle.fill": "cancel",
  "trash.fill": "delete",
  "trash": "delete",
  "sun.max.fill": "wb-sunny",
  "moon.fill": "nightlight-round",
  "arrow.down.doc.fill": "download",
  "xmark": "close",
  "checkmark": "check",
  "bell.fill": "notifications",
  "bell.slash.fill": "notifications-off",
  "folder.fill": "folder",
  "person.crop.rectangle.fill": "contact-page",
  "person.fill.badge.plus": "person-add",
  "plus": "add",
  "book.fill": "menu-book",
  "pencil": "edit",
  "globe": "language",
  "mappin.circle.fill": "place",
  "banknote": "payments",
  "ticket": "confirmation-number",
  "checkmark.shield.fill": "verified-user",
  "percent": "percent",
  "chart.pie.fill": "pie-chart",
  "cart.fill": "shopping-cart",
  "cart": "shopping-cart",
  "shield.fill": "shield",
  "car.fill": "directions-car",
  "airplane": "flight",
  "megaphone.fill": "campaign",
  "wrench.and.screwdriver.fill": "build",
  "ellipsis.circle.fill": "more-horiz",
  "shippingbox.fill": "inventory-2",
  "desktopcomputer": "computer",
  "building.2.fill": "business",
  "doc.on.doc.fill": "content-copy",
  "lock.fill": "lock",
  "chevron.down": "expand-more",
  "dollarsign.circle.fill": "monetization-on",
  "eye.fill": "visibility",
  "link": "link",
  "checklist": "checklist",
  "pin.fill": "push-pin",
  "clock": "schedule",
  "clock.fill": "schedule",
  "arrow.triangle.2.circlepath": "sync",
  "checkmark.circle.fill": "check-circle",
  "arrow.clockwise": "refresh",
  "arrow.up.right": "open-in-new",
  "exclamationmark.triangle.fill": "warning",
  "exclamationmark.triangle": "warning",
  "exclamationmark.circle.fill": "error",
  "xmark.octagon.fill": "block",
  "doc.text": "description",
  "eye": "visibility",
  "banknote.fill": "payments",
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
