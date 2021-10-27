import React from "react";
import ReactDOM from "react-dom";

import TimeLine from "../lib/main";

function App() {
  return (
    <div className="App">
      hello world
      <TimeLine />
    </div>
  );
}

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root")
);
