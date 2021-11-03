import { useCallback, useEffect, useRef, useState } from "react";

import TimeLineCanvas from "./timeline";

import style from "./style.module.css";
import { Track } from "./interface";
import TrackComponent, { wrapAsClip } from "./track";
import TimelineData from "./data";
import { observer } from "mobx-react-lite";

type DragContext = {
  mouseX: number;
  left: number;
};
let dragContext: DragContext = {
  mouseX: 0,
  left: 0,
};
const Timeline = observer(
  ({ data, debug }: { data: Array<Track>; debug?: boolean }) => {
    const [leftOffset, setLeftOffset] = useState(0);
    const [currentFrame, setCurrentFrame] = useState(0);

    const seekLineRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      TimelineData.updateTracks(data);
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
        seekLineRef.current.style.transform = `translateX(${
          e.clientX - 100
        }px)`;
      }
    }, []);
    const finishDragSeekline = useCallback((e) => {
      window.removeEventListener("mousemove", dragSeekline);
      window.removeEventListener("mouseup", finishDragSeekline);
      document.getElementsByTagName("body")[0].style.userSelect = "auto";

      setCurrentFrame((e.clientX - leftOffset) / TimelineData.ppf);
    }, []);
    // --------------------------------------------------------------------------------------------------

    return (
      <>
        <div
          className={`${style["timeline-wrapper"]} timeline-wrapper`}
          style={{ overflow: "hidden", position: "relative" }}
        >
          <div
            className="track-labels"
            style={{
              fontSize: 14,
              color: "#fff",
              display: "inline-block",
              width: 100,
            }}
          >
            {TimelineData.tracks.map((track) => (
              <div
                key={track.key}
                style={{
                  position: "absolute",
                  height: 30,
                  top: track.index * 45 + 40 + 50 + 15,
                  width: "100%",
                }}
              >
                {track.key}
              </div>
            ))}
          </div>
          <div
            className="timeline-and-tracks"
            style={{
              display: "inline-block",
              width: "calc(100% - 100px)",
              position: "relative",
              overflow: "hidden",
            }}
            onClick={(e) => {
              // 从e.clientX到currentFrame
              setCurrentFrame(
                (e.clientX - leftOffset - 100) / TimelineData.ppf
              );
            }}
          >
            <div
              className={style["seek-line"]}
              ref={seekLineRef}
              style={{
                transform: `translateX(${
                  currentFrame * TimelineData.ppf + leftOffset
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
                  TimelineData.increasePPF();
                } else {
                  TimelineData.decreasePPF();
                }
              }}
            >
              <TimeLineCanvas leftOffset={leftOffset} width={600} />
            </div>
            <TrackComponent onUpdateLeftOffset={setLeftOffset} />
          </div>
        </div>

        {debug && (
          <div style={{ userSelect: "none" }}>
            {<p>pixel per frame: {TimelineData.ppf}</p>}
            {TimelineData.tracks.map((track) => (
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
        )}
      </>
    );
  }
);
export { wrapAsClip };
export default Timeline;
