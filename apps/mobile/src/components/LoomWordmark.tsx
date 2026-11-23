import type { ColorValue } from "react-native";
import Svg, { Path } from "react-native-svg";
import { withUniwind } from "uniwind";

const ThemedPath = withUniwind(Path);

export function LoomWordmark(props: {
  readonly height: number;
  readonly color?: ColorValue;
  readonly colorClassName?: string;
}) {
  const aspectRatio = 104 / 40;
  return (
    <Svg
      accessibilityLabel="Loom"
      height={props.height}
      width={props.height * aspectRatio}
      viewBox="12 44 104 40"
    >
      <ThemedPath
        d="M12 44H19.5V76.5H32V84H12V44ZM46.5 44A11.5 20 0 1 1 46.5 84A11.5 20 0 1 1 46.5 44ZM46.5 51.5A4.8 12.5 0 1 0 46.5 76.5A4.8 12.5 0 1 0 46.5 51.5ZM72.5 44A11.5 20 0 1 1 72.5 84A11.5 20 0 1 1 72.5 44ZM72.5 51.5A4.8 12.5 0 1 0 72.5 76.5A4.8 12.5 0 1 0 72.5 51.5ZM87 84V44H94.8L101.5 64.5L108.2 44H116V84H109V56.8L103.5 73.5H99.5L94 56.8V84H87Z"
        color={props.color}
        colorClassName={props.colorClassName}
        fill="currentColor"
      />
    </Svg>
  );
}
