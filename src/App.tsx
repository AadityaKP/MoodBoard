import { BrowserRouter, Routes, Route } from "react-router-dom";
// import Navigation from "@/components/Navigation";
import Home from "@/pages/Index";
import Trends from "@/pages/Trends";

export default function App() {
  return (
    <BrowserRouter>
      {/* <Navigation /> */}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/trends" element={<Trends />} />
      </Routes>
    </BrowserRouter>
  );
}
