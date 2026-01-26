// Naver Maps JavaScript API v3 타입 정의

declare namespace naver {
  namespace maps {
  class Map {
    constructor(element: HTMLElement | string, options?: MapOptions);
    setCenter(coord: LatLng | LatLngLiteral): void;
    getCenter(): LatLng;
    setZoom(zoom: number, animate?: boolean): void;
    getZoom(): number;
    destroy(): void;
    panTo(coord: LatLng | LatLngLiteral, options?: PanOptions): void;
    fitBounds(bounds: LatLngBounds, options?: FitBoundsOptions): void;
  }

  interface MapOptions {
    center?: LatLng | LatLngLiteral;
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    zoomControl?: boolean;
    zoomControlOptions?: ZoomControlOptions;
    mapTypeControl?: boolean;
    scaleControl?: boolean;
    logoControl?: boolean;
    mapDataControl?: boolean;
    draggable?: boolean;
    scrollWheel?: boolean;
    disableKineticPan?: boolean;
  }

  interface ZoomControlOptions {
    position?: Position;
  }

  interface PanOptions {
    duration?: number;
    easing?: string;
  }

  interface FitBoundsOptions {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  }

  class LatLng {
    constructor(lat: number, lng: number);
    lat(): number;
    lng(): number;
    equals(coord: LatLng): boolean;
    toString(): string;
  }

  interface LatLngLiteral {
    lat: number;
    lng: number;
  }

  class LatLngBounds {
    constructor(sw: LatLng | LatLngLiteral, ne: LatLng | LatLngLiteral);
    extend(coord: LatLng | LatLngLiteral): LatLngBounds;
    getCenter(): LatLng;
    getSW(): LatLng;
    getNE(): LatLng;
  }

  class Marker {
    constructor(options: MarkerOptions);
    setMap(map: Map | null): void;
    getMap(): Map | null;
    setPosition(position: LatLng | LatLngLiteral): void;
    getPosition(): LatLng;
    setTitle(title: string): void;
    setIcon(icon: string | ImageIcon): void;
    setVisible(visible: boolean): void;
    setClickable(clickable: boolean): void;
    setZIndex(zIndex: number): void;
  }

  interface MarkerOptions {
    position: LatLng | LatLngLiteral;
    map?: Map;
    title?: string;
    icon?: string | ImageIcon;
    clickable?: boolean;
    draggable?: boolean;
    visible?: boolean;
    zIndex?: number;
  }

  interface ImageIcon {
    url: string;
    size?: Size;
    scaledSize?: Size;
    origin?: Point;
    anchor?: Point;
  }

  class Size {
    constructor(width: number, height: number);
    width: number;
    height: number;
  }

  class Point {
    constructor(x: number, y: number);
    x: number;
    y: number;
  }

  class InfoWindow {
    constructor(options: InfoWindowOptions);
    open(map: Map, anchor?: Marker | LatLng): void;
    close(): void;
    setContent(content: string | HTMLElement): void;
    getContent(): string | HTMLElement;
  }

  interface InfoWindowOptions {
    content: string | HTMLElement;
    position?: LatLng | LatLngLiteral;
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    anchorSize?: Size;
    pixelOffset?: Point;
  }

  enum Position {
    TOP_LEFT = 1,
    TOP_CENTER = 2,
    TOP_RIGHT = 3,
    LEFT_CENTER = 4,
    CENTER = 5,
    RIGHT_CENTER = 6,
    BOTTOM_LEFT = 7,
    BOTTOM_CENTER = 8,
    BOTTOM_RIGHT = 9,
  }

  // Event
  class Event {
    static addListener(
      target: any,
      eventName: string,
      listener: (...args: any[]) => void
    ): MapEventListener;
    static removeListener(listener: MapEventListener): void;
  }

  interface MapEventListener {
    eventName: string;
    listener: (...args: any[]) => void;
  }

  interface PointerEvent {
    coord: LatLng;
    point: Point;
    offset: Point;
  }
  }
}

declare global {
  interface Window {
    naver: typeof naver;
  }
}
