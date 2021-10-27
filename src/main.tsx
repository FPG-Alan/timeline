import React, { useState } from "react";
import ReactDOM from "react-dom";

import TimeLine from "../lib/main";

function App() {
  const [pixelPerFrame, setPixelPerFrame] = useState(2);
  console.log(pixelPerFrame);
  return (
    <>
      <div style={{ width: 600, background: "#000", fontSize: 0 }}>
        <TimeLine leftOffset={0} width={600} pixelPerFrame={pixelPerFrame} />
      </div>

      <button
        onClick={() => {
          setPixelPerFrame(pixelPerFrame + 2);

          console.log("????");
        }}
      >
        放大
      </button>
      <button>缩小</button>
    </>
  );
}

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root")
);
