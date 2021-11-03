import React, { FC, useCallback, useRef, useState } from "react";

import useForceUpdate from "./utils/useForceUpdate";

import style from "./style.module.css";
import { Clip, Track } from "./interface";
import {
  addClipToTrack,
  addTrack,
  calcTotalFrames,
  cleanTrack,
  createDragDom,
  initTrackOrder,
} from "./utils";

import TimelineData from "./data";
import { observer } from "mobx-react-lite";
import { toJS } from "mobx";

type ActiveTrack = {
  trackIndex: number;
  reserveTrack?: "up" | "down";
  highlight?: HTMLDivElement;
};
type ActiveClipTrigger = {
  trackIndex: number;
  clipIndex: number;
  triggerDir: "left" | "right";
};

// 正式轨道高度
const FORMAL_TRACK_HEIGHT = 30;
// 预备轨道高度， 这种轨道可能成为正式轨道
const RESERVE_TRACK_HEIGHT = 15;
// 在mouse down / mouse move 事件回调中启用
const FIRST_SUPER_TRACK_HEIGHT = FORMAL_TRACK_HEIGHT + RESERVE_TRACK_HEIGHT * 2;
const SUPER_TRACK_HEIGHT = FORMAL_TRACK_HEIGHT + RESERVE_TRACK_HEIGHT;

const STICK_FRAME = 5;

type DragContext = {
  data: Track[];
  mouseX: number;
  mouseY: number;

  tracksRect?: ReturnType<HTMLDivElement["getBoundingClientRect"]>;

  top: number;
  left: number;
  width: number;
  height: number;

  enableChangeTrack: boolean;
  enableMoveX: boolean;

  clip: Clip | Partial<Clip> | null;
  track: Track | null;

  activeTrack: ActiveTrack | null;

  effectCallback?: (data: Track[]) => void;
  // for drag to extend only
  dragDir?: "left" | "right";
  tracksScrollLeft?: number;
};
let dragContext: DragContext;
let currnetSourceDom: HTMLDivElement | null = null;
let currentDragDom: HTMLDivElement | null = null;

