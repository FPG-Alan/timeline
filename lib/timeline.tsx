import { FC, useEffect, useRef, useState } from "react";

type TimeLineProps = {
  // 一般为负值， 最大为0
  leftOffset: number;
  width: number;

  pixelPerFrame: number;
};
const CANVAS_HEIGHT = 50;
const FPS = 30;
// 两个主时间点间距, 单位为秒
const BIG_STEP = 1;
const TimeLine: FC<TimeLineProps> = ({ leftOffset, pixelPerFrame, width }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvas.current) {
      /**
       * increase resolution of canvas
       * @see https://stackoverflow.com/a/15666143
       */
      const dpr = window.devicePixelRatio || 1;
      const bsr = 1;
      const ratio = dpr / bsr;
      canvas.current.width = width * ratio;
      canvas.current.height = CANVAS_HEIGHT * ratio;
      canvas.current.style.width = width + "px";
      canvas.current.style.height = CANVAS_HEIGHT + "px";
      canvas.current.getContext("2d")?.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
  }, []);
  useEffect(() => {
    if (canvas.current) {
      const ctx = canvas.current.getContext("2d");
      const { width, height } = canvas.current.getBoundingClientRect();
      if (ctx) {
        ctx.clearRect(0, 0, width, height);
        ctx.beginPath();

        ctx.font = "9px Arial";
        ctx.lineWidth = 1;

        let currentPosition = leftOffset;
        let currentTime = 0;
        while (currentPosition < width) {
          if (currentPosition >= 0) {
            ctx.beginPath();
            ctx.strokeStyle = "#fff";
            ctx.moveTo(currentPosition, height);
            ctx.lineTo(currentPosition, height - 20);
            ctx.stroke();
            ctx.closePath();

            ctx.strokeText(
              currentTime.toString(),
              currentPosition + 4,
              height - 15
            );
          }

          const scopeWidth = BIG_STEP * FPS * pixelPerFrame;
          const targetPosition = currentPosition + scopeWidth;
          const tempStep = scopeWidth / 10;
          currentPosition += tempStep;

          while (currentPosition < targetPosition) {
            ctx.strokeStyle = "#c9c9c9";
            ctx.beginPath();
            ctx.moveTo(currentPosition, height);
            ctx.lineTo(currentPosition, height - 12);
            ctx.stroke();
            ctx.closePath();
            currentPosition += tempStep;
          }
          currentPosition = targetPosition;
          // currentPosition += BIG_STEP * FPS * pixelPerFrame;
          currentTime += BIG_STEP;
        }
      }
    }
  }, [leftOffset, pixelPerFrame]);
  return <canvas width={width} height={CANVAS_HEIGHT} ref={canvas} />;
};

export default TimeLine;
