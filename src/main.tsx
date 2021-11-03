import React from "react";
import ReactDOM from "react-dom";

import Timeline, { wrapAsClip } from "../lib/main";
import { Track } from "../lib/interface";

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
    stateNode: null,
  },
  {
    key: "track-1",
    type: "image",
    index: 1,
    stateNode: null,

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
    stateNode: null,

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

function App() {
  return (
    <div>
      <Timeline data={testTracks} debug />

      <div
        style={{ width: 300, height: 80, background: "#654321" }}
        ref={(ref) => {
          wrapAsClip(ref, 50);
        }}
      />
    </div>
  );
}

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root")
);