function onClipMoveHandle(accX: number, accY: number) {
  const tmpCurrentTop = dragContext.top + accY;
  const tmpCurrentLeft = dragContext.left + accX;
  if (
    dragContext.tracksRect &&
    tmpCurrentTop >= dragContext.tracksRect.top &&
    tmpCurrentTop <= dragContext.tracksRect.bottom &&
    tmpCurrentLeft >= dragContext.tracksRect.left &&
    tmpCurrentLeft <= dragContext.tracksRect.right
  ) {
    // 变轨相关逻辑， 在变轨逻辑内处理Y轴方向的位移
    // 5px为半径的Y方向上表现出一定的黏性手感
    if (!dragContext.enableChangeTrack && Math.abs(accY) > 5) {
      dragContext.enableChangeTrack = true;
    }

    if (dragContext.enableChangeTrack) {
      // 计算相对包含所有track的坐标系原点的累加值
      const tracksTop = (dragContext.tracksRect?.top || 0) + 40;
      const relativeY = dragContext.mouseY + accY - tracksTop;

      // 根据这个累加值， 得到当前所在的轨道(包括正轨和间轨)索引 logicTrackIndex
      let activeTrackInfo: ActiveTrack = {
        trackIndex: 0,
      };
      if (relativeY < FIRST_SUPER_TRACK_HEIGHT) {
        if (relativeY <= RESERVE_TRACK_HEIGHT) {
          activeTrackInfo.reserveTrack = "up";
          currentDragDom!.style.top = dragContext.top + accY + "px";
        } else if (relativeY >= SUPER_TRACK_HEIGHT) {
          activeTrackInfo.reserveTrack = "down";
          currentDragDom!.style.top = dragContext.top + accY + "px";
        } else {
          currentDragDom!.style.top = tracksTop + RESERVE_TRACK_HEIGHT + "px";
        }
      } else {
        const tmpTrackIndex =
          Math.floor(
            (relativeY - FIRST_SUPER_TRACK_HEIGHT) / SUPER_TRACK_HEIGHT
          ) + 1;

        // 这里需要检查一下是不是有这么多条轨道
        activeTrackInfo.trackIndex = Math.min(
          dragContext.data.length - 1,
          tmpTrackIndex
        );

        if (
          relativeY >
          FIRST_SUPER_TRACK_HEIGHT +
            (activeTrackInfo.trackIndex - 1) * SUPER_TRACK_HEIGHT +
            FORMAL_TRACK_HEIGHT
        ) {
          activeTrackInfo.reserveTrack = "down";
          currentDragDom!.style.top = dragContext.top + accY + "px";
        } else {
          currentDragDom!.style.top =
            tracksTop +
            FIRST_SUPER_TRACK_HEIGHT +
            (activeTrackInfo.trackIndex - 1) * SUPER_TRACK_HEIGHT +
            "px";
        }
      }

      if (
        !dragContext.activeTrack ||
        dragContext.activeTrack.trackIndex !== activeTrackInfo.trackIndex ||
        (dragContext.activeTrack.trackIndex === activeTrackInfo.trackIndex &&
          dragContext.activeTrack.reserveTrack !== activeTrackInfo.reserveTrack)
      ) {
        if (dragContext.activeTrack && dragContext.activeTrack.highlight) {
          dragContext.activeTrack.highlight.style.visibility = "hidden";
        }

        const tmpTrack = dragContext.data[activeTrackInfo.trackIndex];
        const hightlights =
          tmpTrack.stateNode?.querySelectorAll(".highlight-line");
        if (hightlights) {
          if (!activeTrackInfo.reserveTrack) {
            if (activeTrackInfo.trackIndex === 0) {
              activeTrackInfo.highlight = hightlights[1] as HTMLDivElement;
            } else {
              activeTrackInfo.highlight = hightlights[0] as HTMLDivElement;
            }
          } else if (activeTrackInfo.reserveTrack === "up") {
            activeTrackInfo.highlight = hightlights[0] as HTMLDivElement;
          } else {
            if (activeTrackInfo.trackIndex === 0) {
              activeTrackInfo.highlight = hightlights[2] as HTMLDivElement;
            } else {
              activeTrackInfo.highlight = hightlights[1] as HTMLDivElement;
            }
          }

          activeTrackInfo.highlight.style.visibility = "visible";
        }

        dragContext.activeTrack = activeTrackInfo;
      }
    }

    // 横向移动相关, 提供10px为半径的X轴方向上的粘滞手感
    if (!dragContext.enableMoveX && Math.abs(accX) > 5) {
      dragContext.enableMoveX = true;
    }

    // 吸附效果
    if (dragContext.enableMoveX) {
      const tmpLeft = accX + dragContext.left;
      const tmpWidth = dragContext.width;

      const currentTrack =
        (dragContext.activeTrack &&
          dragContext.data[dragContext.activeTrack.trackIndex]) ||
        dragContext.track;

      // 如果此时还在原轨道上， 需要跳过对正在拖拽的clip的检查
      const skipSameKey =
        !dragContext.activeTrack ||
        (dragContext.activeTrack &&
          dragContext.activeTrack.trackIndex === dragContext.track?.index);
      let shouldStick = false;
      if (currentTrack) {
        for (let i = 0, l = currentTrack!.clips.length; i < l; i += 1) {
          const tmpClip = currentTrack!.clips[i];
          const shouldCheck =
            !skipSameKey || tmpClip.index !== dragContext.clip?.index;
          if (shouldCheck) {
            const rect = tmpClip.stateNode!.getBoundingClientRect();
            // 向右吸附， 检查endFrame即可
            if (tmpLeft + tmpWidth <= rect.left) {
              if (
                Math.abs(tmpLeft + tmpWidth - rect.left) <=
                STICK_FRAME * TimelineData.ppf
              ) {
                shouldStick = true;

                if (tmpClip.stateNode) {
                  const rect = tmpClip.stateNode.getBoundingClientRect();
                  const currentRect = currentDragDom!.getBoundingClientRect();
                  currentDragDom!.style.left =
                    rect.left - currentRect.width + "px";
                }

                break;
              }
            }
            // 向左吸附， 检查startFrame
            if (tmpLeft >= rect.left + rect.width) {
              if (
                Math.abs(tmpLeft - (rect.left + rect.width)) <=
                STICK_FRAME * TimelineData.ppf
              ) {
                shouldStick = true;
                if (tmpClip.stateNode) {
                  const rect = tmpClip.stateNode.getBoundingClientRect();
                  currentDragDom!.style.left = rect.left + rect.width + "px";
                }
                break;
              }
            }
          }
        }
      }

      if (!shouldStick) {
        currentDragDom!.style.left = dragContext.left + accX + "px";
      }
    }
  } else {
    if (dragContext.activeTrack) {
      if (dragContext.activeTrack.highlight) {
        dragContext.activeTrack.highlight.style.visibility = "hidden";
      }
      dragContext.activeTrack = null;
    }
    currentDragDom!.style.top = dragContext.top + accY + "px";
    currentDragDom!.style.left = dragContext.left + accX + "px";
  }
}

