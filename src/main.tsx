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
  start_frame: number;
  end_frame: number;
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
        start_frame: 60,
        end_frame: 180,
      },
    ],
  },
];

const FORMAL_TRACK_HEIGHT = 30;
const RESERVE_TRACK_HEIGHT = 15;
// 在mouse down / mouse move 事件回调中启用
const FIRST_SUPER_TRACK_HEIGHT = FORMAL_TRACK_HEIGHT + RESERVE_TRACK_HEIGHT * 2;
const SUPER_TRACK_HEIGHT = FORMAL_TRACK_HEIGHT + RESERVE_TRACK_HEIGHT;
// 右侧拓展区域长度， 单位为秒
const EXTEND_SECONDS = 3;

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

  clip: Clip | null;
  track: Track | null;
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

  clip: null,
  track: null,
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

type ActiveTrack = {
  trackIndex: number;
  reserveTrack?: "up" | "down";
};
function App() {
  const [leftOffset, setLeftOffset] = useState(0);
  const [pixelPerFrame, setPixelPerFrame] = useState(2);
  // const [dragToChangeTrack, setDragToChangeTrack] = useState(false);
  const [activeTrack, setActiveTrack] = useState<ActiveTrack | null>(
    /* {
    trackIndex: 0,
    reserveTrack: "up",
  } */ null
  );

  const totalFrame = useRef(calcTotalFrames());

  const forceUpdate = useForceUpdate();

  const startDragHandler = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, track: Track, clip: Clip) => {
      currnetSourceDom = e.target as HTMLDivElement;
      currnetSourceDom.style.visibility = "hidden";
      const rect = currnetSourceDom.getBoundingClientRect();

      dragContext.mouseX = e.clientX;
      dragContext.mouseY = e.clientY;
      dragContext.top = rect.top;
      dragContext.left = rect.left;
      dragContext.width = rect.width;
      dragContext.height = rect.height;

      dragContext.relativeX = e.clientX - rect.left;

      // 转换为逻辑上的， 包含所有轨道(正规/间轨)的Y轴上的坐标
      const realRelativeY = e.clientY - rect.top;
      if (track.index === 0) {
        dragContext.relativeY = realRelativeY + RESERVE_TRACK_HEIGHT;
      } else {
        dragContext.relativeY =
          realRelativeY + //本底值
          RESERVE_TRACK_HEIGHT +
          FIRST_SUPER_TRACK_HEIGHT + // 第一个track， 包含上下两条预备轨道
          (track.index - 1) * SUPER_TRACK_HEIGHT; // 其他track， 只包含下面一条预备轨道
      }

      dragContext.clip = clip;
      dragContext.track = track;
      dragContext.enableChangeTrack = false;

      currentDragDom = document.createElement("div");

      currentDragDom.style.position = "fixed";
      currentDragDom.style.zIndex = "999";
      currentDragDom.style.cursor = "pointer";
      currentDragDom.style.top = dragContext.top + "px";
      currentDragDom.style.left = dragContext.left + "px";
      currentDragDom.style.width = dragContext.width + "px";
      currentDragDom.style.height = dragContext.height + "px";
      currentDragDom.style.opacity = "0.5";

      currentDragDom.style.background = "#2291ff";

      document.getElementsByTagName("body")[0].appendChild(currentDragDom);

      window.addEventListener("mousemove", dragHandler);
    },
    []
  );

  const dragHandler = useCallback((e) => {
    const moveX = e.clientX - dragContext.mouseX;
    const moveY = e.clientY - dragContext.mouseY;

    if (!dragContext.enableChangeTrack && Math.abs(moveY) > 5) {
      dragContext.enableChangeTrack = true;
    }

    if (dragContext.enableChangeTrack) {
      // 计算相对包含所有track的坐标系原点的累加值
      const tmpAccY = dragContext.relativeY + moveY;

      // 根据这个累加值， 得到当前所在的轨道(包括正轨和间轨)索引 logicTrackIndex
      // 这个值和真实的轨道索引 trackIndex 存在如下换算关系
      // logicTrackIndex = 0, 1, 2 => trackIndex = 0
      // logicTrackIndex = 2n+1, 2n+2 => trackIndex = n

      let activeTrackInfo: ActiveTrack = {
        trackIndex: 0,
      };
      if (tmpAccY < FIRST_SUPER_TRACK_HEIGHT) {
        if (tmpAccY <= RESERVE_TRACK_HEIGHT) {
          activeTrackInfo.reserveTrack = "up";
        } else if (tmpAccY >= SUPER_TRACK_HEIGHT) {
          activeTrackInfo.reserveTrack = "down";
        }
      } else {
        activeTrackInfo.trackIndex =
          Math.floor(
            (tmpAccY - FIRST_SUPER_TRACK_HEIGHT) / SUPER_TRACK_HEIGHT
          ) + 1;

        if (
          tmpAccY >
          FIRST_SUPER_TRACK_HEIGHT +
            (activeTrackInfo.trackIndex - 1) * SUPER_TRACK_HEIGHT +
            FORMAL_TRACK_HEIGHT
        ) {
          activeTrackInfo.reserveTrack = "down";
        }
      }
      currentDragDom.style.top = dragContext.top + moveY + "px";
      setActiveTrack(activeTrackInfo);
    }
    currentDragDom.style.left = dragContext.left + moveX + "px";
  }, []);
  const finishDragHandler = useCallback(() => {
    window.removeEventListener("mousemove", dragHandler);

    setActiveTrack(null);
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

      document.getElementsByTagName("body")[0].removeChild(currentDragDom);
      currentDragDom = null;

      forceUpdate();
    }

    if (currnetSourceDom) {
      currnetSourceDom.style.visibility = "visible";
      currnetSourceDom = null;
    }
  }, [totalFrame]);

  useEffect(() => {
    window.addEventListener("mouseup", finishDragHandler);

    return () => {
      window.removeEventListener("mouseup", finishDragHandler);
      window.removeEventListener("mousemove", dragHandler);
    };
  }, []);

  return (
    <>
      {/* <button
        onClick={() => {
          setPixelPerFrame(pixelPerFrame + 1);
        }}
      >
        放大
      </button>
      <button
        onClick={() => {
          if (pixelPerFrame > 1) {
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
              <>
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
                  style={{
                    height: FORMAL_TRACK_HEIGHT,
                    width: totalFrame.current * pixelPerFrame,
                    minWidth: "100%",
                    background: "#2e2e2e",

                    position: "relative",
                  }}
                  key={track.key}
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
                  <ClipsList
                    track={track}
                    startDragHandler={startDragHandler}
                    pixelPerFrame={pixelPerFrame}
                  />
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
              </>
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
