
export type TextPosition = "top" | "center" | "bottom";

export interface TextElement {
  id: string;
  text: string;
  color: string;
  fontSize: number;
  fontFamily: string;
  position: TextPosition;
}

export interface StickerElement {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type BackgroundType = "color" | "image" | "gradient" | "grid";

export interface SlideData {
  id: string;
  backgroundType: BackgroundType;
  backgroundColor: string;
  backgroundImage: string;
  backgroundGradient?: string;
  gridImages?: string[];
  textElements: TextElement[];
  stickerElements: StickerElement[];
}