function dragClipStart(
  data: Track[],
  clientX: number,
  clientY: number,
  track: Track,
  clip: Clip,
  effectCallback?: (data: Track[]) => void
) {
  if (clip.stateNode) {
    currnetSourceDom = clip.stateNode;
    currnetSourceDom!.style.visibility = "hidden";
    const rect = currnetSourceDom!.getBoundingClientRect();
    const tracksContainer = document.getElementById("tracks-container");
    dragContext = {
      data,
      tracksRect: tracksContainer?.getBoundingClientRect(),
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      mouseX: clientX,
      mouseY: clientY,
      clip,
      track,
      enableChangeTrack: false,
      enableMoveX: false,
      activeTrack: null,
      effectCallback,
    };

    currentDragDom = createDragDom(clip.stateNode, rect);

    window.addEventListener("mouseup", dragClipFinish);
    window.addEventListener("mousemove", dragClip);

    document.getElementsByTagName("body")[0].style.userSelect = "none";
  }
}

function dragClip(e: MouseEvent) {
  // 逻辑上， 拖拽块持续的跟着鼠标移动
  const moveX = e.clientX - dragContext.mouseX;
  const moveY = e.clientY - dragContext.mouseY;

  onClipMoveHandle(moveX, moveY);
}

function dragClipFinish(e: MouseEvent) {
  window.removeEventListener("mousemove", dragClip);
  window.removeEventListener("mouseup", dragClipFinish);

  if (currentDragDom) {
    // 重新计算当前track的clip的帧数， 只计算x轴上的
    const rect = currentDragDom.getBoundingClientRect();
    const moveX = rect.left - dragContext.left;

    const shiftFrame = Math.ceil(Math.abs(moveX) / TimelineData.ppf);

    // 取出非 observable 的数据
    const track = dragContext.data.find(
      (track) => track.index === dragContext.track!.index
    );
    const clipIndex = track?.clips.findIndex(
      (item) => item.index === dragContext.clip?.index
    );
    const clip =
      clipIndex !== undefined && clipIndex !== -1 && track?.clips[clipIndex];

    if (track && clip) {
      if (moveX > 0) {
        clip.start_frame += shiftFrame;
        clip.end_frame += shiftFrame;
      } else if (moveX < 0) {
        clip.start_frame -= shiftFrame;
        clip.end_frame -= shiftFrame;
      }

      if (clip.start_frame! < 0) {
        clip.end_frame += clip.start_frame * -1;
        clip.start_frame = 0;
      }
      // 处理可能存在的变轨操作(变更轨道或增加轨道)
      // 先从原轨道上移除
      track.clips.splice(clipIndex, 1);

      if (
        (dragContext.activeTrack && !dragContext.activeTrack.reserveTrack) ||
        !dragContext.activeTrack
      ) {
        // 变轨
        const targetTrack =
          (dragContext.activeTrack &&
            dragContext.data.find(
              (track) => track.index === dragContext.activeTrack!.trackIndex
            )) ||
          track;
        addClipToTrack(targetTrack, clip);
      } else if (
        dragContext.activeTrack &&
        dragContext.activeTrack.reserveTrack
      ) {
        // 增轨
        addTrack(dragContext.data, dragContext.activeTrack, clip);
      }

      cleanTrack(dragContext.data);
      initTrackOrder(dragContext.data);
    }

    document.getElementsByTagName("body")[0].removeChild(currentDragDom);
    currentDragDom = null;

    // 一次性更新所有的数据
    TimelineData.updateTracks(dragContext.data);
  }

  if (currnetSourceDom) {
    currnetSourceDom.style.visibility = "visible";
    currnetSourceDom = null;
  }

  if (dragContext.activeTrack) {
    if (dragContext.activeTrack.highlight) {
      dragContext.activeTrack.highlight.style.visibility = "hidden";
    }
    dragContext.activeTrack = null;
  }
  dragContext.effectCallback?.(dragContext.data);

  document.getElementsByTagName("body")[0].style.userSelect = "auto";
}

