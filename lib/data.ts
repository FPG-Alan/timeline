import { Track } from "./interface";

class TimelineData {
  data: Track[] = [];

  setData(data: Track[]) {
    this.data = data;
  }
}

export default new TimelineData();
