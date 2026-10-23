import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import TpoLayout from "./pages/tpo/TpoLayout";
import TpoDashboard from "./pages/tpo/TpoDashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* TPO ROUTES */}
        <Route path="/tpo" element={<TpoLayout />}>
          <Route
            index
            element={<Navigate to="dashboard" replace />}
          />

          <Route path="dashboard" element={<TpoDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App