function dragNewClip(e: MouseEvent) {
  // 逻辑上， 拖拽块持续的跟着鼠标移动
  const accX = e.pageX - dragContext.mouseX;
  const accY = e.pageY - dragContext.mouseY;

  onClipMoveHandle(accX, accY);
}

function dragNewClipFinish(e: MouseEvent) {
  window.removeEventListener("mousemove", dragNewClip);
  window.removeEventListener("mouseup", dragNewClipFinish);

  if (currentDragDom) {
    // 判断是否落在了某个轨道上
    if (dragContext.activeTrack) {
      if (dragContext.activeTrack.highlight) {
        dragContext.activeTrack.highlight.style.visibility = "hidden";
      }

      // 计算start_frame
      const rect = currentDragDom.getBoundingClientRect();
      const start_frame = rect.left / TimelineData.ppf;

      const newClip: Clip = {
        key: "clip-new",
        index: -1,
        type: "image",
        start_frame,
        end_frame: dragContext.clip!.end_frame! + start_frame,
        stateNode: null,
      };

      if (dragContext.activeTrack.reserveTrack) {
        // 增轨
        addTrack(dragContext.data, dragContext.activeTrack, newClip);
      } else {
        const targetTrack = dragContext.data.find(
          (track) => track.index === dragContext.activeTrack!.trackIndex
        );

        if (targetTrack) {
          addClipToTrack(targetTrack, newClip);
        }
      }

      cleanTrack(dragContext.data);
      initTrackOrder(dragContext.data);

      TimelineData.updateTracks(dragContext.data);
    }

    document.getElementsByTagName("body")[0].removeChild(currentDragDom);
    dragContext.activeTrack = null;
    currentDragDom = null;
  }

  document.getElementsByTagName("body")[0].style.userSelect = "auto";
}

function dragToExtendStart(
  e: React.MouseEvent<HTMLDivElement>,
  dragDir: "left" | "right",
  track: Track,
  clip: Clip,
  effectCallback: (data: Track[]) => void
) {
  currnetSourceDom = clip.stateNode;
  const rect = currnetSourceDom!.getBoundingClientRect();
  const tracksContainer = document.getElementById("tracks-container");

  // @ts-ignore
  dragContext = {
    data: toJS(TimelineData.tracks),
    mouseX: e.clientX,

    left: rect.left,
    width: rect.width,

    tracksRect: tracksContainer?.getBoundingClientRect(),

    clip,
    track,
    dragDir: dragDir,
    tracksScrollLeft: tracksContainer?.scrollLeft,

    activeTrack: null,
    effectCallback,
  };

  window.addEventListener("mouseup", finishDragToExtendHandler);
  window.addEventListener("mousemove", dragToExtendHandler);
}

