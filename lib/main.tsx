import { useCallback, useEffect, useRef, useState } from "react";

import TimeLineCanvas from "./timeline";

import style from "./style.module.css";
import { Track } from "./interface";
import TrackComponent, { wrapAsClip } from "./track";
import TimelineData from "./data";

type DragContext = {
  mouseX: number;
  left: number;
};
let dragContext: DragContext = {
  mouseX: 0,
  left: 0,
};

function Timeline({ data }: { data: Array<Track> }) {
  const [leftOffset, setLeftOffset] = useState(0);
  const [pixelPerFrame, setPixelPerFrame] = useState(2);
  const [currentFrame, setCurrentFrame] = useState(0);

  const seekLineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    TimelineData.setData(data);
  }, []);

  // -----------------------------------drag seek line-------------------------------------------------
  const startDragSeekLine = useCallback((e) => {
    dragContext.mouseX = e.clientX;
    dragContext.left =
      (seekLineRef.current!.style.transform &&
        parseInt(
          seekLineRef
            .current!.style.transform.split("translateX(")[1]
            .split("px)")[0]
        )) ||
      0;

    document.getElementsByTagName("body")[0].style.userSelect = "none";
    window.addEventListener("mouseup", finishDragSeekline);
    window.addEventListener("mousemove", dragSeekline);
  }, []);

  const dragSeekline = useCallback((e) => {
    if (seekLineRef.current) {
      seekLineRef.current.style.transform = `translateX(${e.clientX}px)`;
    }
  }, []);
  const finishDragSeekline = useCallback((e) => {
    window.removeEventListener("mousemove", dragSeekline);
    window.removeEventListener("mouseup", finishDragSeekline);
    document.getElementsByTagName("body")[0].style.userSelect = "auto";

    setCurrentFrame((e.clientX - leftOffset) / pixelPerFrame);
  }, []);
  // --------------------------------------------------------------------------------------------------

  return (
    <>
      <div
        className={`${style["timeline-wrapper"]} timeline-wrapper`}
        style={{ overflow: "hidden", position: "relative" }}
        onClick={(e) => {
          // 从e.clientX到currentFrame
          setCurrentFrame((e.clientX - leftOffset) / pixelPerFrame);
        }}
      >
        <div
          className={style["seek-line"]}
          ref={seekLineRef}
          style={{
            transform: `translateX(${
              currentFrame * pixelPerFrame + leftOffset
            }px)`,
          }}
        >
          <div
            className={style["seek-line-header"]}
            onMouseDown={startDragSeekLine}
          />
          <div className={style["seek-line-line"]} />
        </div>
        <div
          onWheel={(e) => {
            if (e.deltaY > 0) {
              setPixelPerFrame(pixelPerFrame + 1);
            } else {
              if (pixelPerFrame > 1) {
                setPixelPerFrame(pixelPerFrame - 1);
              }
            }
          }}
        >
          <TimeLineCanvas
            leftOffset={leftOffset}
            width={600}
            pixelPerFrame={pixelPerFrame}
          />
        </div>
        <TrackComponent
          data={data}
          pixelPerFrame={pixelPerFrame}
          onUpdateLeftOffset={setLeftOffset}
        />
      </div>
      <div style={{ userSelect: "none" }}>
        {<p>pixel per frame: {pixelPerFrame}</p>}
        {data.map((track) => (
          <p key={track.key}>
            {track.key}:
            <br />
            {track.clips.map((clip) => (
              <span key={clip.key}>
                {clip.key}: [{clip.start_frame} - {clip.end_frame}],
              </span>
            ))}
          </p>
        ))}
      </div>
    </>
  );
}
export { wrapAsClip };
export default Timeline;
