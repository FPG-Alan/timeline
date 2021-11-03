import { action, computed, makeObservable, observable } from "mobx";
import { Track } from "./interface";
import { calcTotalFrames } from "./utils";

// 右侧拓展区域长度， 单位为帧
const EXTEND_FRAMES = 90;

class TimelineData {
  tracks: Track[] = [];
  ppf: number;

  constructor(data: Track[]) {
    makeObservable(this, {
      tracks: observable,
      ppf: observable,
      totalFrames: computed,
      updateTracks: action,
      increasePPF: action,
      decreasePPF: action,
    });
    this.tracks = data;
    this.ppf = 2;
  }

  updateTracks(data: Track[]) {
    this.tracks = data;
  }

  increasePPF(step = 1) {
    this.ppf += step;
  }

  decreasePPF(step = 1) {
    if (this.ppf > step) {
      this.ppf -= step;
    }
  }
  get totalFrames() {
    return calcTotalFrames(this.tracks) + EXTEND_FRAMES;
  }
}

export default new TimelineData([]);
