export type Track = {
  key: string;
  index: number;
  stateNode: HTMLDivElement | null;
  type: "audio" | "image" | "video" | "blueprint" | "text";
  clips: Clip[];
};
export type Clip = {
  key: string;
  index: number;
  type: Track["type"];
  start_frame: number;
  end_frame: number;
  stateNode: HTMLDivElement | null;
  color?: string;
};
