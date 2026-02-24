
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Cursos from './Talleres';
import Home from './Home';
//Pages
import MisionVision from './pages/MisionVision/MisionVision';

export default function LandingBolivar() {
 
  return (
   <BrowserRouter basename="/Camara_inmobiliaria" >
      <Routes>
        <Route path="/" element={<Home/>} />
        <Route path="/cursos" element={<Cursos/>} />
        <Route path='/mision_vision' element={<MisionVision/>} />
      </Routes>
    </BrowserRouter>
  );
}