import { Clip, Track } from "../interface";

export function calcTotalFrames(data: Track[]): number {
  let latestFrame = 0;
  for (let i = 0, l = data.length; i < l; i += 1) {
    for (let j = 0, k = data[i].clips.length; j < k; j += 1) {
      if (latestFrame < data[i].clips[j].end_frame) {
        latestFrame = data[i].clips[j].end_frame;
      }
    }
  }

  return latestFrame;
}

/**
 * 需要处理
 * 1. 排序
 * 2. 重叠部分合并
 */
export function addClipToTrack(track: Track, clip: Clip) {
  const originClips = track.clips;

  // 处理重叠部分
  const targetClips: Clip[] = [];
  const { start_frame: start, end_frame: end } = clip;
  for (let i = 0, l = originClips.length; i < l; i += 1) {
    const tmpClip = originClips[i];
    if (tmpClip.end_frame <= end && tmpClip.start_frame >= start) {
      // 该clip完全被新的clip覆盖， 直接删除
      continue;
    }

    if (tmpClip.end_frame >= end && tmpClip.start_frame <= start) {
      // 中间部分被覆盖， 这时要分割成左右两个clip

      const newClipLeft = { ...tmpClip };
      newClipLeft.end_frame = start - 1;
      const newClipRight = { ...tmpClip };
      newClipRight.start_frame = end + 1;

      targetClips.push(newClipLeft);
      targetClips.push(newClipRight);
      continue;
    }

    if (
      tmpClip.start_frame < start &&
      tmpClip.end_frame >= start &&
      tmpClip.end_frame < end
    ) {
      // 右侧有部分被覆盖
      tmpClip.end_frame = start - 1;
      targetClips.push(tmpClip);
      continue;
    }

    if (
      tmpClip.end_frame > end &&
      tmpClip.start_frame >= start &&
      tmpClip.start_frame <= end
    ) {
      // 左侧有部分被覆盖

      tmpClip.start_frame = end + 1;
      targetClips.push(tmpClip);
      continue;
    }

    // 没有交集
    targetClips.push(tmpClip);
  }

  targetClips.push(clip);

  // 重新排序
  targetClips.sort((a, b) => a.start_frame - b.start_frame);

  track.clips = targetClips;
}

export function addTrack(
  data: Track[],
  info: {
    trackIndex: number;
    reserveTrack?: "up" | "down";
  },
  clip: Clip
) {
  if (info.reserveTrack) {
    let trackIndex = info.trackIndex;
    let inserted = false;

    if (info.reserveTrack === "up") {
      if (info.trackIndex === 0) {
        data.unshift({
          key: "track-0",
          index: 0,

          type: clip.type,
          clips: [{ ...clip, index: 0, key: "clip-0" }],
        });
        inserted = true;
      } else {
        // 转变为向trackIndex -= 1的track的bottom情形
        trackIndex -= 1;
      }
    }

    if (!inserted) {
      inserted = true;
      console.log("向下增轨");
      data.splice(trackIndex + 1, 0, {
        key: `track-${trackIndex + 1}`,
        index: trackIndex + 1,

        type: clip.type,
        clips: [{ ...clip, index: 0, key: "clip-0" }],
      });
    }
  }
}

export function cleanTrack(tracks: Track[]) {
  // 最后删除没有clips的空轨
  let emptyTrackIndex = tracks.findIndex((track) => track.clips.length === 0);
  while (emptyTrackIndex !== -1) {
    tracks.splice(emptyTrackIndex, 1);
    emptyTrackIndex = tracks.findIndex((track) => track.clips.length === 0);
  }
}
// 轨道变动后， 重新整理各个轨道的index/key
export function initTrackOrder(tracks: Track[]) {
  for (let i = 0, l = tracks.length; i < l; i += 1) {
    tracks[i].index = i;
    tracks[i].key = `track-${i}`;

    for (let j = 0, k = tracks[i].clips.length; j < k; j += 1) {
      tracks[i].clips[j].index = j;
      tracks[i].clips[j].key = `clip-${j}`;
    }
  }
}