function dragToExtendHandler(e: MouseEvent) {
  // 逻辑上， 拖拽块持续的跟着鼠标移动
  const moveX = e.clientX - dragContext.mouseX;
  //最小不能小于一帧
  if (dragContext.dragDir === "right") {
    const tmpWitdh = Math.max(dragContext.width + moveX, TimelineData.ppf);

    dragContext.clip!.stateNode!.style.width = tmpWitdh + "px";
  } else {
    const tmpWitdh = Math.max(dragContext.width - moveX, TimelineData.ppf);

    dragContext.clip!.stateNode!.style.width = tmpWitdh + "px";
    dragContext.clip!.stateNode!.style.left =
      dragContext.left +
      (dragContext.tracksScrollLeft || 0) -
      (dragContext.tracksRect?.left || 0) +
      (dragContext.width - tmpWitdh) +
      "px";
  }
}

function finishDragToExtendHandler(e: MouseEvent) {
  window.removeEventListener("mousemove", dragToExtendHandler);
  window.removeEventListener("mouseup", finishDragToExtendHandler);

  // 取出非 observable 的数据
  const track = dragContext.data.find(
    (track) => track.index === dragContext.track!.index
  );
  const clipIndex = track?.clips.findIndex(
    (item) => item.index === dragContext.clip?.index
  );
  const clip =
    clipIndex !== undefined && clipIndex !== -1 && track?.clips[clipIndex];

  if (track && clip) {
    if (dragContext.dragDir === "right") {
      // 右侧拖动， 只需要根据新的宽度算出新的end_frame
      const rect = clip.stateNode!.getBoundingClientRect();

      clip.end_frame =
        clip.start_frame! + Math.ceil(rect.width / TimelineData.ppf) - 1;
    } else {
      // 左侧拖动， 只需要结算新的start_frame
      const rect = clip.stateNode!.getBoundingClientRect();

      clip.start_frame =
        clip.end_frame - Math.ceil(rect.width / TimelineData.ppf) + 1;
    }

    // 先从原轨道上移除
    track.clips.splice(clipIndex, 1);
    addClipToTrack(track, clip);

    cleanTrack(dragContext.data);
    initTrackOrder(dragContext.data);

    TimelineData.updateTracks(dragContext.data);
  }

  dragContext.effectCallback?.(dragContext.data);
}

export function wrapAsClip(dom: HTMLDivElement, totalFrame: number) {
  dom.addEventListener("mousedown", (e) => {
    const rect = dom.getBoundingClientRect();
    const tracksContainer = document.getElementById("tracks-container");
    const tmpWidth = TimelineData.ppf * totalFrame;
    const initTop = e.clientY - 15;
    const initLeft = e.clientX - tmpWidth / 2;
    dragContext = {
      data: toJS(TimelineData.tracks),
      tracksRect: tracksContainer?.getBoundingClientRect(),

      top: initTop,
      left: initLeft,
      width: rect.width,
      height: rect.height,
      mouseX: e.clientX,
      mouseY: e.clientY,

      clip: {
        stateNode: dom as HTMLDivElement,
        start_frame: 1,
        end_frame: totalFrame,
      },
      track: null,
      enableChangeTrack: false,
      enableMoveX: false,
      activeTrack: null,
    };

    currentDragDom = createDragDom(dom, {
      top: initTop,
      left: initLeft,
      width: tmpWidth,
      height: 30,
    });

    window.addEventListener("mouseup", dragNewClipFinish);
    window.addEventListener("mousemove", dragNewClip);

    document.getElementsByTagName("body")[0].style.userSelect = "none";
  });
}

