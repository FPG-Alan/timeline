import React, {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";

import TimeLine from "../lib/main";
import useForceUpdate from "./useForceUpdate";

type Track = {
  key: string;
  index: number;

  type: "audio" | "image" | "video" | "blueprint" | "text";
  clips: Clip[];
};
type Clip = {
  key: string;
  index: number;
  type: Track["type"];
  start_frame: number;
  end_frame: number;
  stateNode: HTMLDivElement | null;
  color?: string;
};

type ActiveTrack = {
  trackIndex: number;
  reserveTrack?: "up" | "down";
};

const testTracks: Array<Track> = [
  {
    key: "track-0",
    type: "image",
    index: 0,
    clips: [
      {
        key: "clip-0",
        index: 0,
        type: "image",
        start_frame: 85,
        end_frame: 260,
        stateNode: null,
      },
    ],
  },
  {
    key: "track-1",
    type: "image",
    index: 1,
    clips: [
      {
        key: "clip-0",
        index: 0,
        type: "image",
        start_frame: 50,
        end_frame: 100,
        stateNode: null,

        color: "#e7b1e0",
      },
      {
        key: "clip-1",
        index: 1,
        type: "image",
        start_frame: 110,
        end_frame: 140,
        stateNode: null,

        color: "#ff22a6",
      },
      {
        key: "clip-2",
        index: 2,
        type: "image",
        start_frame: 160,
        end_frame: 285,
        stateNode: null,

        color: "#85450e",
      },
    ],
  },
  {
    key: "track-2",
    type: "image",
    index: 2,
    clips: [
      {
        key: "clip-0",
        index: 0,
        type: "image",
        start_frame: 10,
        end_frame: 60,
        stateNode: null,

        color: "#ffd919",
      },
      {
        key: "clip-1",
        index: 1,
        type: "image",
        start_frame: 80,
        end_frame: 120,
        stateNode: null,
      },
    ],
  },
];

// 正式轨道高度
const FORMAL_TRACK_HEIGHT = 30;
// 预备轨道高度， 这种轨道可能成为正式轨道
const RESERVE_TRACK_HEIGHT = 15;
// 在mouse down / mouse move 事件回调中启用
const FIRST_SUPER_TRACK_HEIGHT = FORMAL_TRACK_HEIGHT + RESERVE_TRACK_HEIGHT * 2;
const SUPER_TRACK_HEIGHT = FORMAL_TRACK_HEIGHT + RESERVE_TRACK_HEIGHT;
// 右侧拓展区域长度， 单位为秒
const EXTEND_SECONDS = 3;
// clip边界相差10px就吸附在一起
const STICK_WIDTH = 10;

type DragContext = {
  mouseX: number;
  mouseY: number;

  relativeX: number;
  relativeY: number;

  top: number;
  left: number;
  width: number;
  height: number;

  enableChangeTrack: boolean;
  enableMoveX: boolean;

  clip: Clip | null;
  track: Track | null;

  activeTrack: ActiveTrack | null;
};
let dragContext: DragContext = {
  mouseX: 0,
  mouseY: 0,

  relativeX: 0,
  relativeY: 0,

  top: 0,
  left: 0,
  width: 0,
  height: 0,

  enableChangeTrack: false,
  enableMoveX: false,

  clip: null,
  track: null,

  activeTrack: null,
};
let currnetSourceDom: HTMLDivElement | null = null;
let currentDragDom: HTMLDivElement | null = null;

function calcTotalFrames() {
  let latestFrame = 0;
  for (let i = 0, l = testTracks.length; i < l; i += 1) {
    for (let j = 0, k = testTracks[i].clips.length; j < k; j += 1) {
      if (latestFrame < testTracks[i].clips[j].end_frame) {
        latestFrame = testTracks[i].clips[j].end_frame;
      }
    }
  }

  return latestFrame + EXTEND_SECONDS * 30;
}

/**
 * 需要处理
 * 1. 排序
 * 2. 重叠部分合并
 */
function addClipToTrack(track: Track, clip: Clip) {
  console.log(`${clip.key} 变更到轨道${track.index}`);
  const originClips = track.clips;

  // 处理重叠部分
  const targetClips: Clip[] = [];
  const { start_frame: start, end_frame: end } = clip;
  for (let i = 0, l = originClips.length; i < l; i += 1) {
    const tmpClip = originClips[i];
    console.log(
      `[${tmpClip.start_frame}, ${tmpClip.end_frame}] 对比 [${start}, ${end}]`
    );
    if (tmpClip.end_frame <= end && tmpClip.start_frame >= start) {
      // 该clip完全被新的clip覆盖， 直接删除
      console.log("该clip完全被新的clip覆盖， 直接删除");
      continue;
    }

    if (tmpClip.end_frame >= end && tmpClip.start_frame <= start) {
      // 中间部分被覆盖， 这时要分割成左右两个clip
      console.log("该clip中间部分被覆盖");

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
      console.log("该clip右侧有部分被覆盖");

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
      console.log("该clip左侧有部分被覆盖");

      tmpClip.start_frame = end + 1;
      targetClips.push(tmpClip);
      continue;
    }

    // 没有交集
    console.log("该clip与目标clip没有交集");
    targetClips.push(tmpClip);
  }

  targetClips.push(clip);

  // 重新排序
  targetClips.sort((a, b) => a.start_frame - b.start_frame);

  track.clips = targetClips;
}

function addTrack(info: ActiveTrack, clip: Clip) {
  if (info.reserveTrack) {
    console.log(
      `add new track ${
        (info.reserveTrack === "up" && "before") || "after"
      } track ${info.trackIndex}, and insert ${clip.key}`
    );
    let trackIndex = info.trackIndex;
    let inserted = false;

    if (info.reserveTrack === "up") {
      if (info.trackIndex === 0) {
        testTracks.unshift({
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
      testTracks.splice(trackIndex + 1, 0, {
        key: `track-${trackIndex + 1}`,
        index: trackIndex + 1,

        type: clip.type,
        clips: [{ ...clip, index: 0, key: "clip-0" }],
      });
    }

    console.log(testTracks);
  }
}

function App() {
  const [leftOffset, setLeftOffset] = useState(0);
  const [pixelPerFrame, setPixelPerFrame] = useState(2);
  const [activeTrack, setActiveTrack] = useState<ActiveTrack | null>(null);

  const totalFrame = useRef(calcTotalFrames());
  // 相差多少帧， 两个clip就吸附到一起
  const stickFrame = useRef(STICK_WIDTH / pixelPerFrame);

  const forceUpdate = useForceUpdate();

  const startDragHandler = useCallback(
    (e: MouseEvent, track: Track, clip: Clip) => {
      currnetSourceDom = e.target as HTMLDivElement;
      currnetSourceDom.style.visibility = "hidden";
      const rect = currnetSourceDom.getBoundingClientRect();

      dragContext.mouseX = e.clientX;
      dragContext.mouseY = e.clientY;
      dragContext.top = rect.top;
      dragContext.left = rect.left;
      dragContext.width = rect.width;
      dragContext.height = rect.height;

      // 点击时， 指针相对当前clip块左上角的X轴上的读数
      dragContext.relativeX = e.clientX - rect.left;

      // 点击时， 指针相对当前clip块左上角的Y轴上的读数
      const realRelativeY = e.clientY - rect.top;

      // 转换为相对逻辑上的所有轨道的容器的左上角的Y轴上的位置
      if (track.index === 0) {
        dragContext.relativeY = realRelativeY + RESERVE_TRACK_HEIGHT;
      } else {
        dragContext.relativeY =
          realRelativeY + //本底值
          FIRST_SUPER_TRACK_HEIGHT + // 第一个track， 包含上下两条预备轨道
          (track.index - 1) * SUPER_TRACK_HEIGHT; // 其他track， 只包含下面一条预备轨道
      }

      dragContext.clip = clip;
      dragContext.track = track;
      dragContext.enableChangeTrack = false;
      dragContext.enableMoveX = false;
      dragContext.activeTrack = null;

      currentDragDom = document.createElement("div");

      currentDragDom.style.position = "fixed";
      currentDragDom.style.zIndex = "999";
      currentDragDom.style.cursor = "pointer";
      currentDragDom.style.top = dragContext.top + "px";
      currentDragDom.style.left = dragContext.left + "px";
      currentDragDom.style.width = dragContext.width + "px";
      currentDragDom.style.height = dragContext.height + "px";

      currentDragDom.style.background = currnetSourceDom.style.background;

      document.getElementsByTagName("body")[0].appendChild(currentDragDom);

      window.addEventListener("mousemove", dragHandler);
    },
    []
  );

  const dragHandler = useCallback((e) => {
    // 逻辑上， 拖拽块持续的跟着鼠标移动
    const moveX = e.clientX - dragContext.mouseX;
    const moveY = e.clientY - dragContext.mouseY;

    // 变轨相关逻辑， 在变轨逻辑内处理Y轴方向的位移
    // 5px为半径的Y方向上表现出一定的黏性手感
    if (!dragContext.enableChangeTrack && Math.abs(moveY) > 5) {
      dragContext.enableChangeTrack = true;
    }

    if (dragContext.enableChangeTrack) {
      // 计算相对包含所有track的坐标系原点的累加值
      const tmpAccY = dragContext.relativeY + moveY;

      // 根据这个累加值， 得到当前所在的轨道(包括正轨和间轨)索引 logicTrackIndex
      let activeTrackInfo: ActiveTrack = {
        trackIndex: 0,
      };
      if (tmpAccY < FIRST_SUPER_TRACK_HEIGHT) {
        if (tmpAccY <= RESERVE_TRACK_HEIGHT) {
          activeTrackInfo.reserveTrack = "up";
          currentDragDom.style.top = dragContext.top + moveY + "px";
        } else if (tmpAccY >= SUPER_TRACK_HEIGHT) {
          activeTrackInfo.reserveTrack = "down";
          currentDragDom.style.top = dragContext.top + moveY + "px";
        } else {
          currentDragDom.style.top =
            dragContext.top +
            (activeTrackInfo.trackIndex - dragContext.track.index) *
              SUPER_TRACK_HEIGHT +
            "px";
        }
      } else {
        const tmpTrackIndex =
          Math.floor(
            (tmpAccY - FIRST_SUPER_TRACK_HEIGHT) / SUPER_TRACK_HEIGHT
          ) + 1;

        // 这里需要检查一下是不是有这么多条轨道
        activeTrackInfo.trackIndex = Math.min(
          testTracks.length - 1,
          tmpTrackIndex
        );

        if (
          tmpAccY >
          FIRST_SUPER_TRACK_HEIGHT +
            (activeTrackInfo.trackIndex - 1) * SUPER_TRACK_HEIGHT +
            FORMAL_TRACK_HEIGHT
        ) {
          activeTrackInfo.reserveTrack = "down";
          currentDragDom.style.top = dragContext.top + moveY + "px";
        } else {
          currentDragDom.style.top =
            dragContext.top +
            (activeTrackInfo.trackIndex - dragContext.track.index) *
              SUPER_TRACK_HEIGHT +
            "px";
        }
      }

      dragContext.activeTrack = activeTrackInfo;

      setActiveTrack(activeTrackInfo);
    }

    // 横向移动相关, 提供10px为半径的X轴方向上的粘滞手感
    if (!dragContext.enableMoveX && Math.abs(moveX) > 5) {
      dragContext.enableMoveX = true;
    }

    // 吸附效果
    if (dragContext.enableMoveX) {
      // // 检查moveX带来的frame变化
      // const {
      //   start_frame: originStartFrame,
      //   end_frame: originEndFrame,
      //   index: originIndex,
      // } = dragContext.clip;
      // const frameShift = moveX / pixelPerFrame;

      // const tmpStartFrame = originStartFrame + frameShift;
      // const tmpEndFrame = originEndFrame + frameShift;

      // const currentTrack =
      //   (dragContext.activeTrack &&
      //     testTracks[dragContext.activeTrack.trackIndex]) ||
      //   dragContext.track;

      // // 如果此时还在原轨道上， 需要跳过对正在拖拽的clip的检查
      // const skipSameKey =
      //   !dragContext.activeTrack ||
      //   (dragContext.activeTrack &&
      //     dragContext.activeTrack.trackIndex === dragContext.track.index);
      // let shouldStick = false;
      // for (let i = 0, l = currentTrack.clips.length; i < l; i += 1) {
      //   // 向右移动， 检查endFrame即可
      //   const tmpClip = currentTrack.clips[i];
      //   const shouldCheck = !skipSameKey || tmpClip.index !== originIndex;
      //   if (moveX > 0) {
      //     if (shouldCheck) {
      //       if (
      //         Math.abs(tmpEndFrame - tmpClip.start_frame) <= stickFrame.current
      //       ) {
      //         shouldStick = true;

      //         currentDragDom.style.left =
      //           pixelPerFrame *
      //             (tmpClip.start_frame - originEndFrame + originStartFrame) +
      //           "px";
      //         break;
      //       }
      //     }
      //   } else {
      //     // 向左移动， 检查startFrame
      //     if (shouldCheck) {
      //       if (
      //         Math.abs(tmpStartFrame - tmpClip.end_frame) <= stickFrame.current
      //       ) {
      //         console.log("向左吸附", tmpClip.end_frame);
      //         shouldStick = true;
      //         currentDragDom.style.left =
      //           pixelPerFrame * tmpClip.end_frame + "px";
      //         break;
      //       }
      //     }
      //   }
      // }

      // if (!shouldStick) {
      //   currentDragDom.style.left = dragContext.left + moveX + "px";
      // }

      currentDragDom.style.left = dragContext.left + moveX + "px";
    }
  }, []);
  const finishDragHandler = useCallback(() => {
    window.removeEventListener("mousemove", dragHandler);

    if (currentDragDom) {
      // 重新计算当前track的clip的帧数， 只计算x轴上的
      const rect = currentDragDom.getBoundingClientRect();
      const moveX = rect.left - dragContext.left;

      const shiftFrame = Math.abs(moveX) / pixelPerFrame;
      if (moveX > 0) {
        dragContext.clip.start_frame += shiftFrame;
        dragContext.clip.end_frame += shiftFrame;
      } else if (moveX < 0) {
        dragContext.clip.start_frame -= shiftFrame;
        dragContext.clip.end_frame -= shiftFrame;
      }

      if (dragContext.clip.start_frame < 0) {
        dragContext.clip.end_frame += dragContext.clip.start_frame * -1;
        dragContext.clip.start_frame = 0;
      }
      // 根据新的帧数更新total frame
      totalFrame.current = calcTotalFrames();

      // 处理可能存在的变轨操作(变更轨道或增加轨道)
      if (dragContext.activeTrack) {
        const clipIndex = dragContext.track.clips.findIndex(
          (clip) => clip.key === dragContext.clip.key
        );

        // 变轨之前先从原轨道上移除
        if (
          dragContext.activeTrack.trackIndex !== dragContext.track.index ||
          dragContext.activeTrack.reserveTrack
        ) {
          dragContext.track.clips.splice(clipIndex, 1);
        }

        if (dragContext.activeTrack.trackIndex !== dragContext.track.index) {
          if (!dragContext.activeTrack.reserveTrack) {
            // 变轨
            console.log("我们需要进行一次变轨");
            const targetTrack = testTracks.find(
              (track) => track.index === dragContext.activeTrack.trackIndex
            );
            addClipToTrack(targetTrack, dragContext.clip);
          } else {
            // 增轨
            addTrack(dragContext.activeTrack, dragContext.clip);
          }
        } else if (dragContext.activeTrack.reserveTrack) {
          // 增轨
          addTrack(dragContext.activeTrack, dragContext.clip);
        }

        // 最后删除没有clips的空轨
        let emptyTrackIndex = testTracks.findIndex(
          (track) => track.clips.length === 0
        );
        while (emptyTrackIndex !== -1) {
          testTracks.splice(emptyTrackIndex, 1);
          emptyTrackIndex = testTracks.findIndex(
            (track) => track.clips.length === 0
          );
        }

        // 轨道变动后， 重新整理各个轨道的index/key
        for (let i = 0, l = testTracks.length; i < l; i += 1) {
          testTracks[i].index = i;
          testTracks[i].key = `track-${i}`;

          for (let j = 0, k = testTracks[i].clips.length; j < k; j += 1) {
            testTracks[i].clips[j].index = j;
            testTracks[i].clips[j].key = `clip-${j}`;
          }
        }
      }

      document.getElementsByTagName("body")[0].removeChild(currentDragDom);
      currentDragDom = null;

      forceUpdate();
    }

    if (currnetSourceDom) {
      currnetSourceDom.style.visibility = "visible";
      currnetSourceDom = null;
    }

    setActiveTrack(null);
  }, [totalFrame]);

  useEffect(() => {
    window.addEventListener("mouseup", finishDragHandler);

    // for (let i = 0, l = testTracks.length; i < l; i += 1) {
    //   const trackDom = document.getElementById(
    //     `${testTracks[i].type}-track-${i}`
    //   );

    //   if (trackDom) {
    //     // insert clips
    //     // todo: 优化插入性能， 使用fragment
    //     for (let j = 0, k = testTracks[i].clips.length; j < k; j += 1) {
    //       const clip = testTracks[i].clips[j];
    //       const clipDom = (clip.stateNode = document.createElement("div"));
    //       clipDom.style.background = clip.color || "#2291ff";
    //       clipDom.style.height = "100%";
    //       clipDom.style.cursor = "pointer";
    //       clipDom.style.position = "absolute";
    //       clipDom.style.display = "inline-block";
    //       clipDom.style.left = clip.start_frame * pixelPerFrame + "px";
    //       clipDom.style.width =
    //         (clip.end_frame - clip.start_frame) * pixelPerFrame + "px";

    //       clipDom.onmousedown = function (e) {
    //         startDragHandler(e, testTracks[i], clip);
    //       };

    //       trackDom.appendChild(clipDom);
    //     }
    //   }
    // }

    return () => {
      window.removeEventListener("mouseup", finishDragHandler);
      window.removeEventListener("mousemove", dragHandler);
    };
  }, []);

  return (
    <>
      {/* <button
        onClick={() => {
          stickFrame.current = STICK_WIDTH / (pixelPerFrame + 1);
          setPixelPerFrame(pixelPerFrame + 1);
        }}
      >
        放大
      </button>
      <button
        onClick={() => {
          if (pixelPerFrame > 1) {
            stickFrame.current = STICK_WIDTH / (pixelPerFrame - 1);

            setPixelPerFrame(pixelPerFrame - 1);
          }
        }}
      >
        缩小
      </button> */}

      <div style={{ width: 600, background: "#000", fontSize: 0 }}>
        <TimeLine
          leftOffset={leftOffset}
          width={600}
          pixelPerFrame={pixelPerFrame}
        />
        <div
          className="tracks"
          style={{
            width: "100%",
            overflowX: "scroll",
            overflowY: "hidden",
          }}
          onScroll={(e) => {
            setLeftOffset((e.target as HTMLDivElement).scrollLeft * -1);
          }}
        >
          <div className="top-empty" style={{ height: 40 }} />
          {testTracks.map((track, trackIndex) => {
            return (
              <Fragment key={track.key}>
                {trackIndex === 0 && (
                  <div
                    style={{
                      height: RESERVE_TRACK_HEIGHT,
                      width: "100%",
                      background: "#161616",
                      position: "relative",
                      visibility: (activeTrack && "visible") || "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        width: "100%",
                        top: "50%",
                        height: 0,
                        left: 0,
                        borderBottom: "1px solid #ed2576",
                        zIndex: 1,
                        visibility:
                          (activeTrack?.trackIndex === trackIndex &&
                            activeTrack?.reserveTrack === "up" &&
                            "visible") ||
                          "hidden",
                      }}
                    />
                  </div>
                )}
                <div
                  className={`track ${track.type}-track`}
                  id={`${track.type}-track-${trackIndex}`}
                  style={{
                    height: FORMAL_TRACK_HEIGHT,
                    width: totalFrame.current * pixelPerFrame,
                    minWidth: "100%",
                    background: "#2e2e2e",

                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      width: "100%",
                      top: "50%",
                      height: 0,
                      left: 0,
                      borderBottom: "1px solid #ed2576",
                      zIndex: 1,
                      visibility:
                        (activeTrack?.trackIndex === trackIndex &&
                          !activeTrack?.reserveTrack &&
                          "visible") ||
                        "hidden",
                    }}
                  />

                  {track.clips.map((clip) => {
                    return (
                      <div
                        key={clip.key}
                        style={{
                          background: clip.color || "#2291ff",
                          height: "100%",
                          cursor: "pointer",
                          position: "absolute",
                          display: "inline-block",
                          left: clip.start_frame * pixelPerFrame,
                          width:
                            (clip.end_frame - clip.start_frame) * pixelPerFrame,
                        }}
                        onMouseDown={(e) => {
                          startDragHandler(e, track, clip);
                        }}
                      ></div>
                    );
                  })}
                </div>

                <div
                  style={{
                    height: RESERVE_TRACK_HEIGHT,
                    width: "100%",
                    background: "#161616",
                    position: "relative",
                    visibility: (activeTrack && "visible") || "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      width: "100%",
                      top: "50%",
                      height: 0,
                      left: 0,
                      borderBottom: "1px solid #ed2576",
                      zIndex: 1,
                      visibility:
                        (activeTrack?.trackIndex === trackIndex &&
                          activeTrack?.reserveTrack === "down" &&
                          "visible") ||
                        "hidden",
                    }}
                  />
                </div>
              </Fragment>
            );
          })}
          <div className="bottom-empty" style={{ height: 40 }} />
        </div>
      </div>
    </>
  );
}

const ClipsList = React.memo(
  ({
    track,
    startDragHandler,
    pixelPerFrame,
  }: {
    track: Track;
    startDragHandler: any;
    pixelPerFrame: number;
  }) => {
    return (
      <>
        {track.clips.map((clip) => {
          return (
            <div
              key={clip.key}
              style={{
                background: "#2291ff",
                height: "100%",
                cursor: "pointer",
                position: "relative",
                left: clip.start_frame * pixelPerFrame,
                width: (clip.end_frame - clip.start_frame) * pixelPerFrame,
              }}
              onMouseDown={(e) => {
                startDragHandler(e, track, clip);
              }}
            >
              clip
            </div>
          );
        })}
      </>
    );
  },
  (prevProps, nextProps) => {
    return nextProps.pixelPerFrame !== prevProps.pixelPerFrame;
  }
);

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root")
);
