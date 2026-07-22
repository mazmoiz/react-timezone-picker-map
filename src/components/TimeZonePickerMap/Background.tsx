import { MAP_HEIGHT } from '../../utils/geometry';

export interface BackgroundProps {
  fill: string;
  width: number;
}

/** Plain full-canvas water/background rect, sized to the (possibly gutter-extended) viewBox width. */
export function Background({ fill, width }: BackgroundProps) {
  return <rect x={0} y={0} width={width} height={MAP_HEIGHT} fill={fill} aria-hidden="true" />;
}