const TrackComponent: FC<{
  onUpdateLeftOffset: (leftOffset: number) => void;
}> = observer(({ onUpdateLeftOffset }) => {
  const [activeClipTrigger, setActiveClipTrigger] =
    useState<ActiveClipTrigger | null>(null);

  return (
    <div
      className={style["tracks"]}
      id="tracks-container"
      onScroll={(e) => {
        onUpdateLeftOffset((e.target as HTMLDivElement).scrollLeft * -1);
      }}
      style={{ userSelect: "none" }}
    >
      <div className="top-empty" style={{ height: 40 }} />
      {TimelineData.tracks.map((track, trackIndex) => {
        const currentWidth = TimelineData.totalFrames * TimelineData.ppf;
        return (
          <div
            key={track.key}
            ref={(ref) => (track.stateNode = ref)}
            className="single-track"
          >
            {trackIndex === 0 && (
              <div
                className={style["reserve-tracks"]}
                style={{
                  height: RESERVE_TRACK_HEIGHT,
                  width: currentWidth,
                }}
              >
                <div className={`${style["highlight-line"]} highlight-line`} />
              </div>
            )}
            <div
              className={`${style["track"]} ${track.type}-track`}
              id={`${track.type}-track-${trackIndex}`}
              style={{
                height: FORMAL_TRACK_HEIGHT,
                width: currentWidth,
              }}
            >
              <div className={`${style["highlight-line"]} highlight-line`} />

              {track.clips.map((clip, clipIndex) => {
                return (
                  <div
                    key={clip.key}
                    className={style["clip"]}
                    style={{
                      background: clip.color || "#2291ff",
                      left:
                        clip.start_frame * TimelineData.ppf - TimelineData.ppf,
                      width:
                        (clip.end_frame - clip.start_frame + 1) *
                        TimelineData.ppf,
                      zIndex:
                        (activeClipTrigger &&
                          activeClipTrigger.trackIndex === trackIndex &&
                          activeClipTrigger.clipIndex === clipIndex &&
                          1) ||
                        0,
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.target = clip.stateNode!;
                      dragClipStart(
                        toJS(TimelineData.tracks),
                        e.clientX,
                        e.clientY,
                        track,
                        clip
                      );
                    }}
                    ref={(ref) => {
                      clip.stateNode = ref;
                    }}
                  >
                    <div
                      className={style["clip-extend-trigger"]}
                      style={{ left: 0 }}
                    >
                      <div
                        className={style["clip-extend-trigger-dragger"]}
                        style={{
                          left: -10,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          setActiveClipTrigger({
                            trackIndex: trackIndex,
                            clipIndex: clipIndex,
                            triggerDir: "left",
                          });

                          dragToExtendStart(e, "left", track, clip, () => {
                            console.log("???????????");
                            setActiveClipTrigger(null);
                          });
                        }}
                      />
                    </div>
                    <div
                      className={style["clip-extend-trigger"]}
                      style={{ right: 0 }}
                    >
                      <div
                        className={`${style["clip-extend-trigger-dragger"]} ${
                          activeClipTrigger &&
                          activeClipTrigger.trackIndex === trackIndex &&
                          activeClipTrigger.clipIndex === clipIndex &&
                          activeClipTrigger.triggerDir === "right" &&
                          style["clip-extend-trigger-dragger-active"]
                        }`}
                        style={{ left: "calc(100% - 10px)" }}
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          setActiveClipTrigger({
                            trackIndex: trackIndex,
                            clipIndex: clipIndex,
                            triggerDir: "right",
                          });

                          dragToExtendStart(e, "right", track, clip, () => {
                            console.log("???????????");
                            setActiveClipTrigger(null);
                          });
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              className={style["reserve-tracks"]}
              style={{
                height: RESERVE_TRACK_HEIGHT,
                width: currentWidth,
                // visibility: (activeTrack && "visible") || "hidden",
              }}
            >
              <div className={`${style["highlight-line"]} highlight-line`} />
            </div>
          </div>
        );
      })}
      <div className="bottom-empty" style={{ height: 40 }} />
    </div>
  );
});

export default TrackComponent;
