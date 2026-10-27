import { Route, Routes } from "react-router";

import { AuthPage } from "@/pages/AuthPage";
import { HomePage } from "@/pages/HomePage";
import { CreateProjectPage } from "@/pages/CreateProjectPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<AuthPage />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/projects/new" element={<CreateProjectPage />} />
    </Routes>
  );
}

export default App;
