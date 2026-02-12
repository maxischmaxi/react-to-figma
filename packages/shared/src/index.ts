export {
  DesignSpecSchema,
  DesignNodeSchema,
  WebSocketMessageSchema,
  ColorSchema,
  TextStyleSchema,
  AutoLayoutSchema,
} from "./design-spec.js";

export type {
  Color,
  Fill,
  Stroke,
  TextStyle,
  AutoLayout,
  FrameNode,
  ShadcnComponentNode,
  TextNode,
  RectangleNode,
  ImageNode,
  DesignNode,
  DesignSpec,
  WebSocketMessage,
} from "./design-spec.js";

export {
  COMPONENT_MAP,
  SUPPORTED_COMPONENTS,
  isSupported,
  getComponentInfo,
  translateProps,
} from "./component-map.js";

export type { FigmaComponentInfo } from "./component-map.js";
