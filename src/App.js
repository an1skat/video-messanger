import {Route, Routes} from "react-router";
import Room from "./pages/Room";
import Main from "./pages/Main";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <div>
      <Routes>
        <Route path="/room/:id" element={<Room />} />
        <Route path="/" element={<Main />} />
        <Route element={<NotFound />} />
      </Routes>
    </div>
  );
}

export default App;
